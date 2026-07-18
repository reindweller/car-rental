import { Component, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  template: `
    <div class="shell" [class.nav-collapsed]="collapsed()">
      <aside class="sidebar" [class.open]="mobileOpen()">
        <a class="brand" routerLink="/dashboard" (click)="mobileOpen.set(false)">
          <span class="brand-mark"><mat-icon>directions_car</mat-icon></span>
          <span class="brand-copy"><strong>Bill’s Premiere</strong><small>Rental operations</small></span>
        </a>

        <nav aria-label="Main navigation">
          <span class="nav-label">Workspace</span>
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" [matTooltip]="collapsed() ? item.label : ''"
               matTooltipPosition="right" (click)="mobileOpen.set(false)">
              <mat-icon>{{ item.icon }}</mat-icon><span>{{ item.label }}</span>
              @if (item.badge) { <b>{{ item.badge }}</b> }
            </a>
          }
        </nav>

        <div class="sidebar-bottom">
          <div class="help-card">
            <mat-icon>support_agent</mat-icon>
            <div><strong>Need help?</strong><small>Read the operator guide</small></div>
          </div>
          <button mat-icon-button class="collapse" (click)="collapsed.set(!collapsed())" aria-label="Toggle sidebar">
            <mat-icon>{{ collapsed() ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left' }}</mat-icon>
          </button>
        </div>
      </aside>
      @if (mobileOpen()) { <button class="scrim" aria-label="Close menu" (click)="mobileOpen.set(false)"></button> }

      <section class="page">
        <header class="topbar">
          <button mat-icon-button class="mobile-menu" (click)="mobileOpen.set(true)" aria-label="Open menu"><mat-icon>menu</mat-icon></button>
          <div class="topbar-spacer"></div>
          <button mat-icon-button aria-label="Notifications" class="notification"><mat-icon>notifications_none</mat-icon><i></i></button>
          <button class="profile" [matMenuTriggerFor]="accountMenu">
            <span class="avatar">{{ initials() }}</span>
            <span><strong>{{ auth.currentUser()?.name }}</strong><small>{{ auth.currentUser()?.role }}</small></span>
            <mat-icon>expand_more</mat-icon>
          </button>
          <mat-menu #accountMenu="matMenu" xPosition="before">
            <button mat-menu-item><mat-icon>person_outline</mat-icon><span>My profile</span></button>
            <button mat-menu-item (click)="auth.logout()"><mat-icon>logout</mat-icon><span>Sign out</span></button>
          </mat-menu>
        </header>
        <main><router-outlet /></main>
      </section>
    </div>
  `,
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly nav = [
    { path: '/dashboard', label: 'Dashboard', icon: 'grid_view', badge: '' },
    { path: '/vehicles', label: 'Vehicles', icon: 'directions_car', badge: '5' },
    { path: '/bookings', label: 'Bookings', icon: 'calendar_month', badge: '4' },
    { path: '/users', label: 'User management', icon: 'group', badge: '' },
  ];
  readonly initials = computed(() => this.auth.currentUser()?.name.split(' ').map(p => p[0]).join('').slice(0, 2) ?? 'AM');
  constructor(readonly auth: AuthService) {}
}
