import { inject, Injectable, signal, Signal } from '@angular/core';
import { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { HttpClient } from '@angular/common/http';
import { Observable, map, Subject, catchError, of, timer } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { takeUntil, retry } from 'rxjs/operators';
import { CandleInterval } from '../models/candle-interval.type';

interface BinanceKlineMessage {
  k: {
    t: number;  // start time
    o: string;  // open
    h: string;  // high
    l: string;  // low
    c: string;  // close
  };
}

interface CandleStream {
  ws: WebSocketSubject<BinanceKlineMessage>;
  destroy$: Subject<void>;
  signal: Signal<CandlestickData | null>;
}

@Injectable({ providedIn: 'root' })
export class CandlesService {
  private http = inject(HttpClient);
  private streams = new Map<string, CandleStream>();
  private readonly RECONNECT_INTERVAL = 5000;

  /**
   * Fetch historical candles for a symbol and interval.
   * @param symbol Trading pair symbol (e.g., BTCUSDT)
   * @param interval Kline interval (e.g., '1m', '1h')
   */
  fetchHistoricalCandles(symbol: string, interval: CandleInterval = CandleInterval.OneMinute, endTime?: number): Observable<CandlestickData[]> {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=500${endTime ? `&endTime=${endTime}` : ''}`;
    return this.http.get<any[]>(url).pipe(
      map(data => data.map((d: any) => ({
        time: Math.floor(d[0] / 1000) as UTCTimestamp,
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4])
      }))),
      catchError(err => {
        console.error('[CandlesService] fetchHistoricalCandles error:', err);
        return of([]);
      })
    );
  }

  /**
   * Subscribe to live kline updates for a symbol and interval.
   * Returns a Signal<CandlestickData|null> that updates with each new candle.
   * Cleans up previous connection for the same symbol/interval.
   * @param symbol Trading pair symbol (e.g., BTCUSDT)
   * @param interval Kline interval (e.g., '1m', '1h')
   */
  subscribeToLiveKlines(symbol: string, interval: CandleInterval = CandleInterval.OneMinute): Signal<CandlestickData | null> {
    const key = `${symbol.toLowerCase()}_${interval}`;
    this.unsubscribeFromLiveKlines(symbol, interval);
    
    const candleSignal = signal<CandlestickData | null>(null);
    const destroy$ = new Subject<void>();
    
    const ws = webSocket<BinanceKlineMessage>({
      url: `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`,
      openObserver: {
        next: () => console.log('[CandlesService] WebSocket connected')
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
          if (msg.k) {
            const k = msg.k;
            const candle: CandlestickData = {
              time: Math.floor(k.t / 1000) as UTCTimestamp,
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c)
            };
            candleSignal.set(candle);
          }
        } catch (err) {
          console.error('[CandlesService] Message processing error:', err);
        }
      },
      error: (err) => {
        console.error('[CandlesService] WebSocket error:', err);
      },
      complete: () => {
        console.log('[CandlesService] WebSocket connection closed');
      }
    });

    this.streams.set(key, { ws, destroy$, signal: candleSignal });
    return candleSignal;
  }

  /**
   * Unsubscribe and clean up live kline WebSocket for a symbol/interval.
   */
  unsubscribeFromLiveKlines(symbol: string, interval: CandleInterval = CandleInterval.OneMinute): void {
    const key = `${symbol.toLowerCase()}_${interval}`;
    const stream = this.streams.get(key);
    if (stream) {
      stream.destroy$.next();
      stream.destroy$.complete();
      stream.ws.complete();
      this.streams.delete(key);
    }
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