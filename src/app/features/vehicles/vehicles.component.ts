import { Component, computed, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AddVehicleInput, DataService } from '../../core/data.service';
import { AddVehicleDialogComponent } from './add-vehicle-dialog.component';

@Component({
  selector: 'app-vehicles',
  imports: [CurrencyPipe, RouterLink, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule, MatSelectModule, MatSnackBarModule],
  template: `
    <div class="page-heading"><div><h1>Vehicle fleet</h1><p>Track availability, pricing, and maintenance in one place.</p></div><button mat-flat-button (click)="openAddVehicle()"><mat-icon>add</mat-icon>Add vehicle</button></div>
    <div class="toolbar panel">
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-icon matPrefix>search</mat-icon><input matInput placeholder="Search vehicles or plates" (input)="search.set($any($event.target).value)"></mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Status</mat-label><mat-select [value]="status()" (valueChange)="status.set($event)"><mat-option value="All">All statuses</mat-option><mat-option value="Available">Available</mat-option><mat-option value="Rented">Rented</mat-option><mat-option value="Maintenance">Maintenance</mat-option></mat-select></mat-form-field>
      <span class="count">{{ filtered().length }} vehicles</span>
    </div>
    <section class="vehicle-grid">
      @for (vehicle of filtered(); track vehicle.id) {
        <article class="vehicle-card panel">
          <div class="vehicle-art" [style.background]="vehicle.color"><img [src]="vehicle.imageUrl" [alt]="vehicle.year + ' ' + vehicle.name"><b>{{ vehicle.category }}</b><button mat-icon-button [matMenuTriggerFor]="actions"><mat-icon>more_horiz</mat-icon></button></div>
          <div class="vehicle-body">
            <div class="vehicle-title"><div><h2>{{ vehicle.year }} {{ vehicle.name }}</h2><span>{{ vehicle.trim }} · {{ vehicle.plate }}</span></div><span class="status" [attr.data-status]="vehicle.status">{{ vehicle.status }}</span></div>
            <div class="rating"><mat-icon>star</mat-icon><b>{{ vehicle.rating ?? 'New' }}</b><span>{{ vehicle.reviewCount ? '(' + vehicle.reviewCount + ' ratings · ' + vehicle.trips + ' trips)' : 'No ratings yet' }}</span></div>
            <div class="specs"><span><mat-icon>airline_seat_recline_normal</mat-icon>{{ vehicle.seats }} seats</span><span><mat-icon>local_gas_station</mat-icon>{{ vehicle.mpg }} MPG</span><span><mat-icon>settings</mat-icon>{{ vehicle.transmission }}</span></div>
            <div class="vehicle-footer"><span><b>{{ vehicle.price | currency:'USD':'symbol':'1.2-2' }}</b> / day</span><a mat-stroked-button [routerLink]="['/vehicle', vehicle.id]">View details</a></div>
          </div>
        </article>
      } @empty { <div class="empty panel"><mat-icon>search_off</mat-icon><h2>No vehicles found</h2><p>Try a different search or status filter.</p></div> }
    </section>
    <mat-menu #actions="matMenu"><button mat-menu-item><mat-icon>edit</mat-icon>Edit vehicle</button><button mat-menu-item><mat-icon>build</mat-icon>Schedule service</button></mat-menu>
  `,
  styleUrl: './vehicles.component.scss',
})
export class VehiclesComponent {
  readonly search = signal(''); readonly status = signal('All');
  readonly filtered = computed(() => this.data.vehicles().filter(v => (this.status() === 'All' || v.status === this.status()) && `${v.name} ${v.plate} ${v.category}`.toLowerCase().includes(this.search().toLowerCase())));
  constructor(readonly data: DataService, private readonly dialog: MatDialog, private readonly snack: MatSnackBar) {}
  openAddVehicle(): void {
    const ref = this.dialog.open(AddVehicleDialogComponent, { width: '760px', maxWidth: '96vw', maxHeight: '92vh', autoFocus: 'first-tabbable' });
    ref.afterClosed().subscribe((input?: AddVehicleInput) => {
      if (!input) return;
      const vehicle = this.data.addVehicle(input);
      this.search.set(''); this.status.set('All');
      this.snack.open(`${vehicle.year} ${vehicle.name} added to the fleet`, 'View', { duration: 3500 })
        .onAction().subscribe(() => window.open(`/vehicle/${vehicle.id}`, '_self'));
    });
  }
}
