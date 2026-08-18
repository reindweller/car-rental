import { CurrencyPipe, DatePipe } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DataService } from '../../core/data.service';
import { Vehicle } from '../../core/models';
import { environment } from '../../../environments/environment';

interface StripeCardElement {
  mount(selector: string): void;
  clear(): void;
  destroy(): void;
  on(event: 'change', handler: (change: { complete: boolean; error?: { message: string } }) => void): void;
}

type StripeCardElementType = 'cardNumber' | 'cardExpiry' | 'cardCvc';

interface StripeInstance {
  elements(): { create(type: StripeCardElementType, options: object): StripeCardElement };
  confirmCardPayment(clientSecret: string, data: object): Promise<{
    error?: { message?: string };
    paymentIntent?: { id: string; status: string };
  }>;
}

declare global {
  interface Window { Stripe?: (publishableKey: string) => StripeInstance; }
}

@Component({
  selector: 'app-customer-booking',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, MatButtonModule, MatCheckboxModule, MatDatepickerModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSnackBarModule],
  providers: [provideNativeDateAdapter()],
  templateUrl: './customer-booking.component.html',
  styleUrl: './customer-booking.component.scss',
})
export class CustomerBookingComponent implements AfterViewInit, OnDestroy {
  private readonly data = inject(DataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  private readonly allAvailableVehicles = this.data.vehicles().filter(vehicle => vehicle.status === 'Available');
  private readonly requestedLocation = this.route.snapshot.queryParamMap.get('location') ?? '';
  private readonly requestedCategory = this.route.snapshot.queryParamMap.get('category') ?? '';
  private readonly matchingVehicles = this.allAvailableVehicles.filter(vehicle =>
    (!this.requestedCategory || vehicle.category === this.requestedCategory) &&
    (!this.requestedLocation || vehicle.carLocation === this.requestedLocation || vehicle.pickupLocations?.includes(this.requestedLocation))
  );
  readonly availableVehicles = this.matchingVehicles.length ? this.matchingVehicles : this.allAvailableVehicles;
  readonly minDate = new Date();
  readonly selectedVehicle = signal<Vehicle>(this.availableVehicles[0]);
  readonly startDate = signal<Date | null>(null);
  readonly endDate = signal<Date | null>(null);
  readonly startTime = signal('10:00');
  readonly endTime = signal('10:00');
  readonly pickupLocation = signal(this.requestedLocation);
  readonly fulfillmentMode = signal<'pickup' | 'delivery'>('pickup');
  readonly deliveryAddress = signal('');
  readonly deliveryChecking = signal(false);
  readonly deliveryError = signal('');
  readonly deliveryDistance = signal<number | null>(null);
  private readonly verifiedDeliveryAddress = signal('');
  readonly pickupOptions = computed(() => [...new Set([
    this.selectedVehicle().carLocation,
    ...(this.selectedVehicle().pickupLocations ?? []),
  ].filter((location): location is string => !!location))]);
  readonly locationReady = computed(() => this.fulfillmentMode() === 'pickup'
    ? this.pickupOptions().includes(this.pickupLocation())
    : !!this.deliveryAddress().trim() && this.verifiedDeliveryAddress() === this.deliveryAddress().trim() && this.deliveryDistance() !== null && this.deliveryDistance()! <= 20);
  readonly vehicleDetailQueryParams = computed<Params>(() => {
    const params: Params = {};
    const location = this.pickupLocation();
    const start = this.formatDateTime(this.startDate(), this.startTime());
    const end = this.formatDateTime(this.endDate(), this.endTime());
    if (location) params['location'] = location;
    if (start) params['start'] = start;
    if (end) params['end'] = end;
    if (this.requestedCategory) params['category'] = this.requestedCategory;
    return params;
  });
  readonly coverage = signal(true);
  readonly paymentReady = signal(false);
  readonly cardNumberComplete = signal(false);
  readonly cardExpiryComplete = signal(false);
  readonly cardCvcComplete = signal(false);
  readonly cardComplete = computed(() => this.cardNumberComplete() && this.cardExpiryComplete() && this.cardCvcComplete());
  readonly paymentError = signal('');
  readonly unavailableVehicleIds = signal<Set<number>>(new Set());
  readonly checkingAvailability = signal(false);
  readonly availabilityChecked = signal(false);
  readonly availabilityError = signal('');
  readonly submitting = signal(false);
  readonly confirmationId = signal('');
  readonly customerForm = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: Validators.required }),
    lastName: new FormControl('', { nonNullable: true, validators: Validators.required }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  readonly formValid = signal(this.customerForm.valid);
  readonly rentalDays = computed(() => {
    const start = this.combinedDateTime(this.startDate(), this.startTime());
    const end = this.combinedDateTime(this.endDate(), this.endTime());
    return start && end && end > start ? Math.ceil((end.getTime() - start.getTime()) / 86_400_000) : 0;
  });
  readonly datesComplete = computed(() => this.rentalDays() > 0);
  readonly dateError = computed(() => {
    const start = this.combinedDateTime(this.startDate(), this.startTime());
    const end = this.combinedDateTime(this.endDate(), this.endTime());
    if ((this.startDate() && !start) || (this.endDate() && !end)) return 'Select both a pick-up time and a return time.';
    if ((start && !end) || (!start && end)) return 'Select both a pick-up date and a return date.';
    const currentMinute = new Date();
    currentMinute.setSeconds(0, 0);
    if (start && start < currentMinute) return 'Pick-up date and time cannot be in the past.';
    if (start && end && end <= start) return 'Return date and time must be after the pick-up date and time.';
    return '';
  });
  readonly basePrice = computed(() => this.selectedVehicle().price * this.rentalDays());
  readonly coveragePrice = computed(() => this.coverage() ? 18 * this.rentalDays() : 0);
  readonly taxes = computed(() => (this.basePrice() + this.coveragePrice()) * 0.08);
  readonly total = computed(() => this.basePrice() + this.coveragePrice() + this.taxes());
  readonly selectedVehicleAvailable = computed(() => !this.unavailableVehicleIds().has(this.selectedVehicle().id));
  readonly availableVehicleCount = computed(() => this.availableVehicles.filter(vehicle => this.isVehicleAvailable(vehicle)).length);
  readonly canBook = computed(() => this.datesComplete() && this.availabilityChecked() && this.selectedVehicleAvailable() && this.locationReady() && this.formValid() && this.paymentReady() && this.cardComplete());
  private stripe: StripeInstance | null = null;
  private cardNumberElement: StripeCardElement | null = null;
  private cardExpiryElement: StripeCardElement | null = null;
  private cardCvcElement: StripeCardElement | null = null;
  private paidPaymentIntentId = '';
  private availabilityRequest = 0;

  constructor() {
    const requestedId = Number(this.route.snapshot.queryParamMap.get('vehicle'));
    const requested = this.availableVehicles.find(vehicle => vehicle.id === requestedId);
    if (requested) this.selectedVehicle.set(requested);
    const parseDateTime = (value: string | null): { date: Date; time: string } | null => {
      const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/);
      if (!match) return null;
      const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return Number.isNaN(parsed.getTime()) ? null : { date: parsed, time: match[4] ?? '10:00' };
    };
    const requestedStart = parseDateTime(this.route.snapshot.queryParamMap.get('start'));
    const requestedEnd = parseDateTime(this.route.snapshot.queryParamMap.get('end'));
    const today = new Date(this.minDate.getFullYear(), this.minDate.getMonth(), this.minDate.getDate());
    if (requestedStart && requestedStart.date >= today) {
      this.startDate.set(requestedStart.date);
      this.startTime.set(requestedStart.time);
    }
    if (requestedEnd && requestedStart && this.combinedDateTime(requestedEnd.date, requestedEnd.time)! > this.combinedDateTime(requestedStart.date, requestedStart.time)!) {
      this.endDate.set(requestedEnd.date);
      this.endTime.set(requestedEnd.time);
    }
    if (!this.pickupOptions().includes(this.pickupLocation())) this.pickupLocation.set(this.pickupOptions()[0] ?? '');
    if (!this.pickupOptions().length) this.fulfillmentMode.set('delivery');
    this.customerForm.statusChanges.subscribe(() => this.formValid.set(this.customerForm.valid));
  }

  ngAfterViewInit(): void {
    this.initializePayment();
    void this.refreshAvailability();
  }

  ngOnDestroy(): void {
    this.cardNumberElement?.destroy();
    this.cardExpiryElement?.destroy();
    this.cardCvcElement?.destroy();
  }

  selectVehicle(vehicle: Vehicle): void {
    if (!this.isVehicleAvailable(vehicle)) return;
    this.selectedVehicle.set(vehicle);
    const locations = [vehicle.carLocation, ...(vehicle.pickupLocations ?? [])].filter((location): location is string => !!location);
    this.pickupLocation.set(locations[0] ?? '');
    this.fulfillmentMode.set(locations.length ? 'pickup' : 'delivery');
    this.resetDeliveryCheck();
  }
  selectFulfillment(mode: 'pickup' | 'delivery'): void {
    this.fulfillmentMode.set(mode);
    this.deliveryError.set('');
    if (mode === 'pickup' && !this.pickupOptions().includes(this.pickupLocation())) {
      this.pickupLocation.set(this.pickupOptions()[0] ?? '');
    }
  }
  selectPickupLocation(location: string): void {
    this.pickupLocation.set(location);
  }
  deliveryAddressChanged(address: string): void {
    this.deliveryAddress.set(address);
    this.resetDeliveryCheck();
  }
  async checkDeliveryAddress(): Promise<void> {
    const address = this.deliveryAddress().trim();
    if (address.length < 8) {
      this.deliveryError.set('Enter a complete delivery address.');
      return;
    }
    this.deliveryChecking.set(true);
    this.deliveryError.set('');
    try {
      const result = await this.data.checkDelivery(this.selectedVehicle().id, address);
      this.deliveryDistance.set(result.distanceMiles);
      if (!result.eligible) {
        this.deliveryError.set(`This address is ${result.distanceMiles.toFixed(1)} miles away. Delivery is limited to ${result.maxDistanceMiles} miles.`);
        return;
      }
      this.deliveryAddress.set(result.address);
      this.verifiedDeliveryAddress.set(result.address);
      this.pickupLocation.set(result.address);
    } catch (error) {
      this.deliveryError.set(this.data.errorMessage(error));
    } finally {
      this.deliveryChecking.set(false);
    }
  }
  updateStartDate(date: Date | null): void {
    this.startDate.set(date);
    this.syncBookingDatesInUrl();
    void this.refreshAvailability();
  }
  updateEndDate(date: Date | null): void {
    this.endDate.set(date);
    this.syncBookingDatesInUrl();
    void this.refreshAvailability();
  }
  updateStartTime(time: string): void {
    this.startTime.set(time);
    this.syncBookingDatesInUrl();
    void this.refreshAvailability();
  }
  updateEndTime(time: string): void {
    this.endTime.set(time);
    this.syncBookingDatesInUrl();
    void this.refreshAvailability();
  }
  timeLabel(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hours, minutes));
  }
  isVehicleAvailable(vehicle: Vehicle): boolean {
    return !this.unavailableVehicleIds().has(vehicle.id);
  }
  async confirmBooking(): Promise<void> {
    const start = this.startDate(); const end = this.endDate();
    if (!start || !end || !this.canBook()) { this.snack.open('Complete your dates and contact details first.', 'Dismiss', { duration: 3000 }); return; }
    const startDate = this.formatDateTime(start, this.startTime())!;
    const endDate = this.formatDateTime(end, this.endTime())!;
    const customer = `${this.customerForm.controls.firstName.value} ${this.customerForm.controls.lastName.value}`;
    this.submitting.set(true);
    this.paymentError.set('');
    try {
      if (!this.stripe || !this.cardNumberElement) throw new Error('The secure payment form is not ready.');
      if (!this.paidPaymentIntentId) {
        const intent = await this.data.createPaymentIntent({
          vehicleId: this.selectedVehicle().id,
          startDate,
          endDate,
          coverage: this.coverage(),
          email: this.customerForm.controls.email.value,
          pickupLocation: this.fulfillmentMode() === 'delivery' ? this.deliveryAddress().trim() : this.pickupLocation(),
          fulfillmentMode: this.fulfillmentMode(),
        });
        const payment = await this.stripe.confirmCardPayment(intent.clientSecret, {
          payment_method: {
            card: this.cardNumberElement,
            billing_details: {
              name: customer,
              email: this.customerForm.controls.email.value,
              phone: this.customerForm.controls.phone.value,
            },
          },
        });
        if (payment.error) throw new Error(payment.error.message || 'Payment was declined.');
        if (payment.paymentIntent?.status !== 'succeeded') throw new Error('Payment did not complete.');
        this.paidPaymentIntentId = payment.paymentIntent.id;
      }
      const booking = await this.data.createBooking({
        customer,
        email: this.customerForm.controls.email.value,
        phone: this.customerForm.controls.phone.value,
        vehicleId: this.selectedVehicle().id,
        startDate,
        endDate,
        pickupLocation: this.pickupLocation(),
        fulfillmentMode: this.fulfillmentMode(),
        coverage: this.coverage(),
        paymentIntentId: this.paidPaymentIntentId,
      });
      this.confirmationId.set(booking.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment or booking could not be completed.';
      this.paymentError.set(message);
      this.snack.open(message, 'Dismiss', { duration: 4500 });
    } finally {
      this.submitting.set(false);
    }
  }
  bookAnother(): void {
    this.confirmationId.set('');
    this.startDate.set(null);
    this.endDate.set(null);
    this.startTime.set('10:00');
    this.endTime.set('10:00');
    this.customerForm.reset();
    this.fulfillmentMode.set(this.pickupOptions().length ? 'pickup' : 'delivery');
    this.pickupLocation.set(this.pickupOptions()[0] ?? '');
    this.deliveryAddress.set('');
    this.resetDeliveryCheck();
    this.paidPaymentIntentId = '';
    this.cardNumberElement?.clear();
    this.cardExpiryElement?.clear();
    this.cardCvcElement?.clear();
  }
  private resetDeliveryCheck(): void {
    this.deliveryDistance.set(null);
    this.verifiedDeliveryAddress.set('');
    this.deliveryError.set('');
  }
  private syncBookingDatesInUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        start: this.formatDateTime(this.startDate(), this.startTime()),
        end: this.formatDateTime(this.endDate(), this.endTime()),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  private formatDate(date: Date | null): string | null {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  private formatDateTime(date: Date | null, time: string): string | null {
    const datePart = this.formatDate(date);
    return datePart && time ? `${datePart}T${time}` : null;
  }
  private combinedDateTime(date: Date | null, time: string): Date | null {
    if (!date || !/^\d{2}:\d{2}$/.test(time)) return null;
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
  }
  private async refreshAvailability(): Promise<void> {
    const request = ++this.availabilityRequest;
    const start = this.formatDateTime(this.startDate(), this.startTime());
    const end = this.formatDateTime(this.endDate(), this.endTime());
    this.availabilityError.set('');
    this.availabilityChecked.set(false);
    if (!start || !end || this.dateError()) {
      this.unavailableVehicleIds.set(new Set());
      this.checkingAvailability.set(false);
      return;
    }
    this.checkingAvailability.set(true);
    try {
      const result = await this.data.checkAvailability(start, end);
      if (request !== this.availabilityRequest) return;
      this.unavailableVehicleIds.set(new Set(result.unavailableVehicleIds));
      this.availabilityChecked.set(true);
    } catch (error) {
      if (request !== this.availabilityRequest) return;
      this.unavailableVehicleIds.set(new Set());
      this.availabilityError.set(this.data.errorMessage(error));
    } finally {
      if (request === this.availabilityRequest) this.checkingAvailability.set(false);
    }
  }
  private async initializePayment(): Promise<void> {
    const publishableKey = environment.stripe.publishableKey;
    if (!publishableKey) {
      this.paymentError.set('Payment is not configured yet. Add Stripe test keys and redeploy the backend.');
      return;
    }
    try {
      await this.loadStripeJs();
      if (!window.Stripe) throw new Error('Stripe.js did not load.');
      this.stripe = window.Stripe(publishableKey);
      const elements = this.stripe.elements();
      const elementOptions = {
        style: {
          base: { color: '#162236', fontSize: '16px', fontFamily: 'Inter, Arial, sans-serif', '::placeholder': { color: '#94a3b8' } },
          invalid: { color: '#dc2626' },
        },
      };
      this.cardNumberElement = elements.create('cardNumber', { ...elementOptions, showIcon: true });
      this.cardExpiryElement = elements.create('cardExpiry', elementOptions);
      this.cardCvcElement = elements.create('cardCvc', elementOptions);
      this.cardNumberElement.mount('#card-number-element');
      this.cardExpiryElement.mount('#card-expiry-element');
      this.cardCvcElement.mount('#card-cvc-element');
      this.watchCardElement(this.cardNumberElement, this.cardNumberComplete);
      this.watchCardElement(this.cardExpiryElement, this.cardExpiryComplete);
      this.watchCardElement(this.cardCvcElement, this.cardCvcComplete);
      this.paymentReady.set(true);
    } catch (error) {
      this.paymentError.set(error instanceof Error ? error.message : 'The secure payment form could not load.');
    }
  }
  private watchCardElement(element: StripeCardElement, completeness: { set(value: boolean): void }): void {
    element.on('change', change => {
      completeness.set(change.complete);
      this.paymentError.set(change.error?.message ?? '');
    });
  }
  private loadStripeJs(): Promise<void> {
    if (window.Stripe) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.getElementById('stripe-js') as HTMLScriptElement | null;
      const script = existing ?? document.createElement('script');
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error('The secure payment form could not load.')), { once: true });
      if (!existing) {
        script.id = 'stripe-js';
        script.src = 'https://js.stripe.com/v3/';
        script.async = true;
        document.head.appendChild(script);
      }
    });
  }
}
