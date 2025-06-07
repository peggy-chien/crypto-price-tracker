import { inject, Injectable, linkedSignal } from '@angular/core';
import { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CandlesService {
  private http = inject(HttpClient);
  interval = linkedSignal<string>(() => '1m');
  ws: WebSocket | null = null;

  setInterval(interval: string) {
    this.interval.set(interval);
  }

  fetchHistoricalCandles(symbol: string, interval: string = '1m'): Observable<CandlestickData[]> {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=100`;
    return this.http.get<any[]>(url).pipe(
      map(data => data.map((d: any) => ({
        time: Math.floor(d[0] / 1000) as UTCTimestamp,
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4])
      })))
    );
  }

  fetchHistoricalCandlesBefore(symbol: string, interval: string = '1m', endTime: number): Observable<CandlestickData[]> {
    console.log(`[CandlesService] Fetching more candles for ${symbol} ${interval} before ${endTime}`);
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&endTime=${endTime}&limit=100`;
    return this.http.get<any[]>(url).pipe(
      map(data => data.map((d: any) => ({
        time: Math.floor(d[0] / 1000) as UTCTimestamp,
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4])
      })))
    );
  }

  subscribeToLiveKlines(symbol: string, onCandle: (candle: CandlestickData) => void, interval: string = '1m'): WebSocket {
    const useInterval = interval;
    const stream = `${symbol.toLowerCase()}@kline_${useInterval}`;
    this.close(); // Always close previous connection before opening a new one
    this.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);
    this.ws.onmessage = (event) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
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
          onCandle(candle);
        }
      }
    };
    this.ws.onerror = () => {};
    this.ws.onclose = () => {};
    return this.ws;
  }

  close() {
    if (this.ws) {
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
} 