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
  templateUrl: './users.component.html',
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
    ref.afterClosed().subscribe(async (result?: {name: string; email: string; role: UserRole}) => {
      if (!result) return;
      try {
        if (user) await this.data.updateUser({ ...user, ...result, initials: result.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() });
        else await this.data.addUser(result.name, result.email, result.role);
        this.snack.open(user ? 'User updated' : 'Cognito invitation sent', 'Dismiss', { duration: 2500 });
      } catch {
        this.snack.open('The Cognito user could not be updated.', 'Dismiss', { duration: 3000 });
      }
    });
  }
  async toggleStatus(user: AppUser): Promise<void> {
    try {
      await this.data.updateUser({ ...user, status: user.status === 'Suspended' ? 'Active' : 'Suspended' });
      this.snack.open('Account status updated', 'Dismiss', { duration: 2200 });
    } catch { this.snack.open('Account status could not be updated', 'Dismiss', { duration: 2600 }); }
  }
  async remove(user: AppUser): Promise<void> {
    try {
      await this.data.removeUser(user.id);
      this.snack.open(`${user.name} removed`, 'Dismiss', { duration: 2200 });
    } catch { this.snack.open('You cannot remove your own account or the last administrator.', 'Dismiss', { duration: 3000 }); }
  }
}
