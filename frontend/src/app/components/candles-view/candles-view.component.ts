import { ChangeDetectionStrategy, Component, Input, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject, signal, effect, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CandlestickData } from 'lightweight-charts';
import { CandlesService } from '../../services/candles.service';
import { BinanceWebsocketService } from '../../services/binance-websocket.service';
import { TradingPairTicker } from '../../models/trading-pair-ticker.model';
import { CandleInterval } from '../../models/candle-interval.type';
import { BehaviorSubject, combineLatest, switchMap, catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChartService } from '../../services/chart.service';

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
  error = signal<string | null>(null);
  private candlesService = inject(CandlesService);
  private binanceWs = inject(BinanceWebsocketService);
  private chartService = inject(ChartService);
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
    this.chartService.setData(candles);
  });

  // Effect for error handling (log or toast)
  private errorEffectRef = effect(() => {
    const err = this.error();
    if (err) {
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
    if (!liveValue) return;
    const candles = this.candles();
    if (candles.length === 0) return;
    const last = candles[candles.length - 1];
    
    if (Number(liveValue.time) === Number(last.time) || Number(liveValue.time) > Number(last.time)) {
      this.chartService.updateCandle(liveValue);
    }
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
    this.chartService.initChart(this.chartContainer, this.selectedInterval());
    this.chartService.setupLazyLoading(this.symbol, this.selectedInterval());
  }

  // Reset chart and state
  private resetChart() {
    this.chartService.reset();
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
}
