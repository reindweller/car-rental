import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';

type LoginMode = 'signIn' | 'newPassword' | 'forgot' | 'confirmReset';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  readonly mode = signal<LoginMode>('signIn');
  readonly hidePassword = signal(true);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true }),
    newPassword: new FormControl('', { nonNullable: true }),
    code: new FormControl('', { nonNullable: true }),
    remember: new FormControl(true, { nonNullable: true }),
  });

  constructor(private readonly auth: AuthService, private readonly data: DataService, private readonly router: Router) {}

  title(): string {
    return { signIn: 'Sign in to your account', newPassword: 'Set your permanent password', forgot: 'Reset your password', confirmReset: 'Enter your verification code' }[this.mode()];
  }

  intro(): string {
    return {
      signIn: 'Enter your Cognito account details to access the operations dashboard.',
      newPassword: 'Complete your invited account before continuing.',
      forgot: 'We’ll send a verification code to your email address.',
      confirmReset: 'Enter the code from your email and choose a strong new password.',
    }[this.mode()];
  }

  actionLabel(): string {
    return { signIn: 'Sign in', newPassword: 'Set password and sign in', forgot: 'Send verification code', confirmReset: 'Reset password' }[this.mode()];
  }

  setMode(mode: 'signIn' | 'forgot'): void {
    this.mode.set(mode);
    this.error.set('');
    this.notice.set('');
  }

  async submit(): Promise<void> {
    if (this.form.controls.email.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    try {
      if (this.mode() === 'forgot') {
        const error = await this.auth.requestPasswordReset(value.email);
        if (error) this.error.set(error);
        else {
          this.mode.set('confirmReset');
          this.notice.set('A verification code was sent to your email.');
        }
        return;
      }
      if (this.mode() === 'confirmReset') {
        if (!value.code || value.newPassword.length < 12) {
          this.error.set('Enter the code and a password of at least 12 characters.');
          return;
        }
        const error = await this.auth.confirmPasswordReset(value.email, value.code, value.newPassword);
        if (error) this.error.set(error);
        else {
          this.mode.set('signIn');
          this.form.controls.password.setValue('');
          this.notice.set('Password reset. You can now sign in.');
        }
        return;
      }
      if (this.mode() === 'newPassword') {
        if (!value.name.trim() || value.newPassword.length < 12) {
          this.error.set('Enter your full name and a password of at least 12 characters.');
          return;
        }
        const result = await this.auth.completeNewPassword(value.newPassword, value.name, value.remember);
        if (result.authenticated) {
          await this.data.loadStaffData();
          await this.router.navigate(['/dashboard']);
        } else this.error.set(result.message ?? 'Could not set the new password.');
        return;
      }
      if (!value.password) {
        this.error.set('Enter your password.');
        return;
      }
      const result = await this.auth.login(value.email, value.password, value.remember);
      if (result.authenticated) {
        await this.data.loadStaffData();
        await this.router.navigate(['/dashboard']);
      } else if (result.challenge) this.mode.set('newPassword');
      else this.error.set(result.message ?? 'Please check your email and password.');
    } finally {
      this.loading.set(false);
    }
  }
}
