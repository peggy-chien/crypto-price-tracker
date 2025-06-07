import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BreadcrumbItem } from '../../models/breadcrumb.model';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink],
  templateUrl: './breadcrumbs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BreadcrumbsComponent {
  @Input() items: BreadcrumbItem[] = [];
}
