import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TradingPairPageComponent } from './trading-pair-page.component';

describe('TradingPairPageComponent', () => {
  let component: TradingPairPageComponent;
  let fixture: ComponentFixture<TradingPairPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TradingPairPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TradingPairPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
