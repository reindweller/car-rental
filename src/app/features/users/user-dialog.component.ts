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
  templateUrl: './user-dialog.component.html',
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
