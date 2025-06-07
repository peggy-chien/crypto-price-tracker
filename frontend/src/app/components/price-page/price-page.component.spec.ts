import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PricePageComponent } from './price-page.component';

describe('PricePageComponent', () => {
  let component: PricePageComponent;
  let fixture: ComponentFixture<PricePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PricePageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PricePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
