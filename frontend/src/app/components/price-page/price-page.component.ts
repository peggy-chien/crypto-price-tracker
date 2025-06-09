import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy, HostListener, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CandlesViewComponent } from '../candles-view/candles-view.component';
import { OrderBookComponent } from '../order-book/order-book.component';
import { ActivatedRoute } from '@angular/router';
import { BreadcrumbsComponent } from '../breadcrumbs/breadcrumbs.component';

@Component({
  selector: 'app-price-page',
  standalone: true,
  imports: [CommonModule, CandlesViewComponent, OrderBookComponent, BreadcrumbsComponent],
  templateUrl: './price-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PricePageComponent implements OnInit, OnDestroy {
  @Input() symbol!: string;
  isWideScreen = window.innerWidth >= 1024;
  private route = inject(ActivatedRoute);

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.symbol = params['symbol'];
    });
  }

  ngOnDestroy() {}

  @HostListener('window:resize')
  onResize() {
    this.isWideScreen = window.innerWidth >= 1024;
  }
}
