import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { throttleTime } from 'rxjs/operators';
import { OrderBook } from '../models/order-book.model';

@Injectable({
  providedIn: 'root'
})
export class OrderBookService {
  private wsConnection: WebSocketSubject<any> | null = null;
  private orderBookSubject = new BehaviorSubject<OrderBook>({ bids: [], asks: [], lastUpdateId: 0 });
  public orderBook$ = this.orderBookSubject.asObservable().pipe(throttleTime(200));

  connect(symbol: string): void {
    const wsUrl = `wss://stream.binance.com/stream?streams=${symbol.toLowerCase()}@depth`;
    
    this.wsConnection = webSocket({
      url: wsUrl,
      openObserver: {
        next: () => {
          console.log('WebSocket connected');
        }
      }
    });

    this.wsConnection.subscribe({
      next: (msg) => {
        const data = msg.data;
        if (!data) return;
        const orderBook: OrderBook = {
          bids: data.b.map((bid: string[]) => ({
            price: parseFloat(bid[0]),
            quantity: parseFloat(bid[1])
          })),
          asks: data.a.map((ask: string[]) => ({
            price: parseFloat(ask[0]),
            quantity: parseFloat(ask[1])
          })),
          lastUpdateId: data.u
        };
        this.orderBookSubject.next(orderBook);
      },
      error: (error) => {
        console.error('WebSocket error:', error);
        this.reconnect(symbol);
      },
      complete: () => {
        console.log('WebSocket connection closed');
        this.reconnect(symbol);
      }
    });
  }

  private reconnect(symbol: string): void {
    setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect(symbol);
    }, 5000);
  }

  disconnect(): void {
    if (this.wsConnection) {
      this.wsConnection.complete();
      this.wsConnection = null;
    }
  }
} 