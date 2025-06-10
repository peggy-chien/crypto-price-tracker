import { Injectable, signal, Signal, inject, effect } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Subject, timer } from 'rxjs';
import { retry, takeUntil } from 'rxjs/operators';
import { TradingPairTicker } from '../models/trading-pair-ticker.model';
import { AppVisibilityService } from './app-visibility.service';

interface BinanceTickerMessage {
  s: string;  // symbol
  c: string;  // current price
  P: string;  // price change percent
}

interface BinanceMultiTickerMessage {
  stream: string;
  data: BinanceTickerMessage;
}

interface TickerStream {
  ws: WebSocketSubject<BinanceTickerMessage>;
  destroy$: Subject<void>;
  signal: Signal<TradingPairTicker | null>;
}

@Injectable({ providedIn: 'root' })
export class BinanceWebsocketService {
  // Map of symbol to TickerStream (per-symbol)
  private streams = new Map<string, TickerStream>();
  // Multi-ticker stream for grid
  private multiWs: WebSocketSubject<BinanceMultiTickerMessage> | null = null;
  private multiSignal = signal<TradingPairTicker[]>([]);
  private multiDestroy$ = new Subject<void>();
  private multiPairs: string[] = [];
  private readonly RECONNECT_INTERVAL = 5000;
  private activeSymbols = new Set<string>();
  private appVisibility = inject(AppVisibilityService);

  constructor() {
    effect(() => {
      if (!this.appVisibility.isVisible()) {
        this.closeAll();
      } else {
        // Resume all previously active streams
        for (const symbol of this.activeSymbols) {
          if (!this.streams.has(symbol)) {
            this.subscribeToTicker(symbol);
          }
        }
        // Resume multi-ticker if needed
        if (this.multiPairs.length > 0 && !this.multiWs) {
          this.subscribeToTickers(this.multiPairs);
        }
      }
    });
  }

  /**
   * Subscribe to live ticker updates for a symbol (per-symbol).
   * @param symbol Trading pair symbol (e.g., BTCUSDT)
   */
  subscribeToTicker(symbol: string): Signal<TradingPairTicker | null> {
    const key = symbol.toUpperCase();
    this.unsubscribeFromTicker(symbol);
    this.activeSymbols.add(key);
    
    const tickerSignal = signal<TradingPairTicker | null>(null);
    const destroy$ = new Subject<void>();
    
    const ws = webSocket<BinanceTickerMessage>({
      url: `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`,
      openObserver: {
        next: () => console.log('[BinanceWebsocketService] WebSocket connected')
      }
    });

    ws.pipe(
      retry({
        delay: () => timer(this.RECONNECT_INTERVAL),
        resetOnSuccess: true
      }),
      takeUntil(destroy$)
    ).subscribe({
      next: (msg) => {
        try {
          const ticker: TradingPairTicker = {
            symbol: msg.s,
            price: parseFloat(msg.c),
            change: parseFloat(msg.P)
          };
          tickerSignal.set(ticker);
        } catch (err) {
          console.error('[BinanceWebsocketService] Message processing error:', err);
        }
      },
      error: (err) => {
        console.error('[BinanceWebsocketService] WebSocket error:', err);
      },
      complete: () => {
        console.log('[BinanceWebsocketService] WebSocket connection closed');
      }
    });

    this.streams.set(key, { ws, destroy$, signal: tickerSignal });
    return tickerSignal;
  }

  /**
   * Subscribe to live ticker updates for multiple pairs (for grid).
   * Returns a signal<TradingPairTicker[]>.
   * @param pairs Array of trading pair symbols (e.g., ['BTCUSDT', 'ETHUSDT'])
   */
  subscribeToTickers(pairs: string[]): Signal<TradingPairTicker[]> {
    this.unsubscribeFromTickers();
    this.multiPairs = pairs;
    const streams = pairs.map(pair => `${pair.toLowerCase()}@ticker`).join('/');
    
    this.multiWs = webSocket<BinanceMultiTickerMessage>({
      url: `wss://stream.binance.com:9443/stream?streams=${streams}`,
      openObserver: {
        next: () => console.log('[BinanceWebsocketService] Multi-ticker WebSocket connected')
      }
    });

    const tickerMap: Record<string, TradingPairTicker> = {};
    
    this.multiWs.pipe(
      retry({
        delay: () => timer(this.RECONNECT_INTERVAL),
        resetOnSuccess: true
      }),
      takeUntil(this.multiDestroy$)
    ).subscribe({
      next: (msg) => {
        try {
          if (msg.data) {
            const ticker: TradingPairTicker = {
              symbol: msg.data.s,
              price: parseFloat(msg.data.c),
              change: parseFloat(msg.data.P)
            };
            tickerMap[ticker.symbol] = ticker;
            this.multiSignal.set(Object.values(tickerMap));
          }
        } catch (err) {
          console.error('[BinanceWebsocketService] Multi-ticker message processing error:', err);
        }
      },
      error: (err) => {
        console.error('[BinanceWebsocketService] Multi-ticker WebSocket error:', err);
      },
      complete: () => {
        console.log('[BinanceWebsocketService] Multi-ticker WebSocket connection closed');
      }
    });

    return this.multiSignal;
  }

  /**
   * Unsubscribe and clean up live ticker WebSocket for a symbol.
   */
  unsubscribeFromTicker(symbol: string): void {
    const key = symbol.toUpperCase();
    const stream = this.streams.get(key);
    if (stream) {
      stream.destroy$.next();
      stream.destroy$.complete();
      stream.ws.complete();
      this.streams.delete(key);
    }
    this.activeSymbols.delete(key);
  }

  /**
   * Unsubscribe and clean up multi-ticker WebSocket.
   */
  unsubscribeFromTickers(): void {
    this.unsubscribeFromMultiTicker();
    this.clearMultiPairs();
  }

  /**
   * Unsubscribe and clean up multi-ticker WebSocket.
   */
  private unsubscribeFromMultiTicker(): void {
    if (this.multiWs) {
      this.multiDestroy$.next();
      this.multiDestroy$.complete();
      this.multiWs.complete();
      this.multiWs = null;
      this.multiSignal.set([]);
    }
  }

  /**
   * Explicitly clear the multiPairs list (call this when user leaves the grid page)
   */
  clearMultiPairs(): void {
    this.multiPairs = [];
  }

  /**
   * Clean up all WebSocket connections.
   */
  closeAll(): void {
    for (const [key, stream] of this.streams.entries()) {
      stream.destroy$.next();
      stream.destroy$.complete();
      stream.ws.complete();
      this.streams.delete(key);
    }
    this.unsubscribeFromMultiTicker();
  }

  /**
   * Get the current signal for multi-ticker updates.
   */
  getMultiSignal(): Signal<TradingPairTicker[]> {
    return this.multiSignal;
  }
} 