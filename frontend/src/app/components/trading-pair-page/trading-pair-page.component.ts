import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy, signal, Signal } from '@angular/core';
import { TradingPairComponent } from '../trading-pair/trading-pair.component';
import { CommonModule } from '@angular/common';
import { BinanceWebsocketService } from '../../services/binance-websocket.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-trading-pair-page',
  standalone: true,
  imports: [CommonModule, TradingPairComponent],
  templateUrl: './trading-pair-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradingPairPageComponent implements OnInit, OnDestroy {
  private binanceWs = inject(BinanceWebsocketService);
  private router = inject(Router);
  tradingPairs: Signal<any[]> = signal([]);
  private readonly pairs = ['btcusdt', 'ethusdt', 'solusdt', 'dogeusdt', 'bnbusdt', 'adausdt'];

  ngOnInit() {
    this.tradingPairs = this.binanceWs.subscribeToTickers(this.pairs);
  }

  ngOnDestroy() {
    this.binanceWs.unsubscribeFromTickers();
  }

  onSelect(symbol: string) {
    this.router.navigate(['/price', symbol]);
  }
}
