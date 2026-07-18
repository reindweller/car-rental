import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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

@Component({
  selector: 'app-customer-booking',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, MatButtonModule, MatCheckboxModule, MatDatepickerModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSnackBarModule],
  providers: [provideNativeDateAdapter()],
  template: `
    <div class="booking-page">
      <header class="site-header"><a class="brand" routerLink="/"><span><mat-icon>directions_car</mat-icon></span><b>Bill’s Premiere</b></a><div class="secure"><mat-icon>lock</mat-icon>Secure booking</div><a class="staff" routerLink="/login">Staff login</a></header>

      @if (confirmationId()) {
        <main class="confirmation">
          <div class="success-icon"><mat-icon>check</mat-icon></div><span>Booking confirmed</span><h1>You’re ready to drive.</h1><p>We sent the details to <b>{{ customerForm.controls.email.value }}</b>. Bring your driver’s license and payment card when you pick up the car.</p>
          <article><div class="car-thumb" [style.background]="selectedVehicle().color"><img [src]="selectedVehicle().imageUrl" [alt]="selectedVehicle().name"></div><div><small>Booking reference</small><strong>{{ confirmationId() }}</strong><span>{{ selectedVehicle().year }} {{ selectedVehicle().name }} · {{ startDate() | date:'MMM d' }} – {{ endDate() | date:'MMM d, y' }}</span></div><b>{{ total() | currency }}</b></article>
          <div class="confirmation-actions"><a mat-flat-button routerLink="/">Back to home</a><button mat-stroked-button (click)="bookAnother()">Book another car</button></div>
        </main>
      } @else {
        <main class="booking-shell">
          <div class="booking-heading"><a routerLink="/"><mat-icon>arrow_back</mat-icon>Back to home</a><span>Book your drive</span><h1>Choose your car and dates</h1><p>Clear pricing, instant confirmation, and free changes up to 24 hours before pickup.</p></div>

          <div class="steps"><span class="active"><b>1</b>Car & dates</span><i></i><span [class.active]="datesComplete()"><b>2</b>Your details</span><i></i><span><b>3</b>Confirmation</span></div>

          <div class="booking-grid">
            <div class="booking-main">
              <section class="panel choose-car">
                <header><div><span>Step 1</span><h2>Select a vehicle</h2></div><small>{{ availableVehicles.length }} cars available</small></header>
                <div class="vehicle-options">
                  @for (vehicle of availableVehicles; track vehicle.id) {
                    <button type="button" [class.selected]="selectedVehicle().id === vehicle.id" (click)="selectVehicle(vehicle)">
                      <div class="mini-car" [style.background]="vehicle.color"><img [src]="vehicle.imageUrl" [alt]="vehicle.name"></div>
                      <span><b>{{ vehicle.year }} {{ vehicle.name }}</b><small>{{ vehicle.trim }} · {{ vehicle.rating ? '★ ' + vehicle.rating + ' (' + vehicle.reviewCount + ')' : 'New listing' }}</small></span>
                      <strong>{{ vehicle.price | currency:'USD':'symbol':'1.2-2' }}<small>/day</small></strong>
                      <mat-icon class="check">check_circle</mat-icon>
                    </button>
                  }
                </div>
              </section>

              <section class="panel dates-panel">
                <header><div><span>Step 2</span><h2>Choose your rental dates</h2></div><small><mat-icon>event_available</mat-icon>Instant confirmation</small></header>
                <mat-form-field appearance="outline" class="date-range">
                  <mat-label>Pick-up and return dates</mat-label>
                  <mat-date-range-input [rangePicker]="picker" [min]="minDate">
                    <input matStartDate placeholder="Pick-up date" [value]="startDate()" (dateChange)="startDate.set($event.value)">
                    <input matEndDate placeholder="Return date" [value]="endDate()" (dateChange)="endDate.set($event.value)">
                  </mat-date-range-input>
                  <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-date-range-picker #picker></mat-date-range-picker>
                </mat-form-field>
                <div class="date-cards">
                  <div><span><mat-icon>north_east</mat-icon></span><p><small>Pick-up</small><b>{{ startDate() ? (startDate() | date:'EEE, MMM d') : 'Select a date' }}</b><em>10:00 AM · Downtown Manila</em></p></div>
                  <mat-icon>arrow_forward</mat-icon>
                  <div><span><mat-icon>south_west</mat-icon></span><p><small>Return</small><b>{{ endDate() ? (endDate() | date:'EEE, MMM d') : 'Select a date' }}</b><em>10:00 AM · Same location</em></p></div>
                </div>
              </section>

              <section class="panel details-panel">
                <header><div><span>Step 3</span><h2>Your details</h2></div><small>All fields are required</small></header>
                <form [formGroup]="customerForm"><div class="field-row"><mat-form-field appearance="outline"><mat-label>First name</mat-label><input matInput formControlName="firstName" autocomplete="given-name"></mat-form-field><mat-form-field appearance="outline"><mat-label>Last name</mat-label><input matInput formControlName="lastName" autocomplete="family-name"></mat-form-field></div><mat-form-field appearance="outline"><mat-label>Email address</mat-label><mat-icon matPrefix>mail_outline</mat-icon><input matInput type="email" formControlName="email" autocomplete="email"></mat-form-field><mat-form-field appearance="outline"><mat-label>Mobile number</mat-label><mat-icon matPrefix>phone</mat-icon><input matInput formControlName="phone" autocomplete="tel" placeholder="+63 900 000 0000"></mat-form-field></form>
              </section>
            </div>

            <aside class="summary-wrap">
              <section class="panel summary">
                <h2>Your booking</h2>
                <div class="selected-car" [style.background]="selectedVehicle().color"><span>{{ selectedVehicle().category }}</span><img [src]="selectedVehicle().imageUrl" [alt]="selectedVehicle().year + ' ' + selectedVehicle().name"></div>
                <div class="car-title"><div><h3>{{ selectedVehicle().year }} {{ selectedVehicle().name }}</h3><span>{{ selectedVehicle().trim }} · {{ selectedVehicle().trips }} trips</span></div><b>{{ selectedVehicle().price | currency:'USD':'symbol':'1.2-2' }}<small>/day</small></b></div>
                <div class="listing-rating"><mat-icon>star</mat-icon><b>{{ selectedVehicle().rating ?? 'New' }}</b><span>{{ selectedVehicle().reviewCount ? selectedVehicle().reviewCount + ' ratings' : 'No ratings yet' }}</span></div>
                <div class="spec-list"><span><mat-icon>airline_seat_recline_normal</mat-icon>{{ selectedVehicle().seats }} seats</span><span><mat-icon>speed</mat-icon>{{ selectedVehicle().mpg }} MPG</span><span><mat-icon>settings</mat-icon>{{ selectedVehicle().transmission }}</span><span><mat-icon>local_gas_station</mat-icon>{{ selectedVehicle().fuel }}</span></div>
                <div class="guest-review"><mat-icon>format_quote</mat-icon><p>{{ selectedVehicle().review }}<small>{{ selectedVehicle().reviewer ? '— ' + selectedVehicle().reviewer : 'New on Turo' }}</small></p></div>
                <div class="coverage"><mat-checkbox [checked]="coverage()" (change)="coverage.set($event.checked)"><b>Premium coverage</b><small>Reduce your damage excess to $0</small></mat-checkbox><strong>+$18/day</strong></div>
                <div class="price-lines"><p><span>Rental rate</span><b>{{ selectedVehicle().price | currency }} × {{ rentalDays() || 0 }} days</b></p><p><span>Premium coverage</span><b>{{ coveragePrice() | currency }}</b></p><p><span>Taxes & fees</span><b>{{ taxes() | currency }}</b></p></div>
                <div class="total"><span>Total<small>{{ rentalDays() ? rentalDays() + ' rental days' : 'Select dates to calculate' }}</small></span><strong>{{ total() | currency }}</strong></div>
                <button mat-flat-button class="confirm" [disabled]="!canBook()" (click)="confirmBooking()">Confirm booking <mat-icon>arrow_forward</mat-icon></button>
                @if (!datesComplete()) { <p class="hint"><mat-icon>info_outline</mat-icon>Select pick-up and return dates to continue.</p> }
                <div class="assurances"><span><mat-icon>verified_user</mat-icon>Secure checkout</span><span><mat-icon>event_busy</mat-icon>Free changes up to 24h</span></div>
              </section>
            </aside>
          </div>
        </main>
      }
      <footer>© 2026 Bill’s Premiere <span>·</span> Rental terms <span>·</span> Privacy <span>·</span> Need help? +63 2 8123 4567</footer>
    </div>
  `,
  styleUrl: './customer-booking.component.scss',
})
export class CustomerBookingComponent {
  private readonly data = inject(DataService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(MatSnackBar);
  readonly availableVehicles = this.data.vehicles().filter(vehicle => vehicle.status === 'Available');
  readonly minDate = new Date();
  readonly selectedVehicle = signal<Vehicle>(this.availableVehicles[0]);
  readonly startDate = signal<Date | null>(null);
  readonly endDate = signal<Date | null>(null);
  readonly coverage = signal(true);
  readonly confirmationId = signal('');
  readonly customerForm = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: Validators.required }),
    lastName: new FormControl('', { nonNullable: true, validators: Validators.required }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  readonly formValid = signal(this.customerForm.valid);
  readonly rentalDays = computed(() => {
    const start = this.startDate(); const end = this.endDate();
    return start && end && end > start ? Math.ceil((end.getTime() - start.getTime()) / 86_400_000) : 0;
  });
  readonly datesComplete = computed(() => this.rentalDays() > 0);
  readonly basePrice = computed(() => this.selectedVehicle().price * this.rentalDays());
  readonly coveragePrice = computed(() => this.coverage() ? 18 * this.rentalDays() : 0);
  readonly taxes = computed(() => (this.basePrice() + this.coveragePrice()) * 0.08);
  readonly total = computed(() => this.basePrice() + this.coveragePrice() + this.taxes());
  readonly canBook = computed(() => this.datesComplete() && this.formValid());

  constructor() {
    const requestedId = Number(this.route.snapshot.queryParamMap.get('vehicle'));
    const requested = this.availableVehicles.find(vehicle => vehicle.id === requestedId);
    if (requested) this.selectedVehicle.set(requested);
    this.customerForm.statusChanges.subscribe(() => this.formValid.set(this.customerForm.valid));
  }

  selectVehicle(vehicle: Vehicle): void { this.selectedVehicle.set(vehicle); }
  confirmBooking(): void {
    const start = this.startDate(); const end = this.endDate();
    if (!start || !end || !this.canBook()) { this.snack.open('Complete your dates and contact details first.', 'Dismiss', { duration: 3000 }); return; }
    const customer = `${this.customerForm.controls.firstName.value} ${this.customerForm.controls.lastName.value}`;
    this.confirmationId.set(this.data.createBooking(customer, this.selectedVehicle(), start, end, this.total()));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  bookAnother(): void { this.confirmationId.set(''); this.startDate.set(null); this.endDate.set(null); this.customerForm.reset(); }
}
