import { inject, Injectable, signal, Signal } from '@angular/core';
import { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { HttpClient } from '@angular/common/http';
import { Observable, map, Subject, takeUntil, catchError, of } from 'rxjs';
import { CandleInterval } from '../models/candle-interval.type';

interface CandleStream {
  ws: WebSocket;
  destroy$: Subject<void>;
  signal: Signal<CandlestickData | null>;
}

@Injectable({ providedIn: 'root' })
export class CandlesService {
  private http = inject(HttpClient);
  // Map of symbol-interval to CandleStream
  private streams = new Map<string, CandleStream>();

  /**
   * Fetch historical candles for a symbol and interval.
   * @param symbol Trading pair symbol (e.g., BTCUSDT)
   * @param interval Kline interval (e.g., '1m', '1h')
   */
  fetchHistoricalCandles(symbol: string, interval: CandleInterval = CandleInterval.OneMinute, endTime?: number): Observable<CandlestickData[]> {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=100${endTime ? `&endTime=${endTime}` : ''}`;
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
   */
  subscribeToLiveKlines(symbol: string, interval: CandleInterval = CandleInterval.OneMinute): Signal<CandlestickData | null> {
    const key = `${symbol.toLowerCase()}_${interval}`;
    // Clean up previous connection if exists
    this.unsubscribeFromLiveKlines(symbol, interval);
    const destroy$ = new Subject<void>();
    const candleSignal = signal<CandlestickData | null>(null);
    const stream: CandleStream = {
      ws: new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`),
      destroy$,
      signal: candleSignal
    };
    stream.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
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
        console.error('[CandlesService] WebSocket message error:', err);
      }
    };
    stream.ws.onerror = (err) => {
      console.error('[CandlesService] WebSocket error:', err);
    };
    stream.ws.onclose = () => {
      destroy$.next();
      destroy$.complete();
    };
    this.streams.set(key, stream);
    return candleSignal;
  }

  /**
   * Unsubscribe and clean up live kline WebSocket for a symbol/interval.
   */
  unsubscribeFromLiveKlines(symbol: string, interval: CandleInterval = CandleInterval.OneMinute) {
    const key = `${symbol.toLowerCase()}_${interval}`;
    const stream = this.streams.get(key);
    if (stream) {
      stream.ws.onmessage = null;
      stream.ws.onerror = null;
      stream.ws.onclose = null;
      stream.ws.close();
      stream.destroy$.next();
      stream.destroy$.complete();
      this.streams.delete(key);
    }
  }

  /**
   * Clean up all WebSocket connections.
   */
  closeAll() {
    for (const [key, stream] of this.streams.entries()) {
      stream.ws.onmessage = null;
      stream.ws.onerror = null;
      stream.ws.onclose = null;
      stream.ws.close();
      stream.destroy$.next();
      stream.destroy$.complete();
      this.streams.delete(key);
    }
  }
} 