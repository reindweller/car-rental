import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Vehicle } from '../../core/models';

@Component({
  selector: 'app-delete-vehicle-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './delete-vehicle-dialog.component.html',
  styleUrl: './delete-vehicle-dialog.component.scss',
})
export class DeleteVehicleDialogComponent {
  readonly vehicle = inject<Vehicle>(MAT_DIALOG_DATA);
  readonly deleting = signal(false);
  private readonly ref = inject(MatDialogRef<DeleteVehicleDialogComponent>);

  confirm(): void {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.ref.close(true);
  }
}
