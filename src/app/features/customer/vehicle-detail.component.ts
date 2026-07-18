import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DataService } from '../../core/data.service';

@Component({
  selector: 'app-vehicle-detail',
  imports: [CurrencyPipe, RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="detail-page">
      <header class="site-header"><a class="brand" routerLink="/"><span><mat-icon>directions_car</mat-icon></span><b>Bill’s Premiere</b></a><nav><a routerLink="/">Home</a><a routerLink="/book">Book a car</a></nav><a mat-flat-button [routerLink]="['/book']" [queryParams]="{vehicle: vehicle.id}">Reserve this car</a></header>

      <main>
        <a class="back" routerLink="/"><mat-icon>arrow_back</mat-icon>Back to all vehicles</a>
        <section class="hero">
          <div class="photo"><img [src]="vehicle.imageUrl" [alt]="vehicle.year + ' ' + vehicle.name"><span><mat-icon>verified</mat-icon>Available</span></div>
          <div class="intro">
            <span class="category">{{ vehicle.category }}</span>
            <h1>{{ vehicle.name }}</h1><p class="year">{{ vehicle.year }} {{ vehicle.trim }}</p>
            <div class="rating">@if (vehicle.rating) {<mat-icon>star</mat-icon><b>{{ vehicle.rating }}</b><span>({{ vehicle.reviewCount }} ratings)</span><i></i><span>{{ vehicle.trips }} trips</span>} @else {<span>New listing · Be the first to review</span>}</div>
            <div class="specs"><span><mat-icon>airline_seat_recline_normal</mat-icon><b>{{ vehicle.seats }}</b><small>Seats</small></span><span><mat-icon>local_gas_station</mat-icon><b>{{ vehicle.fuel }}</b><small>{{ vehicle.mpg }} MPG</small></span><span><mat-icon>settings</mat-icon><b>{{ vehicle.transmission }}</b><small>Transmission</small></span></div>
            <div class="price"><span>Daily rental rate<small>Taxes and optional extras calculated at booking</small></span><strong>{{ vehicle.price | currency:'USD':'symbol':'1.2-2' }}<small>/ day</small></strong></div>
            <a mat-flat-button class="book" [routerLink]="['/book']" [queryParams]="{vehicle: vehicle.id}">Check dates & book <mat-icon>arrow_forward</mat-icon></a>
          </div>
        </section>

        <div class="content-grid">
          <div class="content-main">
            <section class="panel" id="features"><header><span><mat-icon>auto_awesome</mat-icon></span><div><h2>Vehicle features</h2><p>Everything included with this {{ vehicle.name }}.</p></div></header><div class="feature-groups">@for (group of vehicle.features; track group.group) {<div><h3>{{ group.group }}</h3><ul>@for (feature of group.items; track feature) {<li><mat-icon>check</mat-icon>{{ feature }}</li>}</ul></div>}</div></section>

            <section class="panel" id="included"><header><span><mat-icon>inventory_2</mat-icon></span><div><h2>Included in the price</h2><p>Convenience and peace of mind come standard.</p></div></header><div class="included-grid">@for (item of vehicle.included; track item) {<div><mat-icon>check_circle</mat-icon><span>{{ item }}</span></div>}</div></section>

            <section class="panel" id="extras"><header><span><mat-icon>add_circle</mat-icon></span><div><h2>Extras</h2><p>Optional additions to make your trip even easier.</p></div></header>
              @if (vehicle.extras.length) {<div class="extras-grid">@for (extra of vehicle.extras; track extra.name) {<article><div class="extra-icon"><mat-icon>{{ extraIcon(extra.name) }}</mat-icon></div><div><h3>{{ extra.name }}</h3><p>{{ extra.description }}</p></div><strong>{{ extra.price }}</strong></article>}</div>} @else {<div class="empty"><mat-icon>luggage</mat-icon><div><b>No extras listed yet</b><span>You can still book this vehicle with everything shown above.</span></div></div>}
            </section>

            <section class="panel" id="reviews"><header><span><mat-icon>reviews</mat-icon></span><div><h2>Ratings and reviews</h2><p>Feedback from verified trips.</p></div></header>
              <div class="review-summary"><div><strong>{{ vehicle.rating ?? 'New' }}</strong>@if (vehicle.rating) {<span>★★★★★</span><small>Based on {{ vehicle.reviewCount }} ratings</small>} @else {<small>No ratings yet</small>}</div><div class="bars">@for (row of [5,4,3,2,1]; track row) {<span><b>{{ row }}</b><mat-icon>star</mat-icon><i><em [style.width]="row === 5 && vehicle.rating ? '98%' : '0%'"></em></i></span>}</div></div>
              @if (vehicle.reviews.length) {<div class="reviews">@for (review of vehicle.reviews; track review.author + review.date) {<article><div class="review-avatar">{{ initials(review.author) }}</div><div><header><span><b>{{ review.author }}</b><small>{{ review.date }}</small></span><em>★★★★★</em></header><p>{{ review.body }}</p></div></article>}</div>} @else {<div class="empty"><mat-icon>rate_review</mat-icon><div><b>Be the first to review this vehicle</b><span>Book a trip and share your experience.</span></div></div>}
            </section>
          </div>

          <aside><div class="sticky-card"><h3>Ready to drive?</h3><p>Choose your dates to see the full trip price.</p><div><span>From</span><b>{{ vehicle.price | currency:'USD':'symbol':'1.2-2' }} <small>/ day</small></b></div><a mat-flat-button [routerLink]="['/book']" [queryParams]="{vehicle: vehicle.id}">Book this vehicle</a><span class="assurance"><mat-icon>event_available</mat-icon>Free changes up to 24 hours before pickup</span><span class="assurance"><mat-icon>support_agent</mat-icon>24/7 customer support</span></div></aside>
        </div>
      </main>
      <footer>© 2026 Bill’s Premiere · Better cars. Better journeys.</footer>
    </div>
  `,
  styleUrl: './vehicle-detail.component.scss',
})
export class VehicleDetailComponent {
  private readonly data = inject(DataService);
  private readonly route = inject(ActivatedRoute);
  readonly vehicle = this.data.vehicles().find(vehicle => vehicle.id === Number(this.route.snapshot.paramMap.get('id'))) ?? this.data.vehicles()[0];
  initials(name: string): string { return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(); }
  extraIcon(name: string): string {
    if (name.includes('seat')) return 'child_friendly';
    if (name.includes('Cooler')) return 'kitchen';
    if (name.includes('Snorkel')) return 'scuba_diving';
    if (name.includes('wagon')) return 'beach_access';
    return 'camping';
  }
}
