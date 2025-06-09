import { ChangeDetectionStrategy, Component, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderBookService } from '../../services/order-book.service';
import { OrderBook, OrderBookEntry } from '../../models/order-book.model';
import { Layout } from '../../models/layout.type';

interface OrderBookRow {
  price: number;
  quantity: number;
  total: number;
  sum: number;
}

@Component({
  selector: 'app-order-book',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-book.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderBookComponent implements OnInit, OnDestroy {
  @Input() symbol!: string;
  @Input() layout: Layout = 'horizontal';
  private orderBookService = inject(OrderBookService);
  orderBook$ = this.orderBookService.orderBook$;
  levels = 15;

  ngOnInit(): void {
    this.orderBookService.connect(this.symbol);
  }

  ngOnDestroy(): void {
    this.orderBookService.disconnect();
  }

  // Helper to process order book side (bids or asks)
  processSide(entries: OrderBookEntry[], levels: number): OrderBookRow[] {
    let sum = 0;
    return entries.slice(0, levels).map(entry => {
      const total = entry.price * entry.quantity;
      sum += total;
      return {
        price: entry.price,
        quantity: entry.quantity,
        total,
        sum
      };
    });
  }

  // Helper to get max sum for bar scaling
  getMaxSum(rows: OrderBookRow[]): number {
    return rows.length ? Math.max(...rows.map(r => r.sum)) : 1;
  }

  getSpread(orderBook: OrderBook): number | null {
    if (orderBook.asks.length && orderBook.bids.length) {
      return orderBook.asks[0].price - orderBook.bids[0].price;
    }
    return null;
  }

  getMaxQuantity(rows: OrderBookRow[]): number {
    return rows.length ? Math.max(...rows.map(r => r.quantity)) : 1;
  }
}
