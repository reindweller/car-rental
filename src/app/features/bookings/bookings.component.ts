import { Component, OnDestroy, computed, signal } from '@angular/core';
import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { DataService } from '../../core/data.service';
import { Booking } from '../../core/models';
import { formatBookingPeriod } from '../../core/booking-date';

@Component({
  selector: 'app-bookings',
  imports: [CurrencyPipe, NgTemplateOutlet, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTabsModule],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.scss',
})
export class BookingsComponent implements OnDestroy {
  readonly search = signal('');
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
  readonly filtered = computed(() => this.data.bookings().filter(b => `${b.id} ${b.customer} ${b.vehicle}`.toLowerCase().includes(this.search().toLowerCase())));
  readonly bookingPeriod = formatBookingPeriod;
  constructor(readonly data: DataService) {}

  ngOnDestroy(): void {
    window.clearInterval(this.clock);
  }

  private isActiveAt(booking: Booking, now: Date): boolean {
    const start = this.bookingTime(booking.startDate, false);
    const end = this.bookingTime(booking.endDate, true);
    return booking.status !== 'Completed' && start !== null && end !== null && start <= now.getTime() && now.getTime() <= end;
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
