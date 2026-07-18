import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/customer/landing.component').then(m => m.LandingComponent) },
  { path: 'book', loadComponent: () => import('./features/customer/customer-booking.component').then(m => m.CustomerBookingComponent) },
  { path: 'vehicle/:id', loadComponent: () => import('./features/customer/vehicle-detail.component').then(m => m.VehicleDetailComponent) },
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent) },
  {
    path: '', canActivate: [authGuard], loadComponent: () => import('./layout/shell.component').then(m => m.ShellComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'vehicles', loadComponent: () => import('./features/vehicles/vehicles.component').then(m => m.VehiclesComponent) },
      { path: 'bookings', loadComponent: () => import('./features/bookings/bookings.component').then(m => m.BookingsComponent) },
      { path: 'users', loadComponent: () => import('./features/users/users.component').then(m => m.UsersComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
