import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { DataService } from '../../core/data.service';

@Component({
  selector: 'app-vehicle-detail',
  imports: [CurrencyPipe, RouterLink, ReactiveFormsModule, MatButtonModule, MatIconModule, MatInputModule, MatFormFieldModule],
  templateUrl: './vehicle-detail.component.html',
  styleUrl: './vehicle-detail.component.scss',
})
export class VehicleDetailComponent {
  readonly Math = Math;
  private readonly data = inject(DataService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly formBuilder = inject(FormBuilder);
  readonly vehicle = this.data.vehicles().find(vehicle => vehicle.id === Number(this.route.snapshot.paramMap.get('id'))) ?? this.data.vehicles()[0];
  readonly staffMode = this.route.snapshot.data['staff'] === true;
  readonly selectedPhoto = signal(this.vehicle.imageUrl);
  readonly photos = this.vehicle.imageUrls?.length ? this.vehicle.imageUrls : [this.vehicle.imageUrl];
  readonly bookingQueryParams: Params = {
    vehicle: this.vehicle.id,
    ...Object.fromEntries(['location', 'start', 'end', 'category']
      .map(key => [key, this.route.snapshot.queryParamMap.get(key)])
      .filter((entry): entry is [string, string] => !!entry[1])),
  };
  readonly mapUrl: SafeResourceUrl | null = this.vehicle.carLocation
    ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.google.com/maps?q=${encodeURIComponent(this.vehicle.carLocation)}&output=embed`)
    : null;
  readonly directionsUrl = this.vehicle.carLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.vehicle.carLocation)}`
    : '';
  readonly reviewOpen = signal(false);
  readonly reviewSubmitting = signal(false);
  readonly reviewError = signal('');
  readonly reviewSuccess = signal('');
  readonly hoveredRating = signal(0);
  readonly reviewForm = this.formBuilder.nonNullable.group({
    bookingId: ['', [Validators.required, Validators.pattern(/^BK-[A-Z0-9]{8}$/i)]],
    email: ['', [Validators.required, Validators.email]],
    rating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
    body: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
  });
  initials(name: string): string { return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(); }
  starIsFilled(star: number, rating = this.reviewForm.controls.rating.value): boolean {
    return star <= (this.hoveredRating() || rating);
  }
  reviewStars(rating: number): string { return '★'.repeat(rating) + '☆'.repeat(5 - rating); }
  reviewPercentage(star: number): number {
    const reviews = this.vehicle.reviews ?? [];
    if (reviews.length && reviews.length === this.vehicle.reviewCount) {
      return Math.round(reviews.filter(review => review.rating === star).length / reviews.length * 100);
    }
    return Math.round(this.vehicle.rating ?? 0) === star ? 100 : 0;
  }
  openReviewForm(): void {
    this.reviewSuccess.set('');
    this.reviewError.set('');
    this.reviewOpen.set(true);
  }
  async submitReview(): Promise<void> {
    if (this.reviewForm.invalid) {
      this.reviewForm.markAllAsTouched();
      this.reviewError.set('Enter your booking details, choose a star rating, and write at least 10 characters.');
      return;
    }
    this.reviewSubmitting.set(true);
    this.reviewError.set('');
    try {
      const saved = await this.data.addVehicleReview(this.vehicle.id, {
        ...this.reviewForm.getRawValue(),
        bookingId: this.reviewForm.controls.bookingId.value.trim().toUpperCase(),
        email: this.reviewForm.controls.email.value.trim().toLowerCase(),
        body: this.reviewForm.controls.body.value.trim(),
      });
      Object.assign(this.vehicle, saved);
      this.reviewForm.reset({ bookingId: '', email: '', rating: 0, body: '' });
      this.reviewOpen.set(false);
      this.reviewSuccess.set('Thank you. Your verified review has been published.');
    } catch (error) {
      this.reviewError.set(this.data.errorMessage(error));
    } finally {
      this.reviewSubmitting.set(false);
    }
  }
  extraIcon(name: string): string {
    if (name.includes('seat')) return 'child_friendly';
    if (name.includes('Cooler')) return 'kitchen';
    if (name.includes('Snorkel')) return 'scuba_diving';
    if (name.includes('wagon')) return 'beach_access';
    return 'camping';
  }
}
