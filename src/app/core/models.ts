export type UserRole = 'Administrator' | 'Manager' | 'Agent';
export type UserStatus = 'Active' | 'Invited' | 'Suspended';

export interface AppUser {
  id: number;
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
  turoUrl: string;
  features: { group: string; items: string[] }[];
  included: string[];
  extras: { name: string; description: string; price: string }[];
  reviews: { author: string; date: string; rating: number; body: string }[];
  status: 'Available' | 'Rented' | 'Maintenance';
  color: string;
  plate: string;
  emoji: string;
}

export interface Booking {
  id: string;
  customer: string;
  vehicle: string;
  period: string;
  total: number;
  status: 'Confirmed' | 'Active' | 'Pending' | 'Completed';
}
