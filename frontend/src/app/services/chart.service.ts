import { Injectable, ElementRef, OnDestroy, inject } from '@angular/core';
import { 
  createChart, 
  IChartApi, 
  TimeChartOptions, 
  DeepPartial, 
  ColorType, 
  CandlestickSeries, 
  CandlestickData, 
  IRange,
  LogicalRangeChangeEventHandler,
  ISeriesApi
} from 'lightweight-charts';
import { CandleInterval } from '../models/candle-interval.type';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, concatMap, finalize } from 'rxjs/operators';
import { CandlesService } from './candles.service';

export interface ChartConfig {
  upColor?: string;
  downColor?: string;
  borderVisible?: boolean;
  wickUpColor?: string;
  wickDownColor?: string;
  textColor?: string;
  backgroundColor?: string;
}

const DEFAULT_CONFIG: ChartConfig = {
  upColor: '#26a69a',
  downColor: '#ef5350',
  borderVisible: false,
  wickUpColor: '#26a69a',
  wickDownColor: '#ef5350',
  textColor: 'black',
  backgroundColor: 'white'
};

@Injectable({ providedIn: 'root' })
export class ChartService implements OnDestroy {
  private candlesService = inject(CandlesService);
  private chart: IChartApi | undefined;
  private candleSeries: ISeriesApi<"Candlestick"> | undefined;
  private loadingMore = false;
  private subscriptions: Subscription[] = [];
  private fetchRequest$ = new Subject<{ endTime: number | undefined }>();
  private config: ChartConfig = DEFAULT_CONFIG;

  /**
   * Set the chart configuration.
   * @param config Partial<ChartConfig>
   */
  setConfig(config: Partial<ChartConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (this.chart) {
      this.chart.applyOptions({
        layout: { 
          textColor: this.config.textColor, 
          background: { type: ColorType.Solid, color: this.config.backgroundColor! } 
        }
      });
    }
    if (this.candleSeries) {
      this.candleSeries.applyOptions({
        upColor: this.config.upColor,
        downColor: this.config.downColor,
        borderVisible: this.config.borderVisible,
        wickUpColor: this.config.wickUpColor,
        wickDownColor: this.config.wickDownColor
      });
    }
  }

  /**
   * Initialize the chart.
   * @param container ElementRef
   * @param interval CandleInterval
   */
  initChart(container: ElementRef, interval: CandleInterval) {
    try {
      const chartOptions: DeepPartial<TimeChartOptions> = {
        layout: { 
          textColor: this.config.textColor, 
          background: { type: ColorType.Solid, color: this.config.backgroundColor! } 
        },
        timeScale: {
          tickMarkFormatter: (timestamp: number) => {
            const date = new Date(timestamp * 1000);
            if (interval === '1d') {
              return date.toLocaleDateString('en-CA');
            } else if (date.getHours() === 0 && date.getMinutes() === 0) {
              return date.toLocaleDateString('en-CA');
            } else {
              return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
            }
          }
        }
      };
      this.chart = createChart(container.nativeElement, chartOptions);
      this.candleSeries = this.chart.addSeries(CandlestickSeries, { 
        upColor: this.config.upColor, 
        downColor: this.config.downColor, 
        borderVisible: this.config.borderVisible, 
        wickUpColor: this.config.wickUpColor, 
        wickDownColor: this.config.wickDownColor 
      });
      return this.candleSeries;
    } catch (error) {
      console.error('[ChartService] Failed to initialize chart:', error);
      throw error;
    }
  }

  /**
   * Setup lazy loading for the chart.
   * @param symbol Trading pair symbol (e.g., BTCUSDT)
   * @param interval CandleInterval
   */
  setupLazyLoading(symbol: string, interval: CandleInterval) {
    if (!this.chart || !this.candleSeries) {
      console.warn('[ChartService] Chart not initialized');
      return;
    }

    // Clean up any existing subscriptions
    this.cleanupSubscriptions();

    const subscription = this.fetchRequest$
      .pipe(
        debounceTime(100),
        concatMap(({ endTime: requestedEndTime }: { endTime: number | undefined }) => {
          this.loadingMore = true;
          return this.candlesService.fetchHistoricalCandles(symbol, interval, requestedEndTime)
            .pipe(
              finalize(() => this.loadingMore = false)
            );
        })
      )
      .subscribe({
        next: (newCandles: CandlestickData[]) => {
          if (newCandles && newCandles.length > 0) {
            try {
              const currentData = this.candleSeries?.data() as CandlestickData[] || [];
              const mergedMap = new Map<number, CandlestickData>();
              [...newCandles, ...currentData].forEach(candle => {
                mergedMap.set(Number(candle.time), candle);
              });
              const merged = Array.from(mergedMap.values())
                .sort((a, b) => Number(a.time) - Number(b.time));
              this.candleSeries?.setData(merged);
            } catch (error) {
              console.error('[ChartService] Failed to update chart data:', error);
            }
          }
        },
        error: (error) => {
          console.error('[ChartService] Failed to fetch historical candles:', error);
        }
      });

    this.subscriptions.push(subscription);

    const onVisibleLogicalRangeChanged: LogicalRangeChangeEventHandler = (newVisibleLogicalRange) => {
      if (!this.candleSeries || this.loadingMore || !newVisibleLogicalRange) return;
      try {
        const barsInfo = this.candleSeries.barsInLogicalRange(newVisibleLogicalRange as IRange<number>);
        if (!barsInfo) return;

        if (barsInfo.barsBefore < 50) {
          const currentData = this.candleSeries.data() as CandlestickData[];
          const earliest = currentData.length > 0 ? Number(currentData[0].time) * 1000 : undefined;
          if (earliest && !this.loadingMore) {
            this.fetchRequest$.next({ endTime: earliest - 1 });
          }
        }
      } catch (error) {
        console.error('[ChartService] Failed to handle visible range change:', error);
      }
    };

    this.chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChanged);
  }

  /**
   * Update a single candle.
   * @param candle CandlestickData
   */
  updateCandle(candle: CandlestickData) {
    if (!this.candleSeries) {
      console.warn('[ChartService] Chart not initialized');
      return;
    }
    try {
      this.candleSeries.update(candle);
    } catch (error) {
      console.error('[ChartService] Failed to update candle:', error);
    }
  }

  /**
   * Set the chart data.
   * @param data CandlestickData[]
   */
  setData(data: CandlestickData[]) {
    if (!this.candleSeries) {
      console.warn('[ChartService] Chart not initialized');
      return;
    }
    try {
      this.candleSeries.setData(data);
    } catch (error) {
      console.error('[ChartService] Failed to set chart data:', error);
    }
  }

  private cleanupSubscriptions() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  /**
   * Reset the chart.
   */
  reset() {
    this.cleanupSubscriptions();
    if (this.chart) {
      this.chart.remove();
      this.chart = undefined;
      this.candleSeries = undefined;
    }
  }

  ngOnDestroy() {
    this.reset();
  }
} 