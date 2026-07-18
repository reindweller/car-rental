import { Component, computed, signal } from '@angular/core';
import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { DataService } from '../../core/data.service';

@Component({
  selector: 'app-bookings',
  imports: [CurrencyPipe, NgTemplateOutlet, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTabsModule],
  template: `
    <div class="page-heading"><div><h1>Bookings</h1><p>Manage reservations, pickups, and returns.</p></div><button mat-flat-button><mat-icon>add</mat-icon>New booking</button></div>
    <section class="booking-stats">@for (stat of stats; track stat.label) {<article><span [style.background]="stat.bg"><mat-icon>{{ stat.icon }}</mat-icon></span><div><b>{{ stat.value }}</b><small>{{ stat.label }}</small></div></article>}</section>
    <section class="panel">
      <div class="tools"><mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-icon matPrefix>search</mat-icon><input matInput placeholder="Search booking, customer, or vehicle" (input)="search.set($any($event.target).value)"></mat-form-field><button mat-stroked-button><mat-icon>tune</mat-icon>Filters</button><button mat-stroked-button><mat-icon>download</mat-icon>Export</button></div>
      <mat-tab-group animationDuration="150ms"><mat-tab label="All bookings"><ng-template matTabContent><ng-container *ngTemplateOutlet="table"></ng-container></ng-template></mat-tab><mat-tab label="Active"><ng-template matTabContent><ng-container *ngTemplateOutlet="table"></ng-container></ng-template></mat-tab><mat-tab label="Upcoming"><ng-template matTabContent><ng-container *ngTemplateOutlet="table"></ng-container></ng-template></mat-tab></mat-tab-group>
      <ng-template #table><div class="table-wrap"><table><thead><tr><th>Booking ID</th><th>Customer</th><th>Vehicle</th><th>Rental period</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>@for (b of filtered(); track b.id) {<tr><td><b>{{ b.id }}</b></td><td><span class="avatar">{{ b.customer[0] }}</span><b>{{ b.customer }}</b></td><td>{{ b.vehicle }}</td><td>{{ b.period }}</td><td><b>{{ b.total | currency }}</b></td><td><span class="status" [attr.data-status]="b.status">{{ b.status }}</span></td><td><button mat-icon-button><mat-icon>more_horiz</mat-icon></button></td></tr>}</tbody></table></div></ng-template>
    </section>
  `,
  styleUrl: './bookings.component.scss',
})
export class BookingsComponent {
  readonly search = signal('');
  readonly stats = [{label:'Active rentals',value:'18',icon:'key',bg:'#dbeafe'},{label:'Pickups today',value:'6',icon:'north_east',bg:'#dcfce7'},{label:'Returns today',value:'4',icon:'south_west',bg:'#fef3c7'},{label:'Pending approval',value:'3',icon:'hourglass_top',bg:'#f3e8ff'}];
  readonly filtered = computed(() => this.data.bookings().filter(b => `${b.id} ${b.customer} ${b.vehicle}`.toLowerCase().includes(this.search().toLowerCase())));
  constructor(readonly data: DataService) {}
}
