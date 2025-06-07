import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy } from '@angular/core';
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
  tradingPairs = inject(BinanceWebsocketService).tradingPairs;
  private binanceWs = inject(BinanceWebsocketService);
  private router = inject(Router);

  ngOnInit() {
    this.binanceWs.subscribeToPairs(['btcusdt', 'ethusdt', 'solusdt', 'dogeusdt', 'bnbusdt', 'adausdt']);
  }

  ngOnDestroy() {
    this.binanceWs.close();
  }

  onSelect(symbol: string) {
    this.router.navigate(['/price', symbol]);
  }
}
