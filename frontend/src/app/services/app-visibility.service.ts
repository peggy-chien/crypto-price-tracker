import { Injectable, signal, Signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppVisibilityService {
  private visibleSignal = signal(!document.hidden);

  constructor() {
    document.addEventListener('visibilitychange', () => {
      this.visibleSignal.set(!document.hidden);
    });
  }

  get isVisible(): Signal<boolean> {
    return this.visibleSignal.asReadonly();
  }
} 