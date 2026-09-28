import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../core/auth.service';
import { DataService } from '../core/data.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly data = inject(DataService);
  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly nav = computed(() => [
    { path: '/dashboard', label: 'Dashboard', icon: 'grid_view', badge: '', adminOnly: false },
    { path: '/vehicles', label: 'Vehicles', icon: 'directions_car', badge: String(this.data.vehicles().length), adminOnly: false },
    { path: '/bookings', label: 'Bookings', icon: 'calendar_month', badge: String(this.data.bookings().length), adminOnly: false },
    { path: '/users', label: 'User management', icon: 'group', badge: '', adminOnly: true },
  ]);
  readonly initials = computed(() => this.auth.currentUser()?.name.split(' ').map(p => p[0]).join('').slice(0, 2) ?? 'AM');
  constructor(readonly auth: AuthService) {}
}
