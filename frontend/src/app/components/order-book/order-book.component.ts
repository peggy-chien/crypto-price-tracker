import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-order-book',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-book.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderBookComponent {
  @Input() symbol!: string;
}
