import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import { BookingDetailsDialogComponent } from './booking-details-dialog.component';
import { DataService } from '../../core/data.service';
import { Booking } from '../../core/models';

describe('Booking management', () => {
  let booking: Booking;
  let data: { vehicles: ReturnType<typeof signal<any[]>>; updateBooking: ReturnType<typeof vi.fn>; refundBooking: ReturnType<typeof vi.fn>; errorMessage: (error: Error) => string };
  let dialog: BookingDetailsDialogComponent;

  beforeEach(() => {
    booking = { id: 'BK-TEST', customer: 'Test Customer', email: 'test@example.com', vehicle: 'Car', vehicleId: 1,
      startDate: '2026-10-01T10:00', endDate: '2026-10-03T10:00', period: '', total: 100, status: 'Confirmed', paymentStatus: 'Paid', paymentIntentId: 'pi_test' };
    data = { vehicles: signal([{ id: 1, price: 50 }]), updateBooking: vi.fn(), refundBooking: vi.fn(), errorMessage: error => error.message };
    TestBed.configureTestingModule({ providers: [
      { provide: MAT_DIALOG_DATA, useValue: booking }, { provide: DataService, useValue: data },
      { provide: MatDialogRef, useValue: { disableClose: false } },
    ] });
    dialog = TestBed.runInInjectionContext(() => new BookingDetailsDialogComponent());
  });

  it('saves contact edits without inventing missing rental values', async () => {
    data.updateBooking.mockResolvedValue({ ...booking, customer: 'Updated Customer' });
    dialog.form.controls.customer.setValue('Updated Customer');
    await dialog.save();
    const saved = data.updateBooking.mock.calls[0][0];
    expect(saved.customer).toBe('Updated Customer');
    expect(saved.fulfillmentMode).toBeUndefined();
    expect(dialog.form.pristine).toBe(true);
  });

  it('quotes a reschedule and retains the amount actually paid', async () => {
    dialog.form.controls.endDate.setValue(new Date(2026, 9, 4));
    dialog.form.controls.endDate.markAsDirty();
    expect(dialog.quotedTotal).toBe(162);
    expect(dialog.balance).toBe(62);
    data.updateBooking.mockResolvedValue({ ...booking, total: 162, paidAmount: 100 });
    await dialog.save();
    expect(data.updateBooking.mock.calls[0][0].quotedTotal).toBe(162);
    expect(data.updateBooking.mock.calls[0][0].startDate).toBe('2026-10-01T10:00');
    expect(data.updateBooking.mock.calls[0][0].endDate).toBe('2026-10-04T10:00');
    expect(dialog.paid).toBe(100);
  });

  it('requires a cancellation reason', async () => {
    dialog.form.controls.status.setValue('Cancelled');
    await dialog.save();
    expect(data.updateBooking).not.toHaveBeenCalled();
    expect(dialog.error()).toContain('cancellation reason');
  });

  it('preserves edits when saving fails', async () => {
    data.updateBooking.mockRejectedValue(new Error('Vehicle is already booked'));
    dialog.form.controls.staffNotes.setValue('Keep this note');
    dialog.form.controls.staffNotes.markAsDirty();
    await dialog.save();
    expect(dialog.form.controls.staffNotes.value).toBe('Keep this note');
    expect(dialog.form.dirty).toBe(true);
    expect(dialog.error()).toBe('Vehicle is already booked');
    expect(dialog.busy()).toBe(false);
  });

  it('requires refund confirmation and keeps the same request ID after a network failure', async () => {
    dialog.refundAmount.setValue(25);
    dialog.refundReason.setValue('Customer request');
    await dialog.refund();
    expect(data.refundBooking).not.toHaveBeenCalled();
    dialog.refundConfirmed.setValue(true);
    data.refundBooking.mockRejectedValue(new Error('Network error'));
    await dialog.refund();
    await dialog.refund();
    expect(data.refundBooking.mock.calls[0][3]).toBe(data.refundBooking.mock.calls[1][3]);
  });
});
