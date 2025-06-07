import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CandlesViewComponent } from './candles-view.component';

describe('CandlesViewComponent', () => {
  let component: CandlesViewComponent;
  let fixture: ComponentFixture<CandlesViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandlesViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CandlesViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
