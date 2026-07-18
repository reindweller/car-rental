import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'drivewise.session';
  readonly currentUser = signal<{ name: string; email: string; role: string } | null>(this.readSession());

  constructor(private readonly router: Router) {}

  login(email: string, password: string): boolean {
    if (!email.trim() || password.length < 6) return false;
    const session = { name: 'Alex Morgan', email, role: 'Administrator' };
    localStorage.setItem(this.storageKey, JSON.stringify(session));
    this.currentUser.set(session);
    return true;
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
    this.currentUser.set(null);
    void this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean { return this.currentUser() !== null; }

  private readSession(): { name: string; email: string; role: string } | null {
    try { return JSON.parse(localStorage.getItem(this.storageKey) ?? 'null'); }
    catch { return null; }
  }
}
