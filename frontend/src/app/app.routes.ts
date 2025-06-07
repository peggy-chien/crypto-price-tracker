import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'trading-pair' },
  {
    path: 'trading-pair',
    loadComponent: () => import('./components/trading-pair-page/trading-pair-page.component').then(m => m.TradingPairPageComponent)
  },
  {
    path: 'price/:symbol',
    loadComponent: () => import('./components/price-page/price-page.component').then(m => m.PricePageComponent)
  }
];
