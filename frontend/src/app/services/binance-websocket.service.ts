import { Injectable, signal, Signal } from '@angular/core';
import { TradingPairTicker } from '../models/trading-pair-ticker.model';

interface TickerStream {
  ws: WebSocket;
  signal: Signal<TradingPairTicker | null>;
}

@Injectable({ providedIn: 'root' })
export class BinanceWebsocketService {
  // Map of symbol to TickerStream (per-symbol)
  private streams = new Map<string, TickerStream>();
  // Multi-ticker stream for grid
  private multiWs: WebSocket | null = null;
  private multiSignal = signal<TradingPairTicker[]>([]);
  private multiPairs: string[] = [];

  /**
   * Subscribe to live ticker updates for a symbol (per-symbol).
   */
  subscribeToTicker(symbol: string): Signal<TradingPairTicker | null> {
    const key = symbol.toUpperCase();
    this.unsubscribeFromTicker(symbol);
    const tickerSignal = signal<TradingPairTicker | null>(null);
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`);
    ws.onmessage = (event) => {
      try {
        const t = JSON.parse(event.data);
        const ticker: TradingPairTicker = {
          symbol: t.s,
          price: parseFloat(t.c),
          change: parseFloat(t.P)
        };
        tickerSignal.set(ticker);
      } catch (err) {
        console.error('[BinanceWebsocketService] WebSocket message error:', err);
      }
    };
    ws.onerror = (err) => {
      console.error('[BinanceWebsocketService] WebSocket error:', err);
    };
    ws.onclose = () => {};
    this.streams.set(key, { ws, signal: tickerSignal });
    return tickerSignal;
  }

  /**
   * Subscribe to live ticker updates for multiple pairs (for grid).
   * Returns a signal<TradingPairTicker[]>.
   */
  subscribeToTickers(pairs: string[]): Signal<TradingPairTicker[]> {
    this.unsubscribeFromTickers();
    this.multiPairs = pairs;
    const streams = pairs.map(pair => `${pair.toLowerCase()}@ticker`).join('/');
    this.multiWs = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    const tickerMap: Record<string, TradingPairTicker> = {};
    this.multiWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.data && data.stream) {
          const t = data.data;
          const ticker: TradingPairTicker = {
            symbol: t.s,
            price: parseFloat(t.c),
            change: parseFloat(t.P)
          };
          tickerMap[t.s] = ticker;
          this.multiSignal.set(Object.values(tickerMap));
        }
      } catch (err) {
        console.error('[BinanceWebsocketService] Multi-ticker WebSocket message error:', err);
      }
    };
    this.multiWs.onerror = (err) => {
      console.error('[BinanceWebsocketService] Multi-ticker WebSocket error:', err);
    };
    this.multiWs.onclose = () => {};
    return this.multiSignal;
  }

  /**
   * Unsubscribe and clean up live ticker WebSocket for a symbol.
   */
  unsubscribeFromTicker(symbol: string) {
    const key = symbol.toUpperCase();
    const stream = this.streams.get(key);
    if (stream) {
      stream.ws.onmessage = null;
      stream.ws.onerror = null;
      stream.ws.onclose = null;
      stream.ws.close();
      this.streams.delete(key);
    }
  }

  /**
   * Unsubscribe and clean up multi-ticker WebSocket.
   */
  unsubscribeFromTickers() {
    if (this.multiWs) {
      this.multiWs.onmessage = null;
      this.multiWs.onerror = null;
      this.multiWs.onclose = null;
      this.multiWs.close();
      this.multiWs = null;
      this.multiSignal.set([]);
      this.multiPairs = [];
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
      this.streams.delete(key);
    }
    this.unsubscribeFromTickers();
  }

  /**
   * Get the current signal for multi-ticker updates.
   */
  getMultiSignal(): Signal<TradingPairTicker[]> {
    return this.multiSignal;
  }
} 