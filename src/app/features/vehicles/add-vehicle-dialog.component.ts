import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { AddVehicleDialogResult, AddVehicleInput } from '../../core/data.service';
import { Vehicle } from '../../core/models';

export interface VehicleDialogData {
  vehicle?: Vehicle;
}

@Component({
  selector: 'app-add-vehicle-dialog',
  imports: [ReactiveFormsModule, DragDropModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  templateUrl: './add-vehicle-dialog.component.html',
  styles: [`
    .dialog-heading{display:flex;gap:12px;align-items:center;padding:22px 24px 5px}.dialog-heading>span{width:42px;height:42px;border-radius:10px;display:grid;place-items:center;background:#dbeafe;color:#2563eb}.dialog-heading h2{padding:0;margin:0;font-size:19px}.dialog-heading p{margin:4px 0 0;color:#718096;font-size:9px}mat-dialog-content{padding-top:10px!important}form{width:min(680px,78vw);display:grid}h3{font-size:9px;text-transform:uppercase;letter-spacing:.09em;color:#64748b;margin:17px 0 10px}.fields{display:grid;gap:10px}.fields.two{grid-template-columns:1fr 1fr}.fields.three{grid-template-columns:1fr 1fr 1fr}.fields.four{grid-template-columns:repeat(4,1fr)}mat-form-field{width:100%}.locations{display:grid;gap:8px}.location-row{display:grid;grid-template-columns:1fr 38px;gap:7px;align-items:start}.location-row button{margin-top:3px}.add-location{width:max-content;font-size:10px}.location-help{margin:0;color:#718096;font-size:8px}.photo-upload{display:grid;gap:8px}.upload-button{display:flex;align-items:center;justify-content:center;gap:12px;min-height:82px;border:1.5px dashed #93c5fd;border-radius:10px;background:#f8fbff;color:#2563eb;cursor:pointer}.upload-button:hover{background:#eff6ff}.upload-button:disabled{cursor:not-allowed;opacity:.55}.upload-button>mat-icon{font-size:28px;width:28px;height:28px}.upload-button span{display:grid;text-align:left}.upload-button b{font-size:11px}.upload-button small,.selected-file small{color:#64748b;font-size:8px;margin-top:3px}.photo-count{color:#64748b;font-size:8px}.selected-files{display:grid;grid-template-columns:1fr 1fr;gap:6px}.selected-file{display:flex;align-items:center;gap:5px;padding:8px 10px;border-radius:8px;background:#f1f5f9;min-width:0}.selected-file>mat-icon{color:#2563eb}.selected-file span{display:grid;min-width:0;flex:1}.selected-file b{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.selected-file button{width:28px;height:28px;padding:2px}.selected-file button mat-icon{font-size:17px;width:17px;height:17px}.crop-editor{display:grid;gap:10px;padding:12px;border:1px solid #bfdbfe;border-radius:10px;background:#f8fbff}.crop-heading{display:flex;align-items:center;justify-content:space-between}.crop-heading span{display:grid}.crop-heading b{font-size:10px}.crop-heading small{color:#64748b;font-size:8px;margin-top:3px}.crop-frame{aspect-ratio:16/9;overflow:hidden;border-radius:8px;background:#0f172a}.crop-frame img{width:100%;height:100%;object-fit:cover;transition:transform .12s ease}.crop-controls{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.crop-controls label{display:grid;gap:4px}.crop-controls span{color:#475569;font-size:8px;font-weight:700}.crop-controls input{width:100%;accent-color:#2563eb}.crop-actions{display:flex;justify-content:flex-end;gap:6px}.crop-actions button{font-size:9px}.photo-error{display:flex;align-items:center;gap:5px;color:#b91c1c;font-size:9px;margin:0}.photo-error mat-icon{font-size:15px;width:15px;height:15px}.previews{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:2px 0 10px}.preview{height:105px;position:relative;overflow:hidden;border-radius:9px;background:#edf1f5}.preview img{width:100%;height:100%;object-fit:cover}.preview span{position:absolute;left:8px;bottom:8px;padding:4px 7px;border-radius:5px;background:#ffffffdd;font-size:7px;font-weight:700}@media(max-width:650px){form{width:75vw}.fields.two,.fields.three,.fields.four,.selected-files,.crop-controls{grid-template-columns:1fr}.previews{grid-template-columns:1fr 1fr}.preview{height:110px}}
  `, `
    .listing-text-field{margin-bottom:14px}.feature-group-editors{display:grid;gap:10px;margin-bottom:14px}.feature-group-editor{padding:12px 12px 3px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}.feature-group-heading{display:grid;grid-template-columns:1fr 38px;gap:7px;align-items:start}.feature-group-heading button{margin-top:3px;color:#dc2626}.add-feature-group{width:max-content;font-size:10px}.photo-order-help{display:flex;align-items:center;gap:5px;color:#64748b;font-size:8px;margin:2px 0}.photo-order-help mat-icon{font-size:14px;width:14px;height:14px}.preview{cursor:grab}.preview:active{cursor:grabbing}.drag-handle,.remove-photo{position:absolute;right:7px;width:24px;height:24px;border:0;border-radius:5px;background:#ffffffdd;color:#475569;display:grid;place-items:center}.drag-handle{top:7px}.remove-photo{bottom:7px;color:#dc2626;cursor:pointer}.remove-photo:disabled{color:#94a3b8;cursor:not-allowed;opacity:.65}.drag-handle mat-icon,.remove-photo mat-icon{font-size:15px;width:15px;height:15px}.cdk-drag-preview{box-sizing:border-box;border-radius:9px;box-shadow:0 8px 20px #0f172a44}.cdk-drag-placeholder{opacity:.35}
  `],
})
export class AddVehicleDialogComponent implements OnDestroy {
  private readonly ref = inject(MatDialogRef<AddVehicleDialogComponent>);
  readonly dialogData = inject<VehicleDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  readonly vehicle = this.dialogData.vehicle;
  readonly selectedPhotos = signal<File[]>([]);
  readonly originalPhotos = signal<File[]>([]);
  readonly localPreviews = signal<string[]>([]);
  readonly originalPreviews = signal<string[]>([]);
  readonly photoError = signal('');
  readonly processingPhotos = signal(false);
  readonly cropIndex = signal<number | null>(null);
  readonly cropX = signal(50);
  readonly cropY = signal(50);
  readonly cropZoom = signal(1);
  readonly photoOrder = signal<{ type: 'existing' | 'new'; index: number }[]>([]);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    year: new FormControl(new Date().getFullYear(), { nonNullable: true, validators: [Validators.required, Validators.min(1990), Validators.max(2030)] }),
    trim: new FormControl('', { nonNullable: true, validators: Validators.required }),
    category: new FormControl('', { nonNullable: true, validators: Validators.required }),
    plate: new FormControl('', { nonNullable: true, validators: Validators.required }),
    seats: new FormControl(5, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(15)] }),
    mpg: new FormControl(25, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    fuel: new FormControl('Gas', { nonNullable: true, validators: Validators.required }),
    transmission: new FormControl('Automatic', { nonNullable: true, validators: Validators.required }),
    price: new FormControl(50, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    status: new FormControl<AddVehicleInput['status']>('Available', { nonNullable: true, validators: Validators.required }),
    carLocation: new FormControl('', { nonNullable: true, validators: Validators.maxLength(250) }),
    pickupLocations: new FormArray<FormControl<string>>([]),
    featureGroups: new FormArray<FormGroup<{
      group: FormControl<string>;
      items: FormControl<string>;
    }>>([]),
    includedGroups: new FormArray<FormGroup<{
      group: FormControl<string>;
      items: FormControl<string>;
    }>>([]),
    rules: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  constructor() {
    this.photoOrder.set(this.existingPhotoUrls().map((_, index) => ({ type: 'existing', index })));
    if (!this.vehicle) {
      this.addFeatureGroup();
      this.addIncludedGroup();
      return;
    }
    this.form.patchValue({
      name: this.vehicle.name, year: this.vehicle.year, trim: this.vehicle.trim,
      category: this.vehicle.category, plate: this.vehicle.plate, seats: this.vehicle.seats,
      mpg: this.vehicle.mpg, fuel: this.vehicle.fuel, transmission: this.vehicle.transmission,
      price: this.vehicle.price, status: this.vehicle.status, carLocation: this.vehicle.carLocation ?? '',
      rules: (this.vehicle.rules ?? []).join('\n'),
    });
    this.vehicle.features.forEach(feature => this.addFeatureGroup(feature.group, feature.items));
    if (!this.featureGroups.length) this.addFeatureGroup();
    this.vehicle.included.forEach(group => this.addIncludedGroup(group.group, group.items));
    if (!this.includedGroups.length) this.addIncludedGroup();
    (this.vehicle.pickupLocations ?? []).forEach(location => this.addPickupLocation(location));
  }
  get pickupLocations(): FormArray<FormControl<string>> { return this.form.controls.pickupLocations; }
  get featureGroups() { return this.form.controls.featureGroups; }
  get includedGroups() { return this.form.controls.includedGroups; }
  addPickupLocation(value = ''): void {
    if (this.pickupLocations.length >= 15) return;
    this.pickupLocations.push(new FormControl(value, { nonNullable: true, validators: [Validators.required, Validators.maxLength(250)] }));
  }
  removePickupLocation(index: number): void { this.pickupLocations.removeAt(index); }
  addFeatureGroup(group = '', items: string[] = []): void {
    if (this.featureGroups.length >= 12) return;
    this.featureGroups.push(new FormGroup({
      group: new FormControl(group, { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
      items: new FormControl(items.join('\n'), { nonNullable: true, validators: Validators.required }),
    }));
  }
  removeFeatureGroup(index: number): void {
    if (this.featureGroups.length > 1) this.featureGroups.removeAt(index);
  }
  addIncludedGroup(group = '', items: string[] = []): void {
    if (this.includedGroups.length >= 12) return;
    this.includedGroups.push(new FormGroup({
      group: new FormControl(group, { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
      items: new FormControl(items.join('\n'), { nonNullable: true, validators: Validators.required }),
    }));
  }
  removeIncludedGroup(index: number): void {
    if (this.includedGroups.length > 1) this.includedGroups.removeAt(index);
  }
  previewSources(): string[] {
    return this.photoOrder().map(item => item.type === 'existing' ? this.existingPhotoUrls()[item.index] : this.localPreviews()[item.index]);
  }
  existingPhotoUrls(): string[] { return this.vehicle?.imageUrls?.length ? this.vehicle.imageUrls : this.vehicle?.imageUrl ? [this.vehicle.imageUrl] : []; }
  fileSize(file: File): string { return `${(file.size / 1_048_576).toFixed(1)} MB`; }
  canSave(): boolean {
    const featuresValid = this.featureGroups.controls.every(control =>
      control.controls.group.value.trim() && this.featureItems(control.controls.items.value).length,
    );
    const includedValid = this.includedGroups.controls.every(control =>
      control.controls.group.value.trim() && this.featureItems(control.controls.items.value).length,
    );
    return this.form.valid && featuresValid && includedValid && this.photoOrder().length > 0 && !this.processingPhotos() && this.cropIndex() === null;
  }
  async selectPhotos(files?: FileList): Promise<void> {
    if (!files?.length) return;
    this.photoError.set('');
    const remaining = 15 - this.photoOrder().length;
    if (!remaining) {
      this.photoError.set('You can add up to 15 photos.');
      return;
    }
    const accepted: File[] = [];
    for (const file of Array.from(files).slice(0, remaining)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        this.photoError.set('Only JPEG, PNG, and WebP photos can be added.');
      } else {
        accepted.push(file);
      }
    }
    if (files.length > remaining) this.photoError.set('You can add up to 15 photos.');
    if (!accepted.length) return;
    this.processingPhotos.set(true);
    try {
      const cropped = await Promise.all(accepted.map(file => this.cropPhoto(file, 50, 50, 1)));
      this.originalPhotos.update(current => [...current, ...accepted]);
      this.selectedPhotos.update(current => [...current, ...cropped]);
      this.originalPreviews.update(current => [...current, ...accepted.map(file => URL.createObjectURL(file))]);
      this.localPreviews.update(current => [...current, ...cropped.map(file => URL.createObjectURL(file))]);
      this.photoOrder.update(current => [...current, ...cropped.map((_, index) => ({ type: 'new' as const, index: this.selectedPhotos().length - cropped.length + index }))]);
    } catch {
      this.photoError.set('One or more photos could not be cropped. Please try different files.');
    } finally {
      this.processingPhotos.set(false);
    }
  }
  editCrop(index: number): void {
    this.cropX.set(50);
    this.cropY.set(50);
    this.cropZoom.set(1);
    this.cropIndex.set(index);
  }
  cancelCrop(): void {
    this.cropIndex.set(null);
  }
  async applyCrop(): Promise<void> {
    const index = this.cropIndex();
    if (index === null) return;
    this.processingPhotos.set(true);
    try {
      const cropped = await this.cropPhoto(
        this.originalPhotos()[index],
        this.cropX(),
        this.cropY(),
        this.cropZoom(),
      );
      URL.revokeObjectURL(this.localPreviews()[index]);
      this.selectedPhotos.update(current => current.map((photo, photoIndex) => photoIndex === index ? cropped : photo));
      this.localPreviews.update(current => current.map((preview, photoIndex) => photoIndex === index ? URL.createObjectURL(cropped) : preview));
      this.cropIndex.set(null);
    } catch {
      this.photoError.set('This photo could not be cropped. Please try a different file.');
    } finally {
      this.processingPhotos.set(false);
    }
  }
  removePhoto(index: number, input: HTMLInputElement): void {
    if (this.photoOrder().length <= 1) {
      this.photoError.set('A vehicle must have at least one photo.');
      return;
    }
    URL.revokeObjectURL(this.localPreviews()[index]);
    URL.revokeObjectURL(this.originalPreviews()[index]);
    this.selectedPhotos.update(current => current.filter((_, photoIndex) => photoIndex !== index));
    this.originalPhotos.update(current => current.filter((_, photoIndex) => photoIndex !== index));
    this.localPreviews.update(current => current.filter((_, photoIndex) => photoIndex !== index));
    this.originalPreviews.update(current => current.filter((_, photoIndex) => photoIndex !== index));
    this.photoOrder.update(current => current
      .filter(item => item.type !== 'new' || item.index !== index)
      .map(item => item.type === 'new' && item.index > index ? { ...item, index: item.index - 1 } : item));
    const openCrop = this.cropIndex();
    if (openCrop === index) this.cropIndex.set(null);
    else if (openCrop !== null && openCrop > index) this.cropIndex.set(openCrop - 1);
    this.photoError.set('');
    input.value = '';
  }
  removeOrderedPhoto(orderIndex: number, input: HTMLInputElement): void {
    const item = this.photoOrder()[orderIndex];
    if (!item) return;
    if (this.photoOrder().length <= 1) {
      this.photoError.set('A vehicle must have at least one photo.');
      return;
    }
    if (item.type === 'new') {
      this.removePhoto(item.index, input);
      return;
    }
    this.photoOrder.update(current => current.filter((_, index) => index !== orderIndex));
    this.photoError.set('');
  }
  reorderPhotos(event: CdkDragDrop<string[]>): void {
    this.photoOrder.update(current => {
      const order = [...current];
      moveItemInArray(order, event.previousIndex, event.currentIndex);
      return order;
    });
  }
  save(): void {
    if (!this.canSave()) return;
    const { featureGroups, includedGroups, ...formValue } = this.form.getRawValue();
    const input: Omit<AddVehicleInput, 'imageUrl' | 'imageUrls'> = {
      ...formValue,
      features: featureGroups.map(feature => ({
        group: feature.group.trim(),
        items: this.featureItems(feature.items),
      })),
      included: includedGroups.map(included => ({
        group: included.group.trim(),
        items: this.featureItems(included.items),
      })),
    };
    input.carLocation = input.carLocation.trim();
    input.pickupLocations = [...new Set(input.pickupLocations.map(location => location.trim()).filter(Boolean))];
    const result: AddVehicleDialogResult = {
      input,
      photos: this.selectedPhotos(),
      photoOrder: this.photoOrder(),
    };
    this.ref.close(result);
  }
  ngOnDestroy(): void {
    this.localPreviews().forEach(preview => URL.revokeObjectURL(preview));
    this.originalPreviews().forEach(preview => URL.revokeObjectURL(preview));
  }
  private async cropPhoto(file: File, xPercent: number, yPercent: number, zoom: number): Promise<File> {
    const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      const targetRatio = 16 / 9;
      const imageRatio = image.width / image.height;
      const baseWidth = imageRatio > targetRatio ? image.height * targetRatio : image.width;
      const baseHeight = imageRatio > targetRatio ? image.height : image.width / targetRatio;
      const sourceWidth = baseWidth / zoom;
      const sourceHeight = baseHeight / zoom;
      const sourceX = (image.width - sourceWidth) * (xPercent / 100);
      const sourceY = (image.height - sourceHeight) * (yPercent / 100);
      let outputWidth = Math.max(16, Math.floor(Math.min(1920, sourceWidth) / 16) * 16);
      let outputHeight = outputWidth * 9 / 16;
      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const draw = () => {
        canvas.getContext('2d')!.drawImage(
          image,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          outputWidth,
          outputHeight,
        );
      };
      const encode = (type: string, quality: number) => new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(result => result ? resolve(result) : reject(new Error('Crop failed')), type, quality);
      });
      draw();
      let outputType = file.type;
      let quality = 0.9;
      let blob = await encode(outputType, quality);
      const maximumBytes = 8 * 1024 * 1024;
      while (blob.size > maximumBytes) {
        if (outputType === 'image/png') {
          outputType = 'image/jpeg';
          quality = 0.85;
        } else if (quality > 0.55) {
          quality -= 0.1;
        } else {
          outputWidth = Math.max(16, Math.floor(outputWidth * 0.8 / 16) * 16);
          outputHeight = outputWidth * 9 / 16;
          canvas.width = outputWidth;
          canvas.height = outputHeight;
          quality = 0.8;
          draw();
        }
        blob = await encode(outputType, quality);
      }
      const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      const outputName = `${file.name.replace(/\.[^.]+$/, '')}.${extension}`;
      return new File([blob], outputName, { type: blob.type, lastModified: Date.now() });
    } finally {
      image.close();
    }
  }
  private featureItems(value: string): string[] {
    return [...new Set(value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean))];
  }
}
