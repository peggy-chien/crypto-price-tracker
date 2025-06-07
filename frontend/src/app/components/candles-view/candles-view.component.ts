import { ChangeDetectionStrategy, Component, Input, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { createChart, IChartApi, CandlestickData, UTCTimestamp, TimeChartOptions, DeepPartial, ColorType, CandlestickSeries } from 'lightweight-charts';
import { CandlesService } from '../../services/candles.service';
import { BinanceWebsocketService } from '../../services/binance-websocket.service';

@Component({
  selector: 'app-candles-view',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './candles-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CandlesViewComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() symbol!: string;
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;
  private chart: IChartApi | undefined;
  private candleSeries: any;
  private candlesService = inject(CandlesService);
  private binanceWs = inject(BinanceWebsocketService);

  private lastClose: number | null = null;
  private prevClose: number | null = null;
  private earliestCandleTime: number | null = null;
  private loadingMore = false;
  private candles: CandlestickData[] = [];

  intervals = [
    { label: '1m', value: '1m' },
    { label: '30m', value: '30m' },
    { label: '1h', value: '1h' },
    { label: '1d', value: '1d' }
  ];
  selectedInterval = signal<string>('1m');

  async ngAfterViewInit() {
    this.binanceWs.subscribeToPair(this.symbol);
    this.initChart();
    await this.loadCandles();
    this.subscribeToKlines();
    this.setupLazyLoading();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['symbol'] && !changes['symbol'].firstChange) {
      this.binanceWs.subscribeToPair(this.symbol);
      this.resetChart();
      this.initChart();
      this.loadCandles();
      this.subscribeToKlines();
    }
  }

  async onIntervalChange(interval: string) {
    this.selectedInterval.set(interval);
    this.candlesService.setInterval(interval);
    this.candlesService.close();
    this.resetChart();
    this.initChart();
    this.loadCandles();
    this.subscribeToKlines();
  }

  private initChart() {
    const chartOptions: DeepPartial<TimeChartOptions> = {
      layout: { textColor: 'black', background: { type: ColorType.Solid, color: 'white' } },
      timeScale: {
        tickMarkFormatter: (timestamp: number) => {
          const date = new Date(timestamp * 1000);
          if (date.getHours() === 0 && date.getMinutes() === 0) {
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

  private setupLazyLoading() {
    if (!this.chart) return;
    this.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range || this.loadingMore) return;
      if (range.from < 10 && this.earliestCandleTime) {
        this.loadingMore = true;
        this.candlesService.fetchHistoricalCandlesBefore(
          this.symbol,
          this.selectedInterval(),
          this.earliestCandleTime * 1000 // Binance expects ms
        ).subscribe(candles => {
          if (candles.length > 0) {
            // Merge, deduplicate, and sort by time ascending
            const allCandles = [
              ...candles,
              ...this.candles
            ];
            const deduped = Array.from(
              new Map(allCandles.map(c => [c.time, c])).values()
            ).sort((a, b) => Number(a.time) - Number(b.time));
            this.candles = deduped;
            this.candleSeries.setData(this.candles);
            this.earliestCandleTime = Number(this.candles[0].time);
          }
          this.loadingMore = false;
        }, () => {
          this.loadingMore = false;
        });
      }
    });
  }

  private loadCandles() {
    if (!this.symbol) return;
    this.candlesService.fetchHistoricalCandles(this.symbol, this.selectedInterval()).subscribe(candles => {
      this.candles = candles;
      this.candleSeries?.setData(this.candles);
      if (candles.length > 1) {
        this.prevClose = candles[candles.length - 2].close;
        this.lastClose = candles[candles.length - 1].close;
        this.earliestCandleTime = Number(candles[0].time);
      } else if (candles.length === 1) {
        this.prevClose = null;
        this.lastClose = candles[0].close;
        this.earliestCandleTime = Number(candles[0].time);
      } else {
        this.prevClose = null;
        this.lastClose = null;
        this.earliestCandleTime = null;
      }
    });
  }

  private subscribeToKlines() {
    if (!this.symbol) return;
    this.candlesService.subscribeToLiveKlines(this.symbol, (candle) => {
      if (this.lastClose !== null) {
        this.prevClose = this.lastClose;
      }
      this.lastClose = candle.close;
      this.candleSeries?.update(candle);
    }, this.selectedInterval());
  }

  private resetChart() {
    if (this.chart) {
      this.chart.remove();
      this.chart = undefined;
      this.candleSeries = undefined;
    }
    this.prevClose = null;
    this.lastClose = null;
  }

  ngOnDestroy() {
    this.binanceWs.close();
    this.resetChart();
  }

  get price(): number | null {
    const ticker = this.binanceWs.tradingPairs().find(t => t.symbol.toUpperCase() === this.symbol?.toUpperCase());
    return ticker ? ticker.price : null;
  }

  get change(): number | null {
    const ticker = this.binanceWs.tradingPairs().find(t => t.symbol.toUpperCase() === this.symbol?.toUpperCase());
    return ticker ? ticker.change : null;
  }

  get changePercentageColor(): string {
    if (this.change == null) return 'text-gray-900';
    return this.change > 0 ? 'text-green-600' : this.change < 0 ? 'text-red-600' : 'text-gray-900';
  }

  get priceColor(): string {
    if (this.lastClose == null || this.prevClose == null) return 'text-gray-900';
    if (this.lastClose > this.prevClose) return 'text-green-600';
    if (this.lastClose < this.prevClose) return 'text-red-600';
    return 'text-gray-900';
  }
}
