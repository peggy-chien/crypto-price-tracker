import { Injectable, linkedSignal } from '@angular/core';
import { TradingPairTicker } from '../models/trading-pair-ticker.model';

@Injectable({ providedIn: 'root' })
export class BinanceWebsocketService {
  private ws: WebSocket | null = null;
  private tickerMap: Record<string, TradingPairTicker> = {};

  tradingPairs = linkedSignal<TradingPairTicker[]>(() => [], { equal: (a, b) => a === b });

  subscribeToPair(symbol: string) {
    this.close();
    const stream = `${symbol.toLowerCase()}@ticker`;
    this.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);
    this.ws.onmessage = (event) => {
      const t = JSON.parse(event.data);
      // t.s = symbol, t.c = last price, t.P = price change percent
      const ticker: TradingPairTicker = {
        symbol: t.s,
        price: parseFloat(t.c),
        change: parseFloat(t.P)
      };
      this.tickerMap[t.s] = ticker;
      this.tradingPairs.set([ticker]);
    };
  }

  subscribeToPairs(pairs: string[]) {
    this.close();
    const streams = pairs.map(pair => `${pair}@ticker`).join('/');
    this.ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data && data.data && data.stream) {
        const t = data.data;
        const ticker: TradingPairTicker = {
          symbol: t.s,
          price: parseFloat(t.c),
          change: parseFloat(t.P)
        };
        this.tickerMap[t.s] = ticker;
        this.tradingPairs.set(Object.values(this.tickerMap));
      }
    };
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.tickerMap = {};
    this.tradingPairs.set([]);
  }
} 