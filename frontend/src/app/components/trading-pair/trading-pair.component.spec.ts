import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TradingPairComponent } from './trading-pair.component';

describe('TradingPairComponent', () => {
  let component: TradingPairComponent;
  let fixture: ComponentFixture<TradingPairComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TradingPairComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TradingPairComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
