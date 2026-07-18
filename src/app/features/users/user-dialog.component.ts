import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AppUser, UserRole } from '../../core/models';

@Component({
  selector: 'app-user-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit team member' : 'Invite team member' }}</h2>
    <mat-dialog-content><p>{{ data ? 'Update account details and access level.' : 'They’ll receive an email invitation to join your workspace.' }}</p>
      <form [formGroup]="form">
        <mat-form-field appearance="outline"><mat-label>Full name</mat-label><input matInput formControlName="name" placeholder="e.g. Jordan Smith"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Work email</mat-label><input matInput type="email" formControlName="email" placeholder="jordan@company.com"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Role</mat-label><mat-select formControlName="role">@for (role of roles; track role) {<mat-option [value]="role">{{ role }}</mat-option>}</mat-select></mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Cancel</button><button mat-flat-button [disabled]="form.invalid" (click)="save()">{{ data ? 'Save changes' : 'Send invitation' }}</button></mat-dialog-actions>
  `,
  styles: [`mat-dialog-content>p{color:#64748b;font-size:12px;margin-top:0} form{display:grid;gap:3px;padding-top:12px;min-width:min(440px,70vw)} mat-form-field{width:100%}`],
})
export class UserDialogComponent {
  readonly data = inject<AppUser | null>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<UserDialogComponent>);
  readonly roles: UserRole[] = ['Administrator', 'Manager', 'Agent'];
  readonly form = new FormGroup({
    name: new FormControl(this.data?.name ?? '', { nonNullable: true, validators: Validators.required }),
    email: new FormControl(this.data?.email ?? '', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    role: new FormControl<UserRole>(this.data?.role ?? 'Agent', { nonNullable: true }),
  });
  save(): void { if (this.form.valid) this.ref.close(this.form.getRawValue()); }
}
