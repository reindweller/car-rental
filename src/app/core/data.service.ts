import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppUser, Booking, UserRole, Vehicle } from './models';
import { AuthService } from './auth.service';

export interface AddVehicleInput {
  name: string;
  year: number;
  trim: string;
  category: string;
  seats: number;
  mpg: number;
  fuel: string;
  transmission: string;
  price: number;
  status: Vehicle['status'];
  plate: string;
  imageUrl: string;
  imageUrls?: string[];
  carLocation: string;
  pickupLocations: string[];
  features: Vehicle['features'];
  included: Vehicle['included'];
  rules: string;
}

export interface AddVehicleDialogResult {
  input: Omit<AddVehicleInput, 'imageUrl' | 'imageUrls'>;
  photos: File[];
  photoOrder: { type: 'existing' | 'new'; index: number }[];
}

interface PhotoUpload {
  uploadUrl: string;
  imageUrl: string;
  expiresIn: number;
}

export interface CreateBookingInput {
  customer: string;
  email: string;
  phone: string;
  vehicleId: number;
  startDate: string;
  endDate: string;
  pickupLocation: string;
  fulfillmentMode: 'pickup' | 'delivery';
  coverage: boolean;
  paymentIntentId: string;
}

export interface CreatePaymentIntentInput {
  vehicleId: number;
  startDate: string;
  endDate: string;
  coverage: boolean;
  email: string;
  pickupLocation: string;
  fulfillmentMode: 'pickup' | 'delivery';
}

export interface DeliveryCheckResponse {
  eligible: boolean;
  distanceMiles: number;
  maxDistanceMiles: number;
  address: string;
}

export interface PaymentIntentResponse {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
}

export interface AvailabilityResponse {
  startDate: string;
  endDate: string;
  unavailableVehicleIds: number[];
}

export interface CreateReviewInput {
  bookingId: string;
  email: string;
  rating: number;
  body: string;
}

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly apiUrl = environment.aws.apiUrl.replace(/\/$/, '');
  readonly vehicles = signal<Vehicle[]>([]);
  readonly bookings = signal<Booking[]>([]);
  readonly users = signal<AppUser[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor(private readonly http: HttpClient, private readonly auth: AuthService) {}

  async initialize(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.loadVehicles();
      if (this.auth.isAuthenticated()) await this.loadStaffData();
    } catch (error) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async loadVehicles(): Promise<void> {
    this.vehicles.set(await firstValueFrom(this.http.get<Vehicle[]>(`${this.apiUrl}/vehicles`)));
  }

  async loadStaffData(): Promise<void> {
    this.bookings.set(await firstValueFrom(this.http.get<Booking[]>(`${this.apiUrl}/bookings`)));
    if (this.auth.currentUser()?.role === 'Administrator') {
      this.users.set(await firstValueFrom(this.http.get<AppUser[]>(`${this.apiUrl}/users`)));
    } else {
      this.users.set([]);
    }
  }

  async addVehicle(input: AddVehicleInput): Promise<Vehicle> {
    const vehicle = await firstValueFrom(this.http.post<Vehicle>(`${this.apiUrl}/vehicles`, input));
    this.vehicles.update(vehicles => [...vehicles, vehicle]);
    return vehicle;
  }

  async uploadVehiclePhoto(file: File): Promise<string> {
    const upload = await firstValueFrom(this.http.post<PhotoUpload>(`${this.apiUrl}/uploads`, {
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }));
    await firstValueFrom(this.http.put(upload.uploadUrl, file, {
      headers: { 'Content-Type': file.type },
      responseType: 'text',
    }));
    return upload.imageUrl;
  }

  async updateVehicle(vehicle: Vehicle): Promise<Vehicle> {
    const saved = await firstValueFrom(this.http.put<Vehicle>(`${this.apiUrl}/vehicles/${vehicle.id}`, vehicle));
    this.vehicles.update(vehicles => vehicles.map(current => current.id === saved.id ? saved : current));
    return saved;
  }

  async removeVehicle(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.apiUrl}/vehicles/${id}`));
    this.vehicles.update(vehicles => vehicles.filter(vehicle => vehicle.id !== id));
  }

  async createBooking(input: CreateBookingInput): Promise<Booking> {
    const booking = await firstValueFrom(this.http.post<Booking>(`${this.apiUrl}/bookings`, input));
    if (this.auth.isAuthenticated()) this.bookings.update(bookings => [booking, ...bookings]);
    return booking;
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResponse> {
    return firstValueFrom(this.http.post<PaymentIntentResponse>(`${this.apiUrl}/payments/intents`, input));
  }

  async checkAvailability(startDate: string, endDate: string): Promise<AvailabilityResponse> {
    const params = new HttpParams().set('start', startDate).set('end', endDate);
    return firstValueFrom(this.http.get<AvailabilityResponse>(`${this.apiUrl}/availability`, { params }));
  }

  async checkDelivery(vehicleId: number, address: string): Promise<DeliveryCheckResponse> {
    return firstValueFrom(this.http.post<DeliveryCheckResponse>(`${this.apiUrl}/delivery/check`, { vehicleId, address }));
  }

  async addVehicleReview(vehicleId: number, input: CreateReviewInput): Promise<Vehicle> {
    const vehicle = await firstValueFrom(this.http.post<Vehicle>(`${this.apiUrl}/vehicles/${vehicleId}/reviews`, input));
    this.vehicles.update(vehicles => vehicles.map(current => current.id === vehicle.id ? vehicle : current));
    return vehicle;
  }

  errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) return error.error?.message || `Backend request failed (${error.status || 'network error'}).`;
    return (error as { message?: string }).message ?? 'The backend request failed.';
  }

  async updateBooking(booking: Booking): Promise<Booking> {
    const saved = await firstValueFrom(this.http.put<Booking>(`${this.apiUrl}/bookings/${booking.id}`, booking));
    this.bookings.update(bookings => bookings.map(current => current.id === saved.id ? saved : current));
    return saved;
  }

  async addUser(name: string, email: string, role: UserRole): Promise<AppUser> {
    const user = await firstValueFrom(this.http.post<AppUser>(`${this.apiUrl}/users`, { name, email, role }));
    this.users.update(users => [...users, user]);
    return user;
  }

  async updateUser(user: AppUser): Promise<AppUser> {
    const saved = await firstValueFrom(this.http.put<AppUser>(`${this.apiUrl}/users/${encodeURIComponent(user.id)}`, user));
    this.users.update(users => users.map(current => current.id === saved.id ? saved : current));
    return saved;
  }

  async removeUser(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.apiUrl}/users/${encodeURIComponent(id)}`));
    this.users.update(users => users.filter(user => user.id !== id));
  }

}
