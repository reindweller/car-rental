import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface BookingDateTimeDialogData {
  startDate: Date | null;
  endDate: Date | null;
  startTime: string;
  endTime: string;
}

@Component({
  selector: 'app-booking-date-time-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDatepickerModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  providers: [provideNativeDateAdapter()],
  template: `
    <h2 mat-dialog-title>Choose your trip schedule</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <section>
          <label>Pick up</label>
          <div>
            <mat-form-field appearance="outline" subscriptSizing="dynamic"><input matInput [matDatepicker]="pickupPicker" [min]="minDate" formControlName="startDate" placeholder="Pick-up date"><mat-datepicker-toggle matIconSuffix [for]="pickupPicker"></mat-datepicker-toggle><mat-datepicker #pickupPicker></mat-datepicker></mat-form-field>
            <input class="time-input" type="time" formControlName="startTime" aria-label="Pick-up time" required>
          </div>
        </section>
        <section>
          <label>Return</label>
          <div>
            <mat-form-field appearance="outline" subscriptSizing="dynamic"><input matInput [matDatepicker]="returnPicker" [min]="form.controls.startDate.value || minDate" formControlName="endDate" placeholder="Return date"><mat-datepicker-toggle matIconSuffix [for]="returnPicker"></mat-datepicker-toggle><mat-datepicker #returnPicker></mat-datepicker></mat-form-field>
            <input class="time-input" type="time" formControlName="endTime" aria-label="Return time" required>
          </div>
        </section>
        @if (validationError()) { <p class="error">{{ validationError() }}</p> }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Cancel</button><button mat-flat-button [disabled]="!!validationError()" (click)="apply()">Apply</button></mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content{padding-top:8px!important}form{display:grid;gap:16px;width:min(480px,78vw)}section>label{display:block;margin-bottom:6px;color:#334155;font-size:11px;font-weight:700}section>div{display:grid;grid-template-columns:minmax(0,1fr) 140px;gap:10px}mat-form-field{width:100%}.time-input{box-sizing:border-box;min-width:0;height:43px;border:1px solid #d8e0ea;border-radius:9px;padding:0 12px;color:#162236;background:#fff;font:inherit}.time-input:focus{outline:0;border-color:#2563eb;box-shadow:0 0 0 1px #2563eb}.error{margin:0;color:#dc2626;font-size:10px}@media(max-width:520px){section>div{grid-template-columns:1fr}.time-input{width:100%}}
  `],
})
export class BookingDateTimeDialogComponent {
  private readonly ref = inject(MatDialogRef<BookingDateTimeDialogComponent>);
  readonly data = inject<BookingDateTimeDialogData>(MAT_DIALOG_DATA);
  readonly minDate = new Date();
  readonly form = new FormGroup({
    startDate: new FormControl<Date | null>(this.data.startDate ? new Date(this.data.startDate) : null, Validators.required),
    endDate: new FormControl<Date | null>(this.data.endDate ? new Date(this.data.endDate) : null, Validators.required),
    startTime: new FormControl(this.data.startTime, { nonNullable: true, validators: Validators.required }),
    endTime: new FormControl(this.data.endTime, { nonNullable: true, validators: Validators.required }),
  });

  validationError(): string {
    const value = this.form.getRawValue();
    if (!value.startDate || !value.endDate || !value.startTime || !value.endTime) return 'Select both dates and times.';
    const start = this.combine(value.startDate, value.startTime);
    const end = this.combine(value.endDate, value.endTime);
    const currentMinute = new Date();
    currentMinute.setSeconds(0, 0);
    if (start < currentMinute) return 'Pick-up date and time cannot be in the past.';
    if (end <= start) return 'Return date and time must be after pick up.';
    return '';
  }

  apply(): void {
    if (!this.validationError()) this.ref.close(this.form.getRawValue());
  }

  private combine(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
  }
}
