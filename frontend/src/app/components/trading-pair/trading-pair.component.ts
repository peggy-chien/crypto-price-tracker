import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-trading-pair',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trading-pair.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradingPairComponent {
  @Input() symbol!: string;
  @Input() price!: number;
  @Input() change!: number;
  @Output() select = new EventEmitter<string>();
}
