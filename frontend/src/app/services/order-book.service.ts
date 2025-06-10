import { Injectable, signal, Signal, inject, effect } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Subject, timer } from 'rxjs';
import { retry, takeUntil } from 'rxjs/operators';
import { OrderBook } from '../models/order-book.model';
import { AppVisibilityService } from './app-visibility.service';

interface BinanceOrderBookMessage {
  b: string[][];  // bids array
  a: string[][];  // asks array
  u: number;      // lastUpdateId
}

interface OrderBookStream {
  ws: WebSocketSubject<BinanceOrderBookMessage> | null;
  destroy$: Subject<void>;
  signal: ReturnType<typeof signal<OrderBook>>; // Keep the same signal instance
  isConnected: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class OrderBookService {
  private streams = new Map<string, OrderBookStream>();
  private readonly RECONNECT_INTERVAL = 5000;
  private activeSymbols = new Set<string>();
  private appVisibility = inject(AppVisibilityService);

  constructor() {
    effect(() => {
      if (!this.appVisibility.isVisible()) {
        this.disconnectAll();
      } else {
        // Reconnect if there are any disconnected streams
        for (const stream of this.streams.values()) {
          if (!stream.isConnected) {
            this.reconnectAll();
            break;
          }
        }
      }
    });
  }

  /**
   * Subscribe to live order book updates for a symbol.
   * Returns a Signal<OrderBook> that updates with each new order book snapshot.
   * @param symbol Trading pair symbol (e.g., BTCUSDT)
   */
  subscribeToOrderBook(symbol: string): Signal<OrderBook> {
    const key = symbol.toUpperCase();
    this.activeSymbols.add(key);
    
    // If stream already exists, return existing signal
    if (this.streams.has(key)) {
      const stream = this.streams.get(key)!;
      if (!stream.isConnected) {
        this.connectStream(key, symbol);
      }
      return stream.signal.asReadonly();
    }
    
    // Create new stream with persistent signal
    const orderBookSignal = signal<OrderBook>({ bids: [], asks: [], lastUpdateId: 0 });
    const destroy$ = new Subject<void>();
    
    const stream: OrderBookStream = {
      ws: null,
      destroy$,
      signal: orderBookSignal,
      isConnected: false
    };
    
    this.streams.set(key, stream);
    this.connectStream(key, symbol);
    
    return orderBookSignal.asReadonly();
  }

  /**
   * Connect or reconnect WebSocket for a specific stream
   */
  private connectStream(key: string, symbol: string): void {
    const stream = this.streams.get(key);
    if (!stream || stream.isConnected) return;
    
    const ws = webSocket<BinanceOrderBookMessage>({
      url: `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth`,
      openObserver: {
        next: () => {
          console.log(`[OrderBookService] WebSocket connected for ${symbol}`);
          stream.isConnected = true;
        }
      },
      closeObserver: {
        next: () => {
          console.log(`[OrderBookService] WebSocket closed for ${symbol}`);
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
          if (!msg) return;
          
          const orderBook: OrderBook = {
            bids: msg.b.map((bid: string[]) => ({
              price: parseFloat(bid[0]),
              quantity: parseFloat(bid[1])
            })),
            asks: msg.a.map((ask: string[]) => ({
              price: parseFloat(ask[0]),
              quantity: parseFloat(ask[1])
            })),
            lastUpdateId: msg.u
          };
          
          // Update the persistent signal
          stream.signal.set(orderBook);
        } catch (err) {
          console.error('[OrderBookService] Message processing error:', err);
        }
      },
      error: (err) => {
        console.error(`[OrderBookService] WebSocket error for ${symbol}:`, err);
        stream.isConnected = false;
      },
      complete: () => {
        console.log(`[OrderBookService] WebSocket connection closed for ${symbol}`);
        stream.isConnected = false;
      }
    });
  }

  /**
   * Disconnect all WebSocket connections but keep signals
   */
  private disconnectAll(): void {
    console.log('[OrderBookService] Disconnecting all streams');
    for (const [key, stream] of this.streams.entries()) {
      if (stream.ws && stream.isConnected) {
        stream.ws.complete();
        stream.ws = null;
        stream.isConnected = false;
      }
    }
  }

  /**
   * Reconnect all active streams that are not connected
   */
  private reconnectAll(): void {
    console.log('[OrderBookService] Reconnecting all disconnected streams');
    for (const symbol of this.activeSymbols) {
      const key = symbol.toUpperCase();
      const stream = this.streams.get(key);
      if (stream && !stream.isConnected) {
        this.connectStream(key, symbol);
      }
    }
  }

  /**
   * Unsubscribe and clean up order book WebSocket for a symbol.
   */
  unsubscribeFromOrderBook(symbol: string): void {
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
   * Clean up all WebSocket connections and streams.
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
  }
}