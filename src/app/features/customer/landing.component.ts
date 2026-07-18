import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DataService } from '../../core/data.service';

@Component({
  selector: 'app-landing',
  imports: [CurrencyPipe, RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="landing">
      <header class="site-header">
        <a class="brand" routerLink="/"><span><mat-icon>directions_car</mat-icon></span><b>Bill’s Premiere</b></a>
        <nav><a href="#fleet">Our fleet</a><a href="#benefits">Why us</a><a href="#reviews">Reviews</a><a href="#contact">Contact</a></nav>
        <div class="header-actions"><a class="staff" routerLink="/login">Staff login</a><a mat-flat-button routerLink="/book">Book a car</a></div>
      </header>

      <main>
        <section class="hero">
          <div class="hero-copy">
            <div class="eyebrow"><span></span>Trusted by 8,000+ happy drivers</div>
            <h1>Your road.<br><em>Your rules.</em></h1>
            <p>Premium cars, honest prices, and zero surprises. From weekend escapes to business trips, your perfect drive starts here.</p>
            <div class="hero-actions"><a mat-flat-button routerLink="/book">Find your car <mat-icon>arrow_forward</mat-icon></a><a class="learn" href="#benefits"><mat-icon>play_circle</mat-icon>See how it works</a></div>
            <div class="trust"><span><mat-icon>verified_user</mat-icon>Fully insured</span><span><mat-icon>schedule</mat-icon>24/7 support</span><span><mat-icon>payments</mat-icon>No hidden fees</span></div>
          </div>
          <div class="hero-visual">
            <div class="sun"></div><div class="mountain mountain-one"></div><div class="mountain mountain-two"></div>
            <div class="car"><mat-icon>directions_car_filled</mat-icon></div>
            <div class="floating-card rating"><span>★</span><div><b>4.9 / 5</b><small>2,400+ reviews</small></div></div>
            <div class="floating-card available"><i></i><div><b>Ready when you are</b><small>Instant confirmation</small></div></div>
          </div>
        </section>

        <section class="quick-book">
          <div><mat-icon>location_on</mat-icon><span><small>Pick-up location</small><b>Downtown Manila</b></span></div>
          <div><mat-icon>calendar_today</mat-icon><span><small>Pick-up date</small><b>Choose your dates</b></span></div>
          <div><mat-icon>directions_car</mat-icon><span><small>Vehicle type</small><b>All categories</b></span></div>
          <a mat-flat-button routerLink="/book"><mat-icon>search</mat-icon>Search cars</a>
        </section>

        <section class="section fleet-section" id="fleet">
          <div class="section-heading"><div><span>Meet the fleet</span><h2>A car for every kind of journey</h2><p>Every vehicle is carefully inspected, professionally cleaned, and ready for the road.</p></div><a routerLink="/book">Explore all cars <mat-icon>arrow_forward</mat-icon></a></div>
          <div class="fleet-grid">
            @for (vehicle of featuredVehicles; track vehicle.id) {
              <article class="car-card">
                <div class="car-art" [style.background]="vehicle.color"><img [src]="vehicle.imageUrl" [alt]="vehicle.year + ' ' + vehicle.name"><span class="category">{{ vehicle.category }}</span><span class="available-badge"><i></i>Available</span></div>
                <div class="car-info"><div><h3>{{ vehicle.year }} {{ vehicle.name }}</h3><span>{{ vehicle.trim }}</span></div><div class="car-rating"><mat-icon>star</mat-icon><b>{{ vehicle.rating ?? 'New' }}</b><span>{{ vehicle.reviewCount ? vehicle.reviewCount + ' ratings · ' + vehicle.trips + ' trips' : 'New listing' }}</span></div><div class="specs"><span><mat-icon>airline_seat_recline_normal</mat-icon>{{ vehicle.seats }} seats</span><span><mat-icon>local_gas_station</mat-icon>{{ vehicle.mpg }} MPG</span><span><mat-icon>settings</mat-icon>{{ vehicle.transmission }}</span></div><footer><span>From <b>{{ vehicle.price | currency:'USD':'symbol':'1.2-2' }}</b> / day</span><a mat-stroked-button [routerLink]="['/vehicle', vehicle.id]">View details</a></footer></div>
              </article>
            }
          </div>
        </section>

        <section class="benefits" id="benefits">
          <div class="benefit-intro"><span>Why Bill’s Premiere</span><h2>More freedom.<br>Less friction.</h2><p>We redesigned car rental around what drivers actually want—clarity, flexibility, and a great car.</p><a mat-flat-button routerLink="/book">Start your journey</a></div>
          <div class="benefit-grid">
            @for (benefit of benefits; track benefit.title) {<article><span><mat-icon>{{ benefit.icon }}</mat-icon></span><div><h3>{{ benefit.title }}</h3><p>{{ benefit.copy }}</p></div></article>}
          </div>
        </section>

        <section class="testimonial" id="reviews"><div class="quote-mark">“</div><blockquote>The easiest car rental experience I've ever had. The price was exactly what I saw online, and the car was spotless.</blockquote><div class="reviewer"><span>SC</span><div><b>Sofia Cruz</b><small>Bill’s Premiere customer · Cebu</small></div><em>★★★★★</em></div></section>

        <section class="cta"><div><span>Ready to hit the road?</span><h2>Your next adventure is one click away.</h2></div><a mat-flat-button routerLink="/book">Browse available cars <mat-icon>arrow_forward</mat-icon></a></section>
      </main>

      <footer class="site-footer" id="contact"><a class="brand" routerLink="/"><span><mat-icon>directions_car</mat-icon></span><b>Bill’s Premiere</b></a><p>Better cars. Better journeys.</p><div><a href="mailto:hello@billspremiere.com">hello&#64;billspremiere.com</a><span>·</span><span>+63 2 8123 4567</span><span>·</span><span>© 2026 Bill’s Premiere</span></div></footer>
    </div>
  `,
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  readonly data = inject(DataService);
  readonly featuredVehicles = this.data.vehicles().filter(vehicle => vehicle.status === 'Available');
  readonly benefits = [
    { icon: 'sell', title: 'Upfront pricing', copy: 'The price you see is the price you pay. Taxes and standard coverage are shown before checkout.' },
    { icon: 'event_available', title: 'Flexible booking', copy: 'Change your dates or vehicle with a few clicks. Plans change, and that is completely fine.' },
    { icon: 'health_and_safety', title: 'Road-ready cars', copy: 'Every vehicle passes a 40-point safety check and is detailed before every rental.' },
    { icon: 'support_agent', title: 'Real human support', copy: 'Our local team is here around the clock, wherever your journey takes you.' },
  ];
}
