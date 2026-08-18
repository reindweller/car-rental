import { CurrencyPipe } from '@angular/common';
import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../core/auth.service';
import { formatBookingPeriod } from '../../core/booking-date';
import { DataService } from '../../core/data.service';
import { Booking } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  readonly bookingPeriod = formatBookingPeriod;
  private readonly currentDate = new Date();
  readonly todayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(this.currentDate);
  readonly greeting = this.greetingFor(this.currentDate);
  readonly firstName = computed(() => this.auth.currentUser()?.name?.trim().split(/\s+/)[0] || 'there');
  readonly activeRentals = computed(() => this.data.bookings().filter(booking => this.isActiveAt(booking, this.currentDate)));
  readonly rentedVehicleIds = computed(() => {
    const vehicles = this.data.vehicles();
    const ids = new Set(vehicles.filter(vehicle => vehicle.status === 'Rented').map(vehicle => vehicle.id));
    for (const booking of this.activeRentals()) {
      if (booking.vehicleId) ids.add(booking.vehicleId);
      else {
        const vehicle = vehicles.find(item => `${item.year} ${item.name}` === booking.vehicle || item.name === booking.vehicle);
        if (vehicle) ids.add(vehicle.id);
      }
    }
    return ids;
  });
  readonly fleet = computed(() => {
    const total = this.data.vehicles().length;
    const rented = Math.min(total, this.rentedVehicleIds().size);
    const available = Math.max(0, total - rented);
    const utilization = total ? Math.round((rented / total) * 100) : 0;
    return { total, rented, available, utilization };
  });
  readonly fleetDonut = computed(() => {
    const utilization = this.fleet().utilization;
    return `conic-gradient(#60a5fa 0 ${utilization}%, #2563eb ${utilization}% 100%)`;
  });
  readonly metrics = computed(() => {
    const bookings = this.data.bookings();
    const currentMonth = this.monthKey(this.currentDate);
    const previousMonth = this.monthKey(new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1));
    const currentRevenue = this.revenueForMonth(bookings, currentMonth);
    const previousRevenue = this.revenueForMonth(bookings, previousMonth);
    const currentCustomers = this.newCustomersForMonth(bookings, currentMonth);
    const previousCustomers = this.newCustomersForMonth(bookings, previousMonth);
    const dueToday = this.activeRentals().filter(booking => this.dateKey(booking.endDate) === this.dateKey(this.currentDate)).length;
    const fleet = this.fleet();
    return [
      { label: 'Revenue this month', value: this.money(currentRevenue), note: this.changeNote(currentRevenue, previousRevenue), positive: currentRevenue >= previousRevenue, icon: 'payments', bg: '#dcfce7', color: '#16a34a' },
      { label: 'Active rentals', value: String(this.activeRentals().length), note: `${dueToday} due back today`, positive: false, icon: 'key', bg: '#dbeafe', color: '#2563eb' },
      { label: 'Available vehicles', value: String(fleet.available), note: `${fleet.total} vehicles total`, positive: fleet.available > 0, icon: 'directions_car', bg: '#e0e7ff', color: '#4f46e5' },
      { label: 'New customers', value: String(currentCustomers), note: this.changeNote(currentCustomers, previousCustomers), positive: currentCustomers >= previousCustomers, icon: 'person_add', bg: '#fef3c7', color: '#d97706' },
    ];
  });
  readonly revenueChart = computed(() => {
    const bookings = this.data.bookings();
    const months = Array.from({ length: 6 }, (_, index) => new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 5 + index, 1));
    const values = months.map(month => this.revenueForMonth(bookings, this.monthKey(month)));
    const ceiling = this.niceCeiling(Math.max(...values, 0));
    const points = values.map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 600;
      const y = 175 - (value / ceiling) * 165;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const line = `M${points.join(' L')}`;
    return {
      labels: months.map(month => new Intl.DateTimeFormat('en-US', { month: 'short' }).format(month)),
      yLabels: [ceiling, ceiling * 2 / 3, ceiling / 3, 0].map(value => this.compactMoney(value)),
      line,
      area: `${line} L600,190 L0,190 Z`,
      summary: `Revenue for the last six months: ${this.money(values.reduce((sum, value) => sum + value, 0))}`,
    };
  });
  readonly recentBookings = computed(() => [...this.data.bookings()]
    .sort((a, b) => this.bookingDate(b).getTime() - this.bookingDate(a).getTime())
    .slice(0, 5));

  constructor(readonly data: DataService, private readonly auth: AuthService) {}

  private isActiveAt(booking: Booking, now: Date): boolean {
    const start = this.bookingTime(booking.startDate, false);
    const end = this.bookingTime(booking.endDate, true);
    return booking.status !== 'Completed' && start !== null && end !== null && start <= now.getTime() && now.getTime() <= end;
  }

  private revenueForMonth(bookings: Booking[], month: string): number {
    return bookings
      .filter(booking => booking.paymentStatus === 'Paid' && this.monthKey(this.bookingDate(booking)) === month)
      .reduce((sum, booking) => sum + Number(booking.total || 0), 0);
  }

  private newCustomersForMonth(bookings: Booking[], month: string): number {
    const firstBooking = new Map<string, Date>();
    for (const booking of bookings) {
      const identity = booking.email?.trim().toLowerCase() || booking.customer.trim().toLowerCase();
      const date = this.bookingDate(booking);
      const existing = firstBooking.get(identity);
      if (!existing || date < existing) firstBooking.set(identity, date);
    }
    return [...firstBooking.values()].filter(date => this.monthKey(date) === month).length;
  }

  private bookingDate(booking: Booking): Date {
    const value = booking.createdAt || booking.startDate;
    const date = value ? new Date(value) : new Date(0);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
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
    if (typeof value === 'string') return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  private monthKey(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }

  private changeNote(current: number, previous: number): string {
    if (!previous) return current ? 'New vs last month' : 'No change vs last month';
    const change = ((current - previous) / previous) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs last month`;
  }

  private money(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }

  private compactMoney(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }

  private niceCeiling(value: number): number {
    if (value <= 0) return 100;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const normalized = value / magnitude;
    const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return step * magnitude;
  }

  private greetingFor(date: Date): string {
    return date.getHours() < 12 ? 'Good morning' : date.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  }
}
