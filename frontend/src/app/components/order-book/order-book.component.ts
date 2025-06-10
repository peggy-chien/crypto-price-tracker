import { ChangeDetectionStrategy, Component, Input, InputSignal, OnDestroy, OnInit, inject, signal, Signal } from '@angular/core';
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
  @Input({ required: true }) symbol!: string;
  @Input({ alias: 'layout' }) layoutSignal!: InputSignal<Layout>;

  private orderBookService = inject(OrderBookService);
  orderBookSignal: Signal<OrderBook | null> = signal<OrderBook | null>(null);
  readonly levels = 15;

  ngOnInit(): void {
    if (this.symbol) {
      this.orderBookSignal = this.orderBookService.subscribeToOrderBook(this.symbol);
    }
  }

  ngOnDestroy(): void {
    if (this.symbol) {
      this.orderBookService.unsubscribeFromOrderBook(this.symbol);
    }
  }

  // Helper to process order book side (bids or asks)
  processSide(entries: OrderBookEntry[], levels: number): OrderBookRow[] {
    let sum = 0;
    const rows: OrderBookRow[] = entries.slice(0, levels).map(entry => {
      const total = entry.price * entry.quantity;
      sum += total;
      return {
        price: entry.price,
        quantity: entry.quantity,
        total,
        sum
      };
    });
    // Pad with empty rows if needed
    while (rows.length < levels) {
      rows.push({ price: 0, quantity: 0, total: 0, sum });
    }
    return rows;
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
