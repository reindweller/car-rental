import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Booking } from '../../core/models';

export interface BookingFilters {
  status: Booking['status'] | 'All';
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'app-booking-filters-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDatepickerModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  providers: [provideNativeDateAdapter()],
  templateUrl: './booking-filters-dialog.component.html',
  styleUrl: './booking-filters-dialog.component.scss',
})
export class BookingFiltersDialogComponent {
  private readonly ref = inject(MatDialogRef<BookingFiltersDialogComponent>);
  readonly filters = inject<BookingFilters>(MAT_DIALOG_DATA);
  readonly form = new FormGroup({
    status: new FormControl<BookingFilters['status']>(this.filters.status, { nonNullable: true }),
    startDate: new FormControl<Date | null>(this.parseDate(this.filters.startDate)),
    endDate: new FormControl<Date | null>(this.parseDate(this.filters.endDate)),
  });

  clear(): void {
    this.form.setValue({ status: 'All', startDate: null, endDate: null });
  }

  apply(): void {
    const value = this.form.getRawValue();
    this.ref.close({
      status: value.status,
      startDate: this.dateKey(value.startDate),
      endDate: this.dateKey(value.endDate),
    } satisfies BookingFilters);
  }

  private parseDate(value: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  }

  private dateKey(value: Date | null): string {
    if (!value) return '';
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
}
