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
  readonly agreementVersion = '2026-08-19';
  readonly agreementSections = [
    { title: 'Eligibility and authorized drivers.', body: 'Renter confirms that they meet the disclosed minimum rental age, hold a current driver’s license valid for the vehicle, and will present it before receiving the vehicle. Only Renter and drivers approved in writing by Owner may drive. Renter is responsible for every authorized driver’s compliance.' },
    { title: 'Rental period and return.', body: 'The rental begins and ends at the dates, times, and location shown in the booking. Renter will return the vehicle, keys, documents, and accessories on time and in the condition received, ordinary wear excepted. An extension requires Owner’s prior approval and may incur additional charges.' },
    { title: 'Charges and payment authorization.', body: 'Renter will pay the displayed rental price, taxes, selected extras, and other lawful amounts arising from the rental, including approved extension, late-return, missing fuel or charge, excessive cleaning, smoking remediation, lost key, toll, citation, impound, and damage charges. Renter authorizes Owner to charge the payment method on file after providing an itemization where required by law.' },
    { title: 'Vehicle use.', body: 'The vehicle must be driven carefully and lawfully. It may not be used by an unauthorized or unlicensed driver; while impaired; for racing, speed testing, driver training, towing, pushing, off-road use, unlawful activity, carrying hazardous materials, or transporting persons or property for hire; or outside the permitted rental area without written approval. Seat belts and child-restraint laws must be followed.' },
    { title: 'Fuel, charging, mileage, tolls, and citations.', body: 'Renter will return the vehicle with the same fuel or battery level recorded at handover. Any mileage limit separately disclosed in the booking applies; if none is disclosed, no additional mileage limit applies. Renter is responsible for tolls, parking charges, traffic or camera violations, and related lawful administration fees incurred during the rental.' },
    { title: 'Condition, loss, and damage.', body: 'Renter will inspect the vehicle at handover, promptly report existing damage, secure the vehicle, and take reasonable steps to prevent loss. To the extent permitted by law, Renter is responsible for loss of or damage to the vehicle during the rental, towing, storage, loss of use, and reasonable recovery costs, subject to applicable law and any protection plan expressly selected in the booking. A protection plan is subject to its stated limits and exclusions and is not a substitute for legally required insurance.' },
    { title: 'Accidents, theft, and breakdowns.', body: 'Renter must stop safely, contact emergency services when appropriate, notify Owner as soon as possible, cooperate with police and insurers, obtain relevant party and witness information, and not admit fault or arrange repairs without approval. For a breakdown, Renter must stop using the vehicle when continued use could cause damage and contact Owner for instructions.' },
    { title: 'Insurance.', body: 'Renter and each authorized driver must maintain any motor-vehicle insurance required by applicable law. Owner provides only the insurance or protection expressly identified in the booking documents. Renter will cooperate with any claim investigation.' },
    { title: 'Cancellation, no-show, and late return.', body: 'The cancellation and refund terms presented at booking or in the confirmation apply. Failure to collect the vehicle, or returning it late without approval, may result in cancellation or additional charges. Renter must contact Owner immediately if the return will be late.' },
    { title: 'Default and recovery.', body: 'Owner may end the rental and recover the vehicle, where lawful and without breaching the peace, if Renter materially violates this Agreement, obtained the vehicle through fraud, abandons it, or uses it in a way that threatens safety or the vehicle.' },
    { title: 'Liability and indemnity.', body: 'Each party remains responsible to the extent required by applicable law. To the extent lawful, Renter will reimburse Owner for third-party claims, losses, and expenses caused by Renter’s or an authorized driver’s breach, negligence, or unlawful use. Nothing in this Agreement excludes liability that cannot legally be excluded.' },
    { title: 'Privacy and vehicle data.', body: 'Owner may use booking, identity, payment-reference, location, telematics, and vehicle-condition data to provide the rental, protect people and property, prevent fraud, recover the vehicle, process claims, and comply with law, in accordance with the applicable privacy notice.' },
    { title: 'General terms.', body: 'This Agreement, the booking summary, the vehicle condition record, and any signed addenda form the entire agreement. If a provision is unenforceable, the remainder stays effective. Applicable law and the competent courts where Owner principally operates govern, unless consumer law requires otherwise. Changes must be agreed in writing, including electronically.' },
    { title: 'Electronic consent.', body: 'By checking the acceptance box, Renter confirms they had an opportunity to read this Agreement, the booking information is accurate, and their electronic acceptance is intended as a signature.' },
  ];
  readonly agreementAccepted = signal(false);
  readonly agreementAcceptedAt = signal('');
  readonly downloadingAgreement = signal(false);
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
  readonly canBook = computed(() => this.datesComplete() && this.availabilityChecked() && this.selectedVehicleAvailable() && this.locationReady() && this.formValid() && this.agreementAccepted() && this.paymentReady() && this.cardComplete());
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
    this.customerForm.valueChanges.subscribe(() => this.invalidateAgreement());
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
    this.invalidateAgreement();
  }
  selectFulfillment(mode: 'pickup' | 'delivery'): void {
    this.fulfillmentMode.set(mode);
    this.deliveryError.set('');
    if (mode === 'pickup' && !this.pickupOptions().includes(this.pickupLocation())) {
      this.pickupLocation.set(this.pickupOptions()[0] ?? '');
    }
    this.invalidateAgreement();
  }
  selectPickupLocation(location: string): void {
    this.pickupLocation.set(location);
    this.invalidateAgreement();
  }
  deliveryAddressChanged(address: string): void {
    this.deliveryAddress.set(address);
    this.resetDeliveryCheck();
    this.invalidateAgreement();
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
      this.invalidateAgreement();
    } catch (error) {
      this.deliveryError.set(this.data.errorMessage(error));
    } finally {
      this.deliveryChecking.set(false);
    }
  }
  updateStartDate(date: Date | null): void {
    this.startDate.set(date);
    this.invalidateAgreement();
    this.syncBookingDatesInUrl();
    void this.refreshAvailability();
  }
  updateEndDate(date: Date | null): void {
    this.endDate.set(date);
    this.invalidateAgreement();
    this.syncBookingDatesInUrl();
    void this.refreshAvailability();
  }
  updateStartTime(time: string): void {
    this.startTime.set(time);
    this.invalidateAgreement();
    this.syncBookingDatesInUrl();
    void this.refreshAvailability();
  }
  updateEndTime(time: string): void {
    this.endTime.set(time);
    this.invalidateAgreement();
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
  updateCoverage(checked: boolean): void {
    this.coverage.set(checked);
    this.invalidateAgreement();
  }
  setAgreementAccepted(checked: boolean): void {
    this.agreementAccepted.set(checked);
    this.agreementAcceptedAt.set(checked ? new Date().toISOString() : '');
  }
  async downloadAgreementPdf(): Promise<void> {
    this.downloadingAgreement.set(true);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 48;
      const contentWidth = pageWidth - margin * 2;
      let y = 54;
      const safeText = (value: string) => value
        .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
      const addPageIfNeeded = (height: number) => {
        if (y + height <= pageHeight - 54) return;
        pdf.addPage();
        y = 54;
      };
      const addText = (value: string, size = 9, lineGap = 4) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(size);
        const lines = pdf.splitTextToSize(safeText(value), contentWidth) as string[];
        const height = lines.length * (size + lineGap);
        addPageIfNeeded(height);
        pdf.text(lines, margin, y);
        y += height;
      };
      const renter = `${this.customerForm.controls.firstName.value} ${this.customerForm.controls.lastName.value}`.trim() || 'Not yet provided';
      const location = this.fulfillmentMode() === 'delivery' ? this.deliveryAddress().trim() : this.pickupLocation();
      const acceptedAt = this.agreementAcceptedAt()
        ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(this.agreementAcceptedAt()))
        : 'Not yet accepted';
      pdf.setProperties({ title: 'Vehicle Rental Agreement', subject: `Agreement version ${this.agreementVersion}`, author: "Bill's Premiere" });
      pdf.setTextColor(22, 34, 54);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('VEHICLE RENTAL AGREEMENT', margin, y);
      y += 20;
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`BILL'S PREMIERE  |  VERSION ${this.agreementVersion}`, margin, y);
      y += 24;
      pdf.setDrawColor(219, 227, 237);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 18;
      pdf.setTextColor(71, 85, 105);
      addText(`Booking reference: ${this.confirmationId() || 'Draft - not yet booked'}\nRenter: ${renter}\nEmail: ${this.customerForm.controls.email.value || 'Not yet provided'}\nPhone: ${this.customerForm.controls.phone.value || 'Not yet provided'}\nVehicle: ${this.selectedVehicle().year} ${this.selectedVehicle().name} ${this.selectedVehicle().trim} (${this.selectedVehicle().plate})\nRental period: ${this.agreementRentalPeriod()}\n${this.fulfillmentMode() === 'delivery' ? 'Delivery and return collection' : 'Pickup and return'}: ${location || 'Not yet selected'}\nPremium coverage: ${this.coverage() ? 'Selected' : 'Not selected'}\nEstimated total: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(this.total())}\nAgreement status: ${this.agreementAccepted() ? 'Accepted electronically' : 'Draft'}\nAccepted by: ${this.agreementAccepted() ? renter : 'Not yet accepted'}\nAccepted at: ${acceptedAt}`, 9, 3);
      y += 12;
      addText(`This Vehicle Rental Agreement (the "Agreement") is between Bill's Premiere ("Owner") and ${renter} ("Renter"). The vehicle, rental period, pickup or delivery location, selected protection, and charges shown in this document and the booking confirmation are incorporated into this Agreement.`, 9, 4);
      y += 8;
      this.agreementSections.forEach((section, index) => {
        const body = `${index + 1}. ${section.title} ${section.body}`;
        addText(body, 8.5, 3.5);
        y += 6;
      });
      addPageIfNeeded(68);
      pdf.setDrawColor(148, 163, 184);
      pdf.line(margin, y + 24, margin + 210, y + 24);
      pdf.line(pageWidth - margin - 150, y + 24, pageWidth - margin, y + 24);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(this.agreementAccepted() ? safeText(renter) : 'Renter signature', margin, y + 38);
      pdf.text(this.agreementAccepted() ? safeText(acceptedAt) : 'Date', pageWidth - margin - 150, y + 38);
      const pageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page++) {
        pdf.setPage(page);
        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`Agreement ${this.agreementVersion}  |  Page ${page} of ${pageCount}`, pageWidth / 2, pageHeight - 24, { align: 'center' });
      }
      const filenamePart = (this.confirmationId() || renter || 'draft').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
      pdf.save(`rental-agreement-${filenamePart || 'draft'}.pdf`);
    } catch {
      this.snack.open('The rental agreement PDF could not be created.', 'Dismiss', { duration: 3500 });
    } finally {
      this.downloadingAgreement.set(false);
    }
  }
  async confirmBooking(): Promise<void> {
    const start = this.startDate(); const end = this.endDate();
    if (!start || !end || !this.canBook()) { this.snack.open('Complete every booking step and accept the rental agreement first.', 'Dismiss', { duration: 3000 }); return; }
    const startDate = this.formatDateTime(start, this.startTime())!;
    const endDate = this.formatDateTime(end, this.endTime())!;
    const customer = `${this.customerForm.controls.firstName.value} ${this.customerForm.controls.lastName.value}`;
    const agreement = {
      agreementAccepted: this.agreementAccepted(),
      agreementVersion: this.agreementVersion,
      agreementAcceptedAt: this.agreementAcceptedAt(),
      agreementAcceptedBy: customer.trim(),
    };
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
          ...agreement,
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
        ...agreement,
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
    this.invalidateAgreement();
    this.cardNumberElement?.clear();
    this.cardExpiryElement?.clear();
    this.cardCvcElement?.clear();
  }
  private resetDeliveryCheck(): void {
    this.deliveryDistance.set(null);
    this.verifiedDeliveryAddress.set('');
    this.deliveryError.set('');
  }
  private invalidateAgreement(): void {
    if (!this.agreementAccepted() && !this.agreementAcceptedAt()) return;
    this.agreementAccepted.set(false);
    this.agreementAcceptedAt.set('');
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
  private agreementRentalPeriod(): string {
    const start = this.combinedDateTime(this.startDate(), this.startTime());
    const end = this.combinedDateTime(this.endDate(), this.endTime());
    if (!start || !end) return 'Not yet selected';
    const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    return `${formatter.format(start)} - ${formatter.format(end)}`;
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
