import { Component } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DataService } from '../../core/data.service';
import { formatBookingPeriod } from '../../core/booking-date';

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  readonly bookingPeriod = formatBookingPeriod;
  readonly metrics = [
    { label: 'Total revenue', value: '$24,680', note: '12.5% vs last month', positive: true, icon: 'payments', bg: '#dcfce7', color: '#16a34a' },
    { label: 'Active rentals', value: '18', note: '4 due back today', positive: false, icon: 'key', bg: '#dbeafe', color: '#2563eb' },
    { label: 'Available vehicles', value: '5', note: 'All listings available', positive: true, icon: 'directions_car', bg: '#e0e7ff', color: '#4f46e5' },
    { label: 'New customers', value: '36', note: '8.2% vs last month', positive: true, icon: 'person_add', bg: '#fef3c7', color: '#d97706' },
  ];
  constructor(readonly data: DataService) {}
}
