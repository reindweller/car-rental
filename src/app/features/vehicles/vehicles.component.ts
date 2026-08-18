import { Component, computed, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AddVehicleDialogResult, DataService } from '../../core/data.service';
import { AddVehicleDialogComponent } from './add-vehicle-dialog.component';
import { DeleteVehicleDialogComponent } from './delete-vehicle-dialog.component';
import { Vehicle } from '../../core/models';

@Component({
  selector: 'app-vehicles',
  imports: [CurrencyPipe, RouterLink, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule, MatSelectModule, MatSnackBarModule],
  templateUrl: './vehicles.component.html',
  styleUrl: './vehicles.component.scss',
})
export class VehiclesComponent {
  readonly search = signal(''); readonly status = signal('All');
  readonly filtered = computed(() => this.data.vehicles().filter(v => (this.status() === 'All' || v.status === this.status()) && `${v.name} ${v.plate} ${v.category}`.toLowerCase().includes(this.search().toLowerCase())));
  constructor(readonly data: DataService, private readonly dialog: MatDialog, private readonly snack: MatSnackBar) {}
  openAddVehicle(): void {
    const ref = this.dialog.open(AddVehicleDialogComponent, { width: '760px', maxWidth: '96vw', maxHeight: '92vh', autoFocus: 'first-tabbable' });
    ref.afterClosed().subscribe(async (result?: AddVehicleDialogResult) => {
      if (!result) return;
      try {
        const uploadedUrls = await Promise.all(result.photos.map(photo => this.data.uploadVehiclePhoto(photo)));
        const imageUrls = result.photoOrder.map(photo => uploadedUrls[photo.index]);
        const vehicle = await this.data.addVehicle({
          ...result.input,
          imageUrl: imageUrls[0],
          imageUrls,
        });
        this.search.set(''); this.status.set('All');
        this.snack.open(`${vehicle.year} ${vehicle.name} added to the fleet`, 'View', { duration: 3500 })
          .onAction().subscribe(() => window.open(`/vehicle/${vehicle.id}`, '_self'));
      } catch {
        this.snack.open('The vehicle could not be saved.', 'Dismiss', { duration: 3500 });
      }
    });
  }
  openEditVehicle(vehicle: Vehicle): void {
    const ref = this.dialog.open(AddVehicleDialogComponent, {
      width: '760px', maxWidth: '96vw', maxHeight: '92vh', autoFocus: 'first-tabbable', data: { vehicle },
    });
    ref.afterClosed().subscribe(async (result?: AddVehicleDialogResult) => {
      if (!result) return;
      try {
        const newImageUrls = await Promise.all(result.photos.map(photo => this.data.uploadVehiclePhoto(photo)));
        const existingImageUrls = vehicle.imageUrls?.length ? vehicle.imageUrls : [vehicle.imageUrl];
        const imageUrls = result.photoOrder.map(photo => photo.type === 'existing' ? existingImageUrls[photo.index] : newImageUrls[photo.index]);
        await this.data.updateVehicle({
          ...vehicle,
          ...result.input,
          imageUrl: imageUrls[0],
          imageUrls,
          rules: result.input.rules.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean),
        });
        this.snack.open(`${result.input.year} ${result.input.name} updated`, 'Dismiss', { duration: 3500 });
      } catch {
        this.snack.open('The vehicle changes could not be saved.', 'Dismiss', { duration: 3500 });
      }
    });
  }

  deleteVehicle(vehicle: Vehicle): void {
    const ref = this.dialog.open(DeleteVehicleDialogComponent, {
      data: vehicle,
      width: '430px',
      maxWidth: '94vw',
      autoFocus: false,
    });
    ref.afterClosed().subscribe(async (confirmed?: boolean) => {
      if (!confirmed) return;
      try {
        await this.data.removeVehicle(vehicle.id);
        this.snack.open(`${vehicle.year} ${vehicle.name} deleted`, 'Dismiss', { duration: 3000 });
      } catch {
        this.snack.open('The vehicle could not be deleted.', 'Dismiss', { duration: 3500 });
      }
    });
  }
}
