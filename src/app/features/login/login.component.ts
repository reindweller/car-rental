import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <div class="login-page">
      <section class="showcase">
        <a class="brand"><span><mat-icon>directions_car</mat-icon></span><b>Bill’s Premiere</b></a>
        <div class="showcase-copy">
          <div class="eyebrow">Rental operations, simplified</div>
          <h1>Keep every journey<br><em>moving forward.</em></h1>
          <p>One clear workspace for your fleet, bookings, customers, and team.</p>
          <div class="proof">
            <div><strong>98.6%</strong><span>Fleet uptime</span></div>
            <div><strong>1,240+</strong><span>Trips managed</span></div>
            <div><strong>4.9/5</strong><span>Customer rating</span></div>
          </div>
        </div>
        <div class="road"><span></span><span></span><span></span></div>
      </section>
      <section class="login-panel">
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="mobile-brand"><mat-icon>directions_car</mat-icon><b>Bill’s Premiere</b></div>
          <span class="welcome">Welcome back</span>
          <h2>Sign in to your account</h2>
          <p class="intro">Enter your details to access the operations dashboard.</p>

          <label>Email address</label>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-icon matPrefix>mail_outline</mat-icon>
            <input matInput type="email" formControlName="email" autocomplete="email" placeholder="you@company.com">
          </mat-form-field>
          <label>Password</label>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-icon matPrefix>lock_outline</mat-icon>
            <input matInput [type]="hidePassword() ? 'password' : 'text'" formControlName="password" autocomplete="current-password" placeholder="Minimum 6 characters">
            <button type="button" mat-icon-button matSuffix (click)="hidePassword.set(!hidePassword())" aria-label="Toggle password visibility"><mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon></button>
          </mat-form-field>
          <div class="form-options"><mat-checkbox formControlName="remember">Remember me</mat-checkbox><button type="button">Forgot password?</button></div>
          @if (error()) { <div class="error"><mat-icon>error_outline</mat-icon>{{ error() }}</div> }
          <button mat-flat-button class="sign-in" type="submit" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Signing in…' : 'Sign in' }} @if (!loading()) { <mat-icon>arrow_forward</mat-icon> }
          </button>
          <p class="demo"><mat-icon>info_outline</mat-icon>Demo: use <b>admin&#64;billspremiere.com</b> and any 6+ character password.</p>
        </form>
        <footer>© 2026 Bill’s Premiere · Privacy · Support</footer>
      </section>
    </div>
  `,
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  readonly hidePassword = signal(true);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    email: new FormControl('admin@billspremiere.com', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('premiere', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    remember: new FormControl(true, { nonNullable: true }),
  });
  constructor(private readonly auth: AuthService, private readonly router: Router) {}
  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true); this.error.set('');
    const { email, password } = this.form.getRawValue();
    if (this.auth.login(email, password)) void this.router.navigate(['/dashboard']);
    else this.error.set('Please check your email and password.');
    this.loading.set(false);
  }
}
