import { inject, Injectable, signal, Signal, effect } from '@angular/core';
import { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { HttpClient } from '@angular/common/http';
import { Observable, map, Subject, catchError, of, timer } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { retry, takeUntil } from 'rxjs/operators';
import { CandleInterval } from '../models/candle-interval.type';
import { AppVisibilityService } from './app-visibility.service';

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
  ws: WebSocketSubject<BinanceKlineMessage> | null;
  destroy$: Subject<void>;
  signal: ReturnType<typeof signal<CandlestickData | null>>; // Keep the same signal instance
  isConnected: boolean;
}

@Injectable({ providedIn: 'root' })
export class CandlesService {
  private http = inject(HttpClient);
  private streams = new Map<string, CandleStream>();
  private readonly RECONNECT_INTERVAL = 5000;
  private activeKeys = new Set<string>();
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
   * @param symbol Trading pair symbol (e.g., BTCUSDT)
   * @param interval Kline interval (e.g., '1m', '1h')
   */
  subscribeToLiveKlines(symbol: string, interval: CandleInterval = CandleInterval.OneMinute): Signal<CandlestickData | null> {
    const key = `${symbol.toLowerCase()}_${interval}`;
    this.activeKeys.add(key);
    
    // If stream already exists, return existing signal
    if (this.streams.has(key)) {
      const stream = this.streams.get(key)!;
      if (!stream.isConnected) {
        this.connectStream(key, symbol, interval);
      }
      return stream.signal.asReadonly();
    }
    
    // Create new stream with persistent signal
    const candleSignal = signal<CandlestickData | null>(null);
    const destroy$ = new Subject<void>();
    
    const stream: CandleStream = {
      ws: null,
      destroy$,
      signal: candleSignal,
      isConnected: false
    };
    
    this.streams.set(key, stream);
    this.connectStream(key, symbol, interval);
    
    return candleSignal.asReadonly();
  }

  /**
   * Connect or reconnect WebSocket for a specific stream
   */
  private connectStream(key: string, symbol: string, interval: CandleInterval): void {
    const stream = this.streams.get(key);
    if (!stream || stream.isConnected) return;

    const ws = webSocket<BinanceKlineMessage>({
      url: `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`,
      openObserver: {
        next: () => {
          console.log(`[CandlesService] WebSocket connected for ${symbol} ${interval}`);
          stream.isConnected = true;
        }
      },
      closeObserver: {
        next: () => {
          console.log(`[CandlesService] WebSocket closed for ${symbol} ${interval}`);
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
          if (msg.k) {
            const k = msg.k;
            const candle: CandlestickData = {
              time: Math.floor(k.t / 1000) as UTCTimestamp,
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c)
            };
            
            // Update the persistent signal
            stream.signal.set(candle);
          }
        } catch (err) {
          console.error('[CandlesService] Message processing error:', err);
        }
      },
      error: (err) => {
        console.error(`[CandlesService] WebSocket error for ${symbol} ${interval}:`, err);
        stream.isConnected = false;
      },
      complete: () => {
        console.log(`[CandlesService] WebSocket connection closed for ${symbol} ${interval}`);
        stream.isConnected = false;
      }
    });
  }

  /**
   * Disconnect all WebSocket connections but keep signals
   */
  private disconnectAll(): void {
    console.log('[CandlesService] Disconnecting all streams');
    for (const [key, stream] of this.streams.entries()) {
      if (stream.ws && stream.isConnected) {
        stream.ws.complete();
        stream.ws = null;
        stream.isConnected = false;
      }
    }
  }

  /**
   * Reconnect all active streams
   */
  private reconnectAll(): void {
    console.log('[CandlesService] Reconnecting all streams');
    for (const key of this.activeKeys) {
      const stream = this.streams.get(key);
      if (stream && !stream.isConnected) {
        const [symbol, interval] = key.split('_');
        this.connectStream(key, symbol, interval as CandleInterval);
      }
    }
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
      if (stream.ws) {
        stream.ws.complete();
      }
      this.streams.delete(key);
    }
    this.activeKeys.delete(key);
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
    this.activeKeys.clear();
  }
}