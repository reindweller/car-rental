import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { vi } from 'vitest';
import { CustomerBookingComponent } from './customer-booking.component';
import { DataService } from '../../core/data.service';
import { environment } from '../../../environments/environment';

describe('Booking card fields', () => {
  const originalKey = environment.stripe.publishableKey;
  const originalStripe = window.Stripe;
  let elements: ReturnType<typeof makeElement>[];

  function makeElement() {
    const handlers = new Map<string, (event?: any) => void>();
    return {
      mount: vi.fn(), destroy: vi.fn(), clear: vi.fn(),
      on: (event: string, handler: (event?: any) => void) => { handlers.set(event, handler); },
      emit: (event: string, value?: any) => handlers.get(event)?.(value),
    };
  }

  beforeEach(async () => {
    elements = [];
    environment.stripe.publishableKey = 'pk_test_mock';
    window.Stripe = () => ({
      elements: () => ({ create: () => {
        const element = makeElement();
        elements.push(element);
        return element;
      } }),
      confirmCardPayment: vi.fn(),
    });
    await TestBed.configureTestingModule({
      imports: [CustomerBookingComponent],
      providers: [provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: DataService, useValue: { vehicles: () => [{ id: 1, status: 'Available', carLocation: 'Airport' }] } },
      ],
    }).overrideComponent(CustomerBookingComponent, { set: {
      template: '@if (!confirmationId()) { <div #cardNumberHost></div><div #cardExpiryHost></div><div #cardCvcHost></div> }',
    } }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    environment.stripe.publishableKey = originalKey;
    window.Stripe = originalStripe;
  });

  it('waits for all three secure fields to be ready', async () => {
    const fixture = TestBed.createComponent(CustomerBookingComponent);
    await fixture.whenStable();
    expect(elements).toHaveLength(3);
    expect(fixture.componentInstance.paymentReady()).toBe(false);
    elements[0].emit('ready');
    elements[1].emit('ready');
    expect(fixture.componentInstance.paymentReady()).toBe(false);
    elements[2].emit('ready');
    expect(fixture.componentInstance.paymentReady()).toBe(true);
    expect(elements[0].mount.mock.calls[0][0].isConnected).toBe(true);
  });

  it('shows load failures and recreates the fields on retry', async () => {
    const fixture = TestBed.createComponent(CustomerBookingComponent);
    await fixture.whenStable();
    elements[0].emit('loaderror', { error: { message: 'Unable to load card input' } });
    elements.forEach(element => element.emit('ready'));
    expect(fixture.componentInstance.paymentReady()).toBe(false);
    expect(fixture.componentInstance.paymentError()).toBe('Unable to load card input');
    fixture.componentInstance.retryPayment();
    await fixture.whenStable();
    expect(elements).toHaveLength(6);
    expect(elements[0].destroy).toHaveBeenCalledOnce();
    elements.slice(3).forEach(element => element.emit('ready'));
    expect(fixture.componentInstance.paymentReady()).toBe(true);
    expect(fixture.componentInstance.paymentError()).toBe('');
  });

  it('remounts into new hosts when booking another car', async () => {
    const fixture = TestBed.createComponent(CustomerBookingComponent);
    await fixture.whenStable();
    fixture.componentInstance.confirmationId.set('booking-test');
    await fixture.whenStable();
    expect(elements[0].destroy).toHaveBeenCalledOnce();
    fixture.componentInstance.bookAnother();
    await fixture.whenStable();
    expect(elements).toHaveLength(6);
    expect(elements[3].mount.mock.calls[0][0].isConnected).toBe(true);
    expect(fixture.componentInstance.paymentReady()).toBe(false);
  });
});
