import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy, signal, Signal, computed } from '@angular/core';
import { TradingPairComponent } from '../trading-pair/trading-pair.component';
import { CommonModule } from '@angular/common';
import { BinanceWebsocketService } from '../../services/binance-websocket.service';
import { Router } from '@angular/router';
import { SymbolService } from '../../services/symbol.service';

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
  private symbolService = inject(SymbolService);
  pairs = signal<string[]>([]);
  tradingPairs: Signal<any[]> = computed(() => this.binanceWs.subscribeToTickers(this.pairs())());

  ngOnInit() {
    this.symbolService.getFavorites().subscribe(favs => {
      this.pairs.set([...favs]);
    });
  }

  ngOnDestroy() {
    this.binanceWs.unsubscribeFromTickers();
  }

  onSelect(symbol: string) {
    this.router.navigate(['/price', symbol]);
  }
}
