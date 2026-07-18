import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AddVehicleInput } from '../../core/data.service';

@Component({
  selector: 'app-add-vehicle-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <div class="dialog-heading"><span><mat-icon>directions_car</mat-icon></span><div><h2 mat-dialog-title>Add a vehicle</h2><p>Publish a new vehicle across the fleet and customer booking pages.</p></div></div>
    <mat-dialog-content>
      <form [formGroup]="form">
        <h3>Vehicle identity</h3>
        <div class="fields two"><mat-form-field appearance="outline"><mat-label>Make and model</mat-label><input matInput formControlName="name" placeholder="e.g. Toyota Camry"><mat-error>Vehicle name is required</mat-error></mat-form-field><mat-form-field appearance="outline"><mat-label>Year</mat-label><input matInput type="number" formControlName="year" min="1990" max="2030"></mat-form-field></div>
        <div class="fields three"><mat-form-field appearance="outline"><mat-label>Trim</mat-label><input matInput formControlName="trim" placeholder="e.g. XLE"></mat-form-field><mat-form-field appearance="outline"><mat-label>Category</mat-label><input matInput formControlName="category" placeholder="e.g. Sedan"></mat-form-field><mat-form-field appearance="outline"><mat-label>Plate or reference</mat-label><input matInput formControlName="plate"></mat-form-field></div>

        <h3>Specifications and pricing</h3>
        <div class="fields four"><mat-form-field appearance="outline"><mat-label>Seats</mat-label><input matInput type="number" formControlName="seats" min="1" max="15"></mat-form-field><mat-form-field appearance="outline"><mat-label>MPG</mat-label><input matInput type="number" formControlName="mpg" min="0"></mat-form-field><mat-form-field appearance="outline"><mat-label>Fuel</mat-label><mat-select formControlName="fuel"><mat-option value="Gas">Gas</mat-option><mat-option value="Hybrid">Hybrid</mat-option><mat-option value="Electric">Electric</mat-option><mat-option value="Diesel">Diesel</mat-option></mat-select></mat-form-field><mat-form-field appearance="outline"><mat-label>Transmission</mat-label><mat-select formControlName="transmission"><mat-option value="Automatic">Automatic</mat-option><mat-option value="Manual">Manual</mat-option></mat-select></mat-form-field></div>
        <div class="fields two"><mat-form-field appearance="outline"><mat-label>Daily price (USD)</mat-label><span matTextPrefix>$&nbsp;</span><input matInput type="number" formControlName="price" min="1" step="0.01"><mat-error>Enter a valid daily price</mat-error></mat-form-field><mat-form-field appearance="outline"><mat-label>Initial status</mat-label><mat-select formControlName="status"><mat-option value="Available">Available</mat-option><mat-option value="Rented">Rented</mat-option><mat-option value="Maintenance">Maintenance</mat-option></mat-select></mat-form-field></div>

        <h3>Customer listing</h3>
        <mat-form-field appearance="outline"><mat-label>Primary photo URL</mat-label><mat-icon matPrefix>image</mat-icon><input matInput formControlName="imageUrl" placeholder="https://example.com/vehicle.jpg"><mat-hint>Use a public HTTPS image URL</mat-hint><mat-error>A valid HTTP(S) image URL is required</mat-error></mat-form-field>
        @if (form.controls.imageUrl.valid && form.controls.imageUrl.value) {<div class="preview"><img [src]="form.controls.imageUrl.value" alt="Vehicle photo preview"><span>Photo preview</span></div>}
        <mat-form-field appearance="outline"><mat-label>Vehicle features</mat-label><textarea matInput formControlName="features" rows="3" placeholder="Backup camera, Bluetooth, Keyless entry"></textarea><mat-hint>Separate each feature with a comma</mat-hint></mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Cancel</button><button mat-flat-button [disabled]="form.invalid" (click)="save()"><mat-icon>add</mat-icon>Add vehicle</button></mat-dialog-actions>
  `,
  styles: [`
    .dialog-heading{display:flex;gap:12px;align-items:center;padding:22px 24px 5px}.dialog-heading>span{width:42px;height:42px;border-radius:10px;display:grid;place-items:center;background:#dbeafe;color:#2563eb}.dialog-heading h2{padding:0;margin:0;font-size:19px}.dialog-heading p{margin:4px 0 0;color:#718096;font-size:9px}mat-dialog-content{padding-top:10px!important}form{width:min(680px,78vw);display:grid}h3{font-size:9px;text-transform:uppercase;letter-spacing:.09em;color:#64748b;margin:17px 0 10px}.fields{display:grid;gap:10px}.fields.two{grid-template-columns:1fr 1fr}.fields.three{grid-template-columns:1fr 1fr 1fr}.fields.four{grid-template-columns:repeat(4,1fr)}mat-form-field{width:100%}.preview{height:130px;position:relative;overflow:hidden;border-radius:9px;margin:-8px 0 10px;background:#edf1f5}.preview img{width:100%;height:100%;object-fit:cover}.preview span{position:absolute;left:8px;bottom:8px;padding:4px 7px;border-radius:5px;background:#ffffffdd;font-size:7px;font-weight:700}@media(max-width:650px){form{width:75vw}.fields.two,.fields.three,.fields.four{grid-template-columns:1fr}.preview{height:110px}}
  `],
})
export class AddVehicleDialogComponent {
  private readonly ref = inject(MatDialogRef<AddVehicleDialogComponent>);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    year: new FormControl(new Date().getFullYear(), { nonNullable: true, validators: [Validators.required, Validators.min(1990), Validators.max(2030)] }),
    trim: new FormControl('', { nonNullable: true, validators: Validators.required }),
    category: new FormControl('', { nonNullable: true, validators: Validators.required }),
    plate: new FormControl('', { nonNullable: true, validators: Validators.required }),
    seats: new FormControl(5, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(15)] }),
    mpg: new FormControl(25, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    fuel: new FormControl('Gas', { nonNullable: true, validators: Validators.required }),
    transmission: new FormControl('Automatic', { nonNullable: true, validators: Validators.required }),
    price: new FormControl(50, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    status: new FormControl<AddVehicleInput['status']>('Available', { nonNullable: true, validators: Validators.required }),
    imageUrl: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^https?:\/\/.+/i)] }),
    features: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  save(): void { if (this.form.valid) this.ref.close(this.form.getRawValue() as AddVehicleInput); }
}
