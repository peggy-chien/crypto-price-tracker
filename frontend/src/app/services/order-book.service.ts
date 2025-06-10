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
  ws: WebSocketSubject<BinanceOrderBookMessage>;
  destroy$: Subject<void>;
  signal: Signal<OrderBook>;
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
        this.closeAll();
      } else {
        // Resume all previously active streams
        for (const symbol of this.activeSymbols) {
          if (!this.streams.has(symbol)) {
            this.subscribeToOrderBook(symbol);
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
    this.unsubscribeFromOrderBook(symbol);
    this.activeSymbols.add(key);
    
    const orderBookSignal = signal<OrderBook>({ bids: [], asks: [], lastUpdateId: 0 });
    const destroy$ = new Subject<void>();
    
    const ws = webSocket<BinanceOrderBookMessage>({
      url: `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth`,
      openObserver: {
        next: () => console.log('[OrderBookService] WebSocket connected')
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
          orderBookSignal.set(orderBook);
        } catch (err) {
          console.error('[OrderBookService] Message processing error:', err);
        }
      },
      error: (err) => {
        console.error('[OrderBookService] WebSocket error:', err);
      },
      complete: () => {
        console.log('[OrderBookService] WebSocket connection closed');
      }
    });

    this.streams.set(key, { ws, destroy$, signal: orderBookSignal });
    return orderBookSignal;
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
      stream.ws.complete();
      this.streams.delete(key);
    }
    this.activeSymbols.delete(key);
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
  }
} 