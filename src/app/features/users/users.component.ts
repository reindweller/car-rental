import { Component, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DataService } from '../../core/data.service';
import { AppUser, UserRole } from '../../core/models';
import { UserDialogComponent } from './user-dialog.component';

@Component({
  selector: 'app-users',
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule, MatSelectModule, MatSnackBarModule],
  template: `
    <div class="page-heading"><div><h1>User management</h1><p>Manage team access, roles, and account status.</p></div><button mat-flat-button (click)="openDialog()"><mat-icon>person_add</mat-icon>Invite user</button></div>
    <section class="role-cards">
      <article><span class="role-icon admin"><mat-icon>admin_panel_settings</mat-icon></span><div><strong>Administrators</strong><small>Full workspace access</small></div><b>{{ countRole('Administrator') }}</b></article>
      <article><span class="role-icon manager"><mat-icon>manage_accounts</mat-icon></span><div><strong>Managers</strong><small>Fleet and booking controls</small></div><b>{{ countRole('Manager') }}</b></article>
      <article><span class="role-icon agent"><mat-icon>support_agent</mat-icon></span><div><strong>Agents</strong><small>Daily rental operations</small></div><b>{{ countRole('Agent') }}</b></article>
    </section>
    <section class="panel">
      <div class="toolbar"><mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-icon matPrefix>search</mat-icon><input matInput placeholder="Search name or email" (input)="search.set($any($event.target).value)"></mat-form-field><mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Role</mat-label><mat-select [value]="role()" (valueChange)="role.set($event)"><mat-option value="All">All roles</mat-option><mat-option value="Administrator">Administrator</mat-option><mat-option value="Manager">Manager</mat-option><mat-option value="Agent">Agent</mat-option></mat-select></mat-form-field><span>{{ filtered().length }} team members</span></div>
      <div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last active</th><th></th></tr></thead><tbody>
        @for (user of filtered(); track user.id) {<tr><td><span class="avatar">{{ user.initials }}</span><div><b>{{ user.name }}</b><small>{{ user.email }}</small></div></td><td><span class="role"><mat-icon>{{ roleIcon(user.role) }}</mat-icon>{{ user.role }}</span></td><td><span class="status" [attr.data-status]="user.status"><i></i>{{ user.status }}</span></td><td class="last-active">{{ user.lastActive }}</td><td><button mat-icon-button [matMenuTriggerFor]="actions" [matMenuTriggerData]="{user: user}"><mat-icon>more_horiz</mat-icon></button></td></tr>}
      </tbody></table></div>
    </section>
    <mat-menu #actions="matMenu"><ng-template matMenuContent let-user="user"><button mat-menu-item (click)="openDialog(user)"><mat-icon>edit</mat-icon>Edit user</button><button mat-menu-item (click)="toggleStatus(user)"><mat-icon>{{ user.status === 'Suspended' ? 'check_circle' : 'block' }}</mat-icon>{{ user.status === 'Suspended' ? 'Reactivate' : 'Suspend' }}</button><button mat-menu-item class="danger" (click)="remove(user)"><mat-icon>delete_outline</mat-icon>Remove user</button></ng-template></mat-menu>
  `,
  styleUrl: './users.component.scss',
})
export class UsersComponent {
  readonly search = signal(''); readonly role = signal('All');
  readonly filtered = computed(() => this.data.users().filter(u => (this.role() === 'All' || u.role === this.role()) && `${u.name} ${u.email}`.toLowerCase().includes(this.search().toLowerCase())));
  constructor(readonly data: DataService, private readonly dialog: MatDialog, private readonly snack: MatSnackBar) {}
  countRole(role: UserRole): number { return this.data.users().filter(u => u.role === role).length; }
  roleIcon(role: UserRole): string { return role === 'Administrator' ? 'shield' : role === 'Manager' ? 'manage_accounts' : 'headset_mic'; }
  openDialog(user: AppUser | null = null): void {
    const ref = this.dialog.open(UserDialogComponent, { data: user, width: '500px', autoFocus: 'first-tabbable' });
    ref.afterClosed().subscribe((result?: {name: string; email: string; role: UserRole}) => {
      if (!result) return;
      if (user) this.data.updateUser({ ...user, ...result, initials: result.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() });
      else this.data.addUser(result.name, result.email, result.role);
      this.snack.open(user ? 'User updated' : 'Invitation sent', 'Dismiss', { duration: 2500 });
    });
  }
  toggleStatus(user: AppUser): void { this.data.updateUser({ ...user, status: user.status === 'Suspended' ? 'Active' : 'Suspended' }); this.snack.open('Account status updated', 'Dismiss', { duration: 2200 }); }
  remove(user: AppUser): void { if (user.id === 1) { this.snack.open('The workspace owner cannot be removed', 'Dismiss', { duration: 2500 }); return; } this.data.removeUser(user.id); this.snack.open(`${user.name} removed`, 'Dismiss', { duration: 2200 }); }
}
