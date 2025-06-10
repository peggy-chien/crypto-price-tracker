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
  ws: WebSocketSubject<BinanceTickerMessage> | null;
  destroy$: Subject<void>;
  signal: ReturnType<typeof signal<TradingPairTicker | null>>; // Keep the same signal instance
  isConnected: boolean;
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
  private multiIsConnected = false;
  private readonly RECONNECT_INTERVAL = 5000;
  private activeSymbols = new Set<string>();
  private appVisibility = inject(AppVisibilityService);

  constructor() {
    effect(() => {
      if (!this.appVisibility.isVisible()) {
        this.disconnectAll();
      } else {
        // Resume all previously active streams
        this.reconnectAll();
      }
    });
  }

  /**
   * Subscribe to live ticker updates for a symbol (per-symbol).
   * @param symbol Trading pair symbol (e.g., BTCUSDT)
   */
  subscribeToTicker(symbol: string): Signal<TradingPairTicker | null> {
    const key = symbol.toUpperCase();
    this.activeSymbols.add(key);
    
    // If stream already exists, return existing signal
    if (this.streams.has(key)) {
      const stream = this.streams.get(key)!;
      if (!stream.isConnected) {
        this.connectTickerStream(key, symbol);
      }
      return stream.signal.asReadonly();
    }
    
    // Create new stream with persistent signal
    const tickerSignal = signal<TradingPairTicker | null>(null);
    const destroy$ = new Subject<void>();
    
    const stream: TickerStream = {
      ws: null,
      destroy$,
      signal: tickerSignal,
      isConnected: false
    };
    
    this.streams.set(key, stream);
    this.connectTickerStream(key, symbol);
    
    return tickerSignal.asReadonly();
  }

  /**
   * Connect or reconnect WebSocket for a specific ticker stream
   */
  private connectTickerStream(key: string, symbol: string): void {
    const stream = this.streams.get(key);
    if (!stream || stream.isConnected) return;

    const ws = webSocket<BinanceTickerMessage>({
      url: `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`,
      openObserver: {
        next: () => {
          console.log(`[BinanceWebsocketService] Ticker WebSocket connected for ${symbol}`);
          stream.isConnected = true;
        }
      },
      closeObserver: {
        next: () => {
          console.log(`[BinanceWebsocketService] Ticker WebSocket closed for ${symbol}`);
          stream.isConnected = false;
        }
      }
    });

    stream.ws = ws;

    ws.pipe(
      retry({
        delay: () => timer(this.RECONNECT_INTERVAL),
        resetOnSuccess: true
      }),
      takeUntil(stream.destroy$)
    ).subscribe({
      next: (msg) => {
        try {
          const ticker: TradingPairTicker = {
            symbol: msg.s,
            price: parseFloat(msg.c),
            change: parseFloat(msg.P)
          };
          // Update the persistent signal
          stream.signal.set(ticker);
        } catch (err) {
          console.error('[BinanceWebsocketService] Message processing error:', err);
        }
      },
      error: (err) => {
        console.error(`[BinanceWebsocketService] Ticker WebSocket error for ${symbol}:`, err);
        stream.isConnected = false;
      },
      complete: () => {
        console.log(`[BinanceWebsocketService] Ticker WebSocket connection closed for ${symbol}`);
        stream.isConnected = false;
      }
    });
  }

  /**
   * Subscribe to live ticker updates for multiple pairs (for grid).
   * Returns a signal<TradingPairTicker[]>.
   * @param pairs Array of trading pair symbols (e.g., ['BTCUSDT', 'ETHUSDT'])
   */
  subscribeToTickers(pairs: string[]): Signal<TradingPairTicker[]> {
    this.multiPairs = pairs;
    
    if (!this.multiIsConnected) {
      this.connectMultiTickerStream();
    }
    
    return this.multiSignal.asReadonly();
  }

  /**
   * Connect or reconnect the multi-ticker WebSocket
   */
  private connectMultiTickerStream(): void {
    if (this.multiPairs.length === 0 || this.multiIsConnected) return;

    this.disconnectMultiTickerStream();
    
    const streams = this.multiPairs.map(pair => `${pair.toLowerCase()}@ticker`).join('/');
    
    this.multiWs = webSocket<BinanceMultiTickerMessage>({
      url: `wss://stream.binance.com:9443/stream?streams=${streams}`,
      openObserver: {
        next: () => {
          console.log('[BinanceWebsocketService] Multi-ticker WebSocket connected');
          this.multiIsConnected = true;
        }
      },
      closeObserver: {
        next: () => {
          console.log('[BinanceWebsocketService] Multi-ticker WebSocket closed');
          this.multiIsConnected = false;
        }
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
        this.multiIsConnected = false;
      },
      complete: () => {
        console.log('[BinanceWebsocketService] Multi-ticker WebSocket connection closed');
        this.multiIsConnected = false;
      }
    });
  }

  /**
   * Disconnect all WebSocket connections but keep signals
   */
  private disconnectAll(): void {
    console.log('[BinanceWebsocketService] Disconnecting all streams');
    
    // Disconnect individual ticker streams
    for (const [key, stream] of this.streams.entries()) {
      if (stream.ws && stream.isConnected) {
        stream.ws.complete();
        stream.ws = null;
        stream.isConnected = false;
      }
    }
    
    // Disconnect multi-ticker stream
    this.disconnectMultiTickerStream();
  }

  /**
   * Disconnect multi-ticker stream but keep signal
   */
  private disconnectMultiTickerStream(): void {
    if (this.multiWs && this.multiIsConnected) {
      this.multiWs.complete();
      this.multiWs = null;
      this.multiIsConnected = false;
    }
  }

  /**
   * Reconnect all active streams that are not connected
   */
  private reconnectAll(): void {
    console.log('[BinanceWebsocketService] Reconnecting all disconnected streams');
    
    // Reconnect individual ticker streams
    for (const symbol of this.activeSymbols) {
      const key = symbol.toUpperCase();
      const stream = this.streams.get(key);
      if (stream && !stream.isConnected) {
        this.connectTickerStream(key, symbol);
      }
    }
    
    // Reconnect multi-ticker if needed
    if (this.multiPairs.length > 0 && !this.multiIsConnected) {
      this.connectMultiTickerStream();
    }
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
      if (stream.ws) {
        stream.ws.complete();
      }
      this.streams.delete(key);
    }
    this.activeSymbols.delete(key);
  }

  /**
   * Unsubscribe and clean up multi-ticker WebSocket.
   */
  unsubscribeFromTickers(): void {
    this.disconnectMultiTickerStream();
    this.clearMultiPairs();
  }

  /**
   * Explicitly clear the multiPairs list (call this when user leaves the grid page)
   */
  clearMultiPairs(): void {
    this.multiPairs = [];
    this.multiSignal.set([]);
  }

  /**
   * Clean up all WebSocket connections.
   */
  closeAll(): void {
    for (const [key, stream] of this.streams.entries()) {
      stream.destroy$.next();
      stream.destroy$.complete();
      if (stream.ws) {
        stream.ws.complete();
      }
      this.streams.delete(key);
    }
    this.activeSymbols.clear();
    
    if (this.multiWs) {
      this.multiDestroy$.next();
      this.multiDestroy$.complete();
      this.multiWs.complete();
      this.multiWs = null;
    }
    this.multiIsConnected = false;
    this.multiPairs = [];
    this.multiSignal.set([]);
  }

  /**
   * Get the current signal for multi-ticker updates.
   */
  getMultiSignal(): Signal<TradingPairTicker[]> {
    return this.multiSignal.asReadonly();
  }
} 