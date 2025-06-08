import { ChangeDetectionStrategy, Component, Input, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject, signal, effect, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { createChart, IChartApi, TimeChartOptions, DeepPartial, ColorType, CandlestickSeries, CandlestickData, IRange, BarsInfo, LogicalRangeChangeEventHandler } from 'lightweight-charts';
import { CandlesService } from '../../services/candles.service';
import { BinanceWebsocketService } from '../../services/binance-websocket.service';
import { TradingPairTicker } from '../../models/trading-pair-ticker.model';
import { CandleInterval } from '../../models/candle-interval.type';
import { BehaviorSubject, combineLatest, switchMap, catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-candles-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './candles-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CandlesViewComponent implements AfterViewInit, OnDestroy {
  @Input() symbol!: string;
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  // Signals for local state
  loading = signal(false);
  selectedInterval = signal<CandleInterval>(CandleInterval.OneMinute);
  lastClose = signal<number | null>(null);
  prevClose = signal<number | null>(null);
  earliestCandleTime: number = 0;
  loadingMore = false;
  error = signal<string | null>(null);
  noMoreHistory = false;
  private chart: IChartApi | undefined;
  private candleSeries: any;
  private candlesService = inject(CandlesService);
  private binanceWs = inject(BinanceWebsocketService);
  tickerSignal: Signal<TradingPairTicker | null> | null = null;
  private lastKlineSymbol: string | null = null;
  private lastKlineInterval: CandleInterval | null = null;

  // RxJS Subjects for symbol and interval
  private symbol$ = new BehaviorSubject<string | null>(null);
  private interval$ = new BehaviorSubject<CandleInterval>(CandleInterval.OneMinute);

  // RxJS Observable for candles
  private candles$ = combineLatest([
    this.symbol$,
    this.interval$
  ]).pipe(
    switchMap(([symbol, interval]) => {
      if (!symbol) return of([]);
      this.loading.set(true);
      this.error.set(null);
      return this.candlesService.fetchHistoricalCandles(symbol, interval).pipe(
        catchError(err => {
          this.error.set('Failed to load candles');
          this.loading.set(false);
          return of([]);
        })
      );
    })
  );

  // Signal for candles, bridged from RxJS
  candles = toSignal(this.candles$, { initialValue: [] });

  // Add a new signal for the displayed candles
  displayCandles = signal<CandlestickData[]>([]);

  // Add a property to hold all candles
  private allCandles: CandlestickData[] = [];

  // Effect to update prevClose, lastClose, earliestCandleTime when candles change
  private candlesEffectRef = effect(() => {
    const candles = this.candles();
    this.loading.set(false);
    if (candles.length > 1) {
      this.prevClose.set(candles[candles.length - 2].close);
      this.lastClose.set(candles[candles.length - 1].close);
      this.earliestCandleTime = Number(candles[0].time);
    } else if (candles.length === 1) {
      this.prevClose.set(null);
      this.lastClose.set(candles[0].close);
      this.earliestCandleTime = Number(candles[0].time);
    } else {
      this.prevClose.set(null);
      this.lastClose.set(null);
      this.earliestCandleTime = 0;
    }
    this.displayCandles.set(candles);
    this.allCandles = candles;
    if (this.candleSeries) {
      this.candleSeries.setData(this.allCandles);
    }
  });

  // Effect for error handling (log or toast)
  private errorEffectRef = effect(() => {
    const err = this.error();
    if (err) {
      // Replace with toast if desired
      console.error('[CandlesViewComponent] Error:', err);
    }
  });

  // Computed signal for live candle, only subscribes when symbol is defined
  liveCandle = computed(() => {
    if (!this.symbol) return null;
    return this.candlesService.subscribeToLiveKlines(this.symbol, this.selectedInterval());
  });

  // Effect to update chart with live candle
  private liveCandleEffectRef = effect(() => {
    const liveSignal = this.liveCandle();
    const liveValue = liveSignal ? liveSignal() : null;
    if (!liveValue || !this.candleSeries) return;
    // Use the historical candles as the base
    const candles = this.candles();
    if (candles.length === 0) return;
    const last = candles[candles.length - 1];
    let updated: CandlestickData[];
    if (Number(liveValue.time) === Number(last.time)) {
      updated = [...candles.slice(0, -1), liveValue];
    } else if (Number(liveValue.time) > Number(last.time)) {
      updated = [...candles, liveValue];
    } else {
      return;
    }
    this.allCandles = updated;
    this.candleSeries.setData(this.allCandles);
  });

  intervals = [
    { label: '1m', value: CandleInterval.OneMinute },
    { label: '30m', value: CandleInterval.ThirtyMinutes },
    { label: '1h', value: CandleInterval.OneHour },
    { label: '1d', value: CandleInterval.OneDay }
  ] as const;

  ngAfterViewInit() {
    this.tickerSignal = this.symbol ? this.binanceWs.subscribeToTicker(this.symbol) : null;
    this.unsubscribeFromPreviousKlines();
    this.lastKlineSymbol = this.symbol;
    this.lastKlineInterval = this.selectedInterval();
    this.symbol$.next(this.symbol);
    this.interval$.next(this.selectedInterval());
    this.resetChart();
    this.initChart();
  }

  ngOnDestroy() {
    this.unsubscribeFromPreviousKlines();
    this.resetChart();
    this.candlesService.closeAll();
    this.candlesEffectRef?.destroy();
    this.errorEffectRef?.destroy();
  }

  // React to interval changes
  onIntervalChange(interval: CandleInterval) {
    // Unsubscribe from the previous kline WebSocket
    if (this.lastKlineSymbol && this.lastKlineInterval) {
      this.candlesService.unsubscribeFromLiveKlines(this.lastKlineSymbol, this.lastKlineInterval);
    }
    this.selectedInterval.set(interval);
    this.lastKlineSymbol = this.symbol;
    this.lastKlineInterval = interval;
    this.interval$.next(interval);
    this.resetChart();
    this.initChart();
  }

  // Initialize the chart and series
  private initChart() {
    const chartOptions: DeepPartial<TimeChartOptions> = {
      layout: { textColor: 'black', background: { type: ColorType.Solid, color: 'white' } },
      timeScale: {
        tickMarkFormatter: (timestamp: number) => {
          const date = new Date(timestamp * 1000);
          if (this.selectedInterval() === '1d') {
            return date.toLocaleDateString('en-CA');
          } else if (date.getHours() === 0 && date.getMinutes() === 0) {
            return date.toLocaleDateString('en-CA');
          } else {
            return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
          }
        }
      }
    };
    this.chart = createChart(this.chartContainer.nativeElement, chartOptions);
    this.candleSeries = this.chart.addSeries(CandlestickSeries, { upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350' });
    this.setupLazyLoading();
  }

  // Helper to get interval in seconds
  private getIntervalSeconds(): number {
    switch (this.selectedInterval()) {
      case '1m': return 60;
      case '30m': return 1800;
      case '1h': return 3600;
      case '1d': return 86400;
      default: return 60;
    }
  }

  // Reset chart and state
  private resetChart() {
    if (this.chart) {
      this.chart.remove();
      this.chart = undefined;
      this.candleSeries = undefined;
    }
    this.prevClose.set(null);
    this.lastClose.set(null);
    this.earliestCandleTime = 0;
  }

  // Price color based on last/prev close
  get priceColor(): string {
    const last = this.lastClose();
    const prev = this.prevClose();
    if (last == null || prev == null) return 'text-gray-900';
    if (last > prev) return 'text-green-600';
    if (last < prev) return 'text-red-600';
    return 'text-gray-900';
  }

  get percentageColor(): string {
    const ticker = this.tickerSignal?.();
    if (ticker == null || ticker.change == null) return 'text-gray-900';
    if (ticker.change > 0) return 'text-green-600';
    if (ticker.change < 0) return 'text-red-600';
    return 'text-gray-900';
  }

  private unsubscribeFromPreviousKlines() {
    if (this.lastKlineSymbol && this.lastKlineInterval) {
      this.candlesService.unsubscribeFromLiveKlines(this.lastKlineSymbol, this.lastKlineInterval);
    }
  }

  private setupLazyLoading() {
    if (!this.chart) return;
  
    let lastFetchedFrom: number | null = null;
  
    const onVisibleLogicalRangeChanged: LogicalRangeChangeEventHandler = (newVisibleLogicalRange) => {
      const barsInfo: BarsInfo<number> = this.candleSeries.barsInLogicalRange(newVisibleLogicalRange);
  
      if (barsInfo !== null && barsInfo.barsBefore < 50) {
        const fromTimestamp = barsInfo.from ? barsInfo.from * 1000 : undefined;
  
        if (fromTimestamp && fromTimestamp !== lastFetchedFrom) {
          console.log('[LazyLoad] Fetching historical candles from:', fromTimestamp);
          lastFetchedFrom = fromTimestamp;
  
          this.candlesService
            .fetchHistoricalCandles(this.symbol, this.selectedInterval(), fromTimestamp)
            .subscribe((newCandles) => {
              if (newCandles && newCandles.length > 0) {
                const currentData = this.candleSeries.data();
  
                // Merge & remove duplicates based on `time`
                const mergedMap = new Map<number, typeof newCandles[0]>();
                [...newCandles, ...currentData].forEach(candle => {
                  mergedMap.set(candle.time, candle); // later ones override earlier
                });
  
                const merged = Array.from(mergedMap.values())
                  .sort((a, b) => Number(a.time) - Number(b.time)); // strictly ascending
  
                this.candleSeries.setData(merged);
              }
            });
        }
      }
    };
  
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChanged);
  }
}
