import { Component, OnDestroy, computed, signal } from '@angular/core';
import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { DataService } from '../../core/data.service';
import { Booking } from '../../core/models';
import { formatBookingPeriod } from '../../core/booking-date';
import { BookingFilters, BookingFiltersDialogComponent } from './booking-filters-dialog.component';

@Component({
  selector: 'app-bookings',
  imports: [CurrencyPipe, NgTemplateOutlet, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSnackBarModule, MatTabsModule],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.scss',
})
export class BookingsComponent implements OnDestroy {
  readonly search = signal('');
  readonly tab = signal(0);
  readonly filters = signal<BookingFilters>({ status: 'All', startDate: '', endDate: '' });
  readonly exporting = signal(false);
  readonly activeFilterCount = computed(() => {
    const filters = this.filters();
    return Number(filters.status !== 'All') + Number(!!filters.startDate) + Number(!!filters.endDate);
  });
  private readonly now = signal(new Date());
  private readonly clock = window.setInterval(() => this.now.set(new Date()), 60_000);
  readonly stats = computed(() => {
    const now = this.now();
    const today = this.dateKey(now);
    const bookings = this.data.bookings();
    return [
      { label: 'Active rentals', value: bookings.filter(booking => this.isActiveAt(booking, now)).length, icon: 'key', bg: '#dbeafe' },
      { label: 'Pickups today', value: bookings.filter(booking => this.dateKey(booking.startDate) === today).length, icon: 'north_east', bg: '#dcfce7' },
      { label: 'Returns today', value: bookings.filter(booking => this.dateKey(booking.endDate) === today).length, icon: 'south_west', bg: '#fef3c7' },
    ];
  });
  readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    const filters = this.filters();
    const now = this.now();
    return this.data.bookings().filter(booking => {
      if (query && !`${booking.id} ${booking.customer} ${booking.vehicle}`.toLowerCase().includes(query)) return false;
      if (filters.status !== 'All' && booking.status !== filters.status) return false;
      if (this.tab() === 1 && !this.isActiveAt(booking, now)) return false;
      if (this.tab() === 2 && !this.isUpcoming(booking, now)) return false;

      const bookingStart = this.bookingTime(booking.startDate, false);
      const bookingEnd = this.bookingTime(booking.endDate, true);
      const filterStart = this.bookingTime(filters.startDate, false);
      const filterEnd = this.bookingTime(filters.endDate, true);
      if (filterStart !== null && (bookingEnd === null || bookingEnd < filterStart)) return false;
      if (filterEnd !== null && (bookingStart === null || bookingStart > filterEnd)) return false;
      return true;
    });
  });
  readonly bookingPeriod = formatBookingPeriod;
  constructor(readonly data: DataService, private readonly dialog: MatDialog, private readonly snack: MatSnackBar) {}

  openFilters(): void {
    const ref = this.dialog.open(BookingFiltersDialogComponent, {
      data: this.filters(), width: '550px', maxWidth: '94vw', autoFocus: 'first-tabbable',
    });
    ref.afterClosed().subscribe((filters?: BookingFilters) => {
      if (filters) this.filters.set(filters);
    });
  }

  async exportBookings(): Promise<void> {
    const bookings = this.filtered();
    if (!bookings.length) {
      this.snack.open('There are no bookings to export.', 'Dismiss', { duration: 2600 });
      return;
    }
    this.exporting.set(true);
    try {
      const XLSX = await import('xlsx');
      const rows = bookings.map(booking => ({
        'Booking ID': booking.id,
        Customer: booking.customer,
        Email: booking.email ?? '',
        Phone: booking.phone ?? '',
        Vehicle: booking.vehicle,
        'Rental period': this.bookingPeriod(booking),
        'Start date': booking.startDate ?? '',
        'End date': booking.endDate ?? '',
        'Pickup location': booking.pickupLocation ?? '',
        Total: booking.total,
        Status: booking.status,
        'Payment status': booking.paymentStatus ?? '',
      }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet['!cols'] = Object.keys(rows[0]).map(key => ({
        wch: Math.min(45, Math.max(key.length, ...rows.map(row => String(row[key as keyof typeof row]).length)) + 2),
      }));
      sheet['!autofilter'] = { ref: sheet['!ref'] ?? 'A1:L1' };
      for (let row = 2; row <= rows.length + 1; row++) {
        if (sheet[`J${row}`]) sheet[`J${row}`].z = '$#,##0.00';
      }
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Bookings');
      XLSX.writeFileXLSX(workbook, `bookings-${this.dateKey(new Date())}.xlsx`);
      this.snack.open(`${bookings.length} bookings exported`, 'Dismiss', { duration: 2500 });
    } catch {
      this.snack.open('The Excel file could not be created.', 'Dismiss', { duration: 3200 });
    } finally {
      this.exporting.set(false);
    }
  }

  ngOnDestroy(): void {
    window.clearInterval(this.clock);
  }

  private isActiveAt(booking: Booking, now: Date): boolean {
    const start = this.bookingTime(booking.startDate, false);
    const end = this.bookingTime(booking.endDate, true);
    return booking.status !== 'Completed' && start !== null && end !== null && start <= now.getTime() && now.getTime() <= end;
  }

  private isUpcoming(booking: Booking, now: Date): boolean {
    const start = this.bookingTime(booking.startDate, false);
    return booking.status !== 'Completed' && start !== null && start > now.getTime();
  }

  private bookingTime(value: string | undefined, endOfDay: boolean): number | null {
    const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (!match) return null;
    const hasTime = match[4] !== undefined;
    return new Date(
      Number(match[1]), Number(match[2]) - 1, Number(match[3]),
      hasTime ? Number(match[4]) : endOfDay ? 23 : 0,
      hasTime ? Number(match[5]) : endOfDay ? 59 : 0,
      !hasTime && endOfDay ? 59 : 0,
    ).getTime();
  }

  private dateKey(value: string | Date | undefined): string {
    if (!value) return '';
    if (typeof value === 'string') {
      const calendarDate = value.match(/^(\d{4}-\d{2}-\d{2})/);
      if (calendarDate) return calendarDate[1];
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
