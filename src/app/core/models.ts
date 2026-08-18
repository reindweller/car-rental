export type UserRole = 'Administrator' | 'Manager' | 'Agent';
export type UserStatus = 'Active' | 'Invited' | 'Suspended';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  initials: string;
  lastActive: string;
}

export interface Vehicle {
  id: number;
  name: string;
  year: number;
  trim: string;
  category: string;
  seats: number;
  mpg: number;
  fuel: string;
  transmission: string;
  price: number;
  rating: number | null;
  reviewCount: number;
  trips: number;
  review: string;
  reviewer: string;
  imageUrl: string;
  imageUrls?: string[];
  carLocation?: string;
  pickupLocations?: string[];
  turoUrl: string;
  features: { group: string; items: string[] }[];
  included: { group: string; items: string[] }[];
  rules?: string[];
  extras: { name: string; description: string; price: string }[];
  reviews: VehicleReview[];
  status: 'Available' | 'Rented';
  color: string;
  plate: string;
  emoji: string;
}

export interface VehicleReview {
  id?: string;
  author: string;
  date: string;
  rating: number;
  body: string;
}

export interface Booking {
  id: string;
  customer: string;
  email?: string;
  phone?: string;
  vehicleId?: number;
  vehicle: string;
  startDate?: string;
  endDate?: string;
  pickupLocation?: string;
  period: string;
  total: number;
  paymentIntentId?: string;
  paymentStatus?: 'Paid' | 'Refunded' | 'Partially refunded';
  createdAt?: string;
  status: 'Confirmed' | 'Active' | 'Pending' | 'Completed';
}
