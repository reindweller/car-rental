import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { DataService } from '../../core/data.service';
import { BookingDateTimeDialogComponent, BookingDateTimeDialogData } from './booking-date-time-dialog.component';

@Component({
  selector: 'app-landing',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, MatButtonModule, MatDatepickerModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatSnackBarModule],
  providers: [provideNativeDateAdapter()],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  readonly data = inject(DataService);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  readonly featuredVehicles = this.data.vehicles().filter(vehicle => vehicle.status === 'Available');
  readonly minDate = new Date();
  readonly searching = signal(false);
  readonly searchError = signal('');
  readonly schedule = signal<BookingDateTimeDialogData>({
    startDate: null,
    endDate: null,
    startTime: '10:00',
    endTime: '10:00',
  });
  readonly searchForm = new FormGroup({
    location: new FormControl('', { nonNullable: true }),
    startDate: new FormControl<Date | null>(null),
    endDate: new FormControl<Date | null>(null),
    startTime: new FormControl('10:00', { nonNullable: true }),
    endTime: new FormControl('10:00', { nonNullable: true }),
    category: new FormControl('', { nonNullable: true }),
  });
  readonly pickupLocations = [...new Set(this.featuredVehicles.flatMap(vehicle => [vehicle.carLocation, ...(vehicle.pickupLocations ?? [])]).filter((location): location is string => !!location))].sort();
  readonly benefits = [
    { icon: 'sell', title: 'Upfront pricing', copy: 'The price you see is the price you pay. Taxes and standard coverage are shown before checkout.' },
    { icon: 'event_available', title: 'Flexible booking', copy: 'Change your dates or vehicle with a few clicks. Plans change, and that is completely fine.' },
    { icon: 'health_and_safety', title: 'Road-ready cars', copy: 'Every vehicle passes a 40-point safety check and is detailed before every rental.' },
    { icon: 'support_agent', title: 'Real human support', copy: 'Our local team is here around the clock, wherever your journey takes you.' },
  ];
  categories(): string[] {
    const location = this.searchForm.controls.location.value;
    const vehicles = location
      ? this.featuredVehicles.filter(vehicle => vehicle.carLocation === location || vehicle.pickupLocations?.includes(location))
      : this.featuredVehicles;
    return [...new Set(vehicles.map(vehicle => vehicle.category))].sort();
  }
  locationChanged(): void {
    if (!this.categories().includes(this.searchForm.controls.category.value)) this.searchForm.controls.category.setValue('');
  }
  openDateTimeDialog(): void {
    const value = this.schedule();
    this.dialog.open<BookingDateTimeDialogComponent, BookingDateTimeDialogData, BookingDateTimeDialogData>(BookingDateTimeDialogComponent, {
      width: '560px', maxWidth: '94vw', autoFocus: 'first-tabbable',
      data: { startDate: value.startDate, endDate: value.endDate, startTime: value.startTime, endTime: value.endTime },
    }).afterClosed().subscribe(result => {
      if (!result) return;
      this.searchForm.patchValue(result);
      this.schedule.set(result);
      this.searchError.set('');
    });
  }
  scheduleText(date: Date | null, time: string): string {
    if (!date) return 'Select date and time';
    const [hours, minutes] = time.split(':').map(Number);
    const value = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(value);
  }
  async searchCars(): Promise<void> {
    const value = this.searchForm.getRawValue();
    const dateTime = (input: Date | null, time: string) => input && time
      ? `${input.getFullYear()}-${String(input.getMonth() + 1).padStart(2, '0')}-${String(input.getDate()).padStart(2, '0')}T${time}`
      : null;
    const start = dateTime(value.startDate, value.startTime);
    const end = dateTime(value.endDate, value.endTime);
    this.searchError.set('');
    if ((start && !end) || (!start && end)) {
      this.searchError.set('Select both a pick-up date and a return date.');
      return;
    }
    if (start && end && end <= start) {
      this.searchError.set('Return date and time must be after the pick-up date and time.');
      return;
    }
    const currentMinute = new Date();
    currentMinute.setSeconds(0, 0);
    if (start && new Date(start) < currentMinute) {
      this.searchError.set('Pick-up date and time cannot be in the past.');
      return;
    }
    if (start && end) {
      this.searching.set(true);
      try {
        const result = await this.data.checkAvailability(start, end);
        const unavailable = new Set(result.unavailableVehicleIds);
        const matchingVehicles = this.featuredVehicles.filter(vehicle =>
          (!value.location || vehicle.carLocation === value.location || vehicle.pickupLocations?.includes(value.location)) &&
          (!value.category || vehicle.category === value.category)
        );
        if (matchingVehicles.length && matchingVehicles.every(vehicle => unavailable.has(vehicle.id))) {
          this.searchError.set('No vehicles matching your search are available for those dates. Try different dates or filters.');
          return;
        }
      } catch (error) {
        const message = this.data.errorMessage(error);
        this.searchError.set(message);
        this.snack.open(message, 'Dismiss', { duration: 4500 });
        return;
      } finally {
        this.searching.set(false);
      }
    }
    this.router.navigate(['/book'], { queryParams: {
      location: value.location || null,
      start,
      end,
      category: value.category || null,
    }});
  }
}
