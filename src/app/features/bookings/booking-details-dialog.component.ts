import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DataService } from '../../core/data.service';
import { Booking } from '../../core/models';
import { formatBookingPeriod } from '../../core/booking-date';

@Component({
  selector: 'app-booking-details-dialog',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, MatDialogModule, MatButtonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule, MatDatepickerModule],
  providers: [provideNativeDateAdapter()],
  templateUrl: './booking-details-dialog.component.html',
  styleUrl: './booking-details-dialog.component.scss',
})
export class BookingDetailsDialogComponent {
  booking = inject<Booking>(MAT_DIALOG_DATA);
  readonly data = inject(DataService);
  private readonly ref = inject(MatDialogRef<BookingDetailsDialogComponent>);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly refundRetry = signal(false);
  readonly form = new FormGroup({
    customer: new FormControl(this.booking.customer, { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    email: new FormControl(this.booking.email ?? '', { nonNullable: true, validators: [Validators.email, Validators.maxLength(254)] }),
    phone: new FormControl(this.booking.phone ?? '', { nonNullable: true, validators: Validators.maxLength(40) }),
    status: new FormControl(this.booking.status, { nonNullable: true }),
    vehicleId: new FormControl(this.booking.vehicleId ?? 0, { nonNullable: true }),
    startDate: new FormControl<Date | null>(this.parseDate(this.booking.startDate)),
    endDate: new FormControl<Date | null>(this.parseDate(this.booking.endDate)),
    startTime: new FormControl(this.booking.startDate?.slice(11, 16) || '10:00', { nonNullable: true }),
    endTime: new FormControl(this.booking.endDate?.slice(11, 16) || '10:00', { nonNullable: true }),
    fulfillmentMode: new FormControl<'pickup' | 'delivery'>(this.booking.fulfillmentMode ?? 'pickup', { nonNullable: true }),
    pickupLocation: new FormControl(this.booking.pickupLocation ?? '', { nonNullable: true }),
    staffNotes: new FormControl(this.booking.staffNotes ?? '', { nonNullable: true, validators: Validators.maxLength(4000) }),
    cancellationReason: new FormControl(this.booking.cancellationReason ?? '', { nonNullable: true, validators: Validators.maxLength(1000) }),
  });
  readonly refundAmount = new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]);
  readonly refundReason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(1000)] });
  readonly refundConfirmed = new FormControl(false, { nonNullable: true });
  private refundRequestId = this.pendingRefund ? this.booking.refundOperation!.id : crypto.randomUUID();

  get period(): string { return formatBookingPeriod(this.booking); }
  get canReschedule(): boolean { return ['Pending', 'Confirmed'].includes(this.booking.status); }
  get statuses(): Booking['status'][] {
    const transitions: Record<Booking['status'], Booking['status'][]> = {
      Pending: ['Pending', 'Confirmed', 'Cancelled'], Confirmed: ['Confirmed', 'Active', 'Cancelled'],
      Active: ['Active', 'Completed'], Completed: ['Completed'], Cancelled: ['Cancelled'],
    };
    return transitions[this.booking.status];
  }
  get selectedVehicle() { return this.data.vehicles().find(vehicle => vehicle.id === this.form.controls.vehicleId.value); }
  get pickupLocations(): string[] { return [...new Set([this.selectedVehicle?.carLocation, ...(this.selectedVehicle?.pickupLocations ?? [])].filter((value): value is string => !!value))]; }
  get rentalChanged(): boolean {
    return ['vehicleId', 'startDate', 'endDate', 'startTime', 'endTime', 'fulfillmentMode', 'pickupLocation'].some(key => this.form.controls[key as keyof typeof this.form.controls].dirty);
  }
  get quotedTotal(): number {
    if (!this.rentalChanged) return this.booking.total;
    const value = this.form.getRawValue();
    const start = this.dateTime(value.startDate, value.startTime);
    const end = this.dateTime(value.endDate, value.endTime);
    if (!start || !end) return 0;
    const days = Math.ceil((new Date(`${end}Z`).getTime() - new Date(`${start}Z`).getTime()) / 86400000);
    return days > 0 && this.selectedVehicle ? Math.round(days * this.selectedVehicle.price * 100) / 100 : 0;
  }
  get paid(): number { return this.booking.paidAmount ?? (this.booking.paymentStatus === 'Paid' ? this.booking.total : 0); }
  get refundable(): number { return Math.max(0, this.paid - (this.booking.refundedAmount ?? 0)); }
  get balance(): number { return (this.form.controls.status.value === 'Cancelled' ? 0 : this.quotedTotal) - this.refundable; }
  get pendingRefund(): boolean { return !!this.booking.refundOperation && !['succeeded', 'failed', 'canceled'].includes(this.booking.refundOperation.status); }

  async save(): Promise<void> {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    if (!value.customer.trim()) { this.error.set('Customer name is required.'); return; }
    if (value.status === 'Cancelled' && !value.cancellationReason.trim()) { this.error.set('Enter a cancellation reason.'); return; }
    if (this.rentalChanged && (!this.canReschedule || !this.quotedTotal)) { this.error.set('Choose a vehicle and a valid rental period.'); return; }
    const rental = this.rentalChanged ? {
      vehicleId: value.vehicleId, startDate: this.dateTime(value.startDate, value.startTime), endDate: this.dateTime(value.endDate, value.endTime),
      fulfillmentMode: value.fulfillmentMode, pickupLocation: value.pickupLocation, quotedTotal: this.quotedTotal,
    } : {};
    await this.run(async () => {
      this.booking = await this.data.updateBooking({ ...this.booking, ...rental,
        customer: value.customer.trim(), email: value.email.trim(), phone: value.phone.trim(),
        status: value.status, staffNotes: value.staffNotes, cancellationReason: value.cancellationReason,
      });
      this.resetForm();
      this.message.set('Booking saved.');
    });
  }

  async refresh(): Promise<void> {
    await this.run(async () => {
      await this.data.loadStaffData();
      const current = this.data.bookings().find(item => item.id === this.booking.id);
      if (!current) throw new Error('The booking no longer exists.');
      this.booking = current;
      this.resetForm();
      this.refundRequestId = this.pendingRefund ? this.booking.refundOperation!.id : crypto.randomUUID();
      this.refundRetry.set(false);
      this.refundAmount.enable(); this.refundReason.enable();
      this.refundConfirmed.setValue(false);
      this.message.set('Booking refreshed.');
    });
  }

  async refund(): Promise<void> {
    if (this.busy() || this.form.dirty) return;
    if (!this.pendingRefund && (!this.refundConfirmed.value || this.refundAmount.invalid || this.refundReason.invalid || !this.refundReason.value.trim())) return;
    const operation = this.pendingRefund ? this.booking.refundOperation : undefined;
    this.refundAmount.disable(); this.refundReason.disable();
    this.refundRetry.set(true);
    await this.run(async () => {
      this.booking = await this.data.refundBooking(this.booking, operation?.amount ?? this.refundAmount.value!, operation?.reason ?? this.refundReason.value.trim(), operation?.id ?? this.refundRequestId);
      this.resetForm();
      this.refundConfirmed.setValue(false);
      this.message.set(`Refund ${this.booking.refundOperation?.status ?? 'submitted'}.`);
      if (!this.pendingRefund) {
        this.refundRetry.set(false);
        this.refundAmount.enable(); this.refundReason.enable();
        this.refundRequestId = crypto.randomUUID();
        this.refundAmount.reset();
        this.refundReason.reset();
      }
    });
  }

  private resetForm(): void {
    this.form.reset({ customer: this.booking.customer, email: this.booking.email ?? '', phone: this.booking.phone ?? '',
      status: this.booking.status, vehicleId: this.booking.vehicleId ?? 0,
      startDate: this.parseDate(this.booking.startDate), endDate: this.parseDate(this.booking.endDate),
      startTime: this.booking.startDate?.slice(11, 16) || '10:00', endTime: this.booking.endDate?.slice(11, 16) || '10:00',
      fulfillmentMode: this.booking.fulfillmentMode ?? 'pickup', pickupLocation: this.booking.pickupLocation ?? '',
      staffNotes: this.booking.staffNotes ?? '', cancellationReason: this.booking.cancellationReason ?? '',
    });
  }

  private parseDate(value: string | undefined): Date | null {
    const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  }

  private dateTime(date: Date | null, time: string): string {
    if (!date || Number.isNaN(date.getTime()) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${time}`;
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.message.set(''); this.ref.disableClose = true;
    try { await action(); } catch (error) { this.error.set(this.data.errorMessage(error)); }
    finally { this.busy.set(false); this.ref.disableClose = false; }
  }
}
