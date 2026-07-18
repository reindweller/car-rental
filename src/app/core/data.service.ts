import { Injectable, signal } from '@angular/core';
import { AppUser, Booking, UserRole, Vehicle } from './models';

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
  features: string;
}

// Public listing details captured from Bill's Premiere's Turo pages on July 18, 2026.
const INCLUDED = [
  'Skip the rental counter', 'Pickup and return instructions in the app', 'Additional drivers at no extra charge',
  '30-minute return grace period', 'No car wash necessary', '24/7 roadside assistance', '24/7 customer support',
];

const EXTRAS = [
  { name: 'Folding chairs', description: 'Camping chairs, with 8 available.', price: '$5 / trip' },
  { name: 'Snorkeling gear', description: 'Mask, snorkel, and fins.', price: '$10 / trip' },
  { name: 'Sleeping gear', description: 'Sleeping bags and air mattresses.', price: '$15 / trip' },
  { name: 'Camping tent', description: 'Two tents available for your trip.', price: '$40 / day' },
  { name: 'Cooler', description: 'Choose the size that fits your trip.', price: '$20 / trip' },
  { name: 'Beach wagon', description: 'Collapsible wagon for beach, camping, or festivals.', price: '$20 / trip' },
  { name: 'Child safety seat', description: 'Car seats and booster seats available.', price: '$30 / day' },
];

const VEHICLES: Vehicle[] = [
  {
    id: 3297396, name: 'Buick Enclave', year: 2022, trim: 'Premium', category: 'Premium SUV', seats: 7, mpg: 22, fuel: 'Gas', transmission: 'Automatic', price: 50.76,
    rating: 5, reviewCount: 47, trips: 50, reviewer: 'Je', review: 'Amazing host. The rental was easy. The communication was wonderful. Very quick responses. I would definitely rent again.',
    imageUrl: 'https://images.turo.com/media/vehicle/images/u1h9bSozTC6lzSVNbpY9KA.heic', turoUrl: 'https://turo.com/us/en/suv-rental/united-states/gibsonton-fl/buick/enclave/3297396',
    features: [
      { group: 'Safety', items: ['Backup camera', 'Blind spot warning', 'Lane departure warning', 'Lane keeping assist'] },
      { group: 'Connectivity', items: ['AUX input', 'Bluetooth', 'USB charger', 'USB input'] },
      { group: 'Convenience', items: ['GPS', 'Keyless entry', 'Must be 21+ to book'] },
    ], included: INCLUDED, extras: EXTRAS,
    reviews: [
      { author: 'Je', date: 'June 7, 2026', rating: 5, body: 'Amazing host. The rental was easy. The communication was wonderful. Very quick responses. I would definitely rent again.' },
      { author: 'Wallace', date: 'June 2, 2026', rating: 5, body: 'Amazing.' },
      { author: 'Tonya', date: 'May 13, 2026', rating: 5, body: 'The car was just as described. Tons of room, drove well, and was very comfortable. The host was easy to work with. Highly recommend!' },
    ],
    status: 'Available', color: '#e7eef7', plate: 'Turo #3297396', emoji: 'SUV',
  },
  {
    id: 3269786, name: 'Toyota Crown', year: 2026, trim: 'XLE', category: 'Hybrid Sedan', seats: 5, mpg: 42, fuel: 'Hybrid', transmission: 'Automatic', price: 55.61,
    rating: 5, reviewCount: 53, trips: 56, reviewer: 'Cherise Annie', review: 'My family and I really enjoyed the car. Clean and definitely a gas saver. There was enough room, even with three teenagers. The host communicated extremely well.',
    imageUrl: 'https://images.turo.com/media/vehicle/images/WOIrGvc0Sb6nD5guKcGivQ.heic', turoUrl: 'https://turo.com/us/en/car-rental/united-states/gibsonton-fl/toyota/crown/3269786',
    features: [
      { group: 'Safety', items: ['Adaptive cruise control', 'All-wheel drive', 'Backup camera', 'Blind spot warning', 'Brake assist', 'Lane departure warning', 'Lane keeping assist'] },
      { group: 'Connectivity', items: ['Android Auto', 'Apple CarPlay', 'AUX input', 'Bluetooth', 'USB charger', 'USB input'] },
      { group: 'Convenience', items: ['GPS', 'Keyless entry', 'Must be 21+ to book'] },
    ], included: INCLUDED, extras: EXTRAS,
    reviews: [
      { author: 'Cherise Annie', date: 'July 6, 2026', rating: 5, body: 'My family and I really enjoyed the car. Clean and definitely a gas saver. There was enough room, even with three teenagers. The host communicated extremely well.' },
      { author: 'Johnathan', date: 'June 28, 2026', rating: 5, body: 'Amazing.' },
      { author: 'Chandra', date: 'May 27, 2026', rating: 5, body: 'Great car, great host. Will rent again!' },
    ],
    status: 'Available', color: '#e9edf2', plate: 'Turo #3269786', emoji: 'Hybrid',
  },
  {
    id: 3236892, name: 'Chevrolet Traverse', year: 2019, trim: 'LT Cloth', category: 'SUV', seats: 7, mpg: 22, fuel: 'Gas', transmission: 'Automatic', price: 57.88,
    rating: 4.98, reviewCount: 61, trips: 68, reviewer: 'Robert', review: 'Very nice and understanding.',
    imageUrl: 'https://images.turo.com/media/vehicle/images/8WJp93PbS6eyvABPEcTjKg.heic', turoUrl: 'https://turo.com/us/en/suv-rental/united-states/gibsonton-fl/chevrolet/traverse/3236892',
    features: [
      { group: 'Safety', items: ['Backup camera', 'Blind spot warning'] },
      { group: 'Connectivity', items: ['Android Auto', 'Apple CarPlay', 'Bluetooth', 'USB charger', 'USB input'] },
      { group: 'Convenience', items: ['Keyless entry', 'Wi-Fi hotspot with voice navigation'] },
    ], included: INCLUDED, extras: EXTRAS,
    reviews: [
      { author: 'Robert', date: 'July 6, 2026', rating: 5, body: 'Very nice and understanding.' },
      { author: 'Erica', date: 'May 10, 2026', rating: 5, body: 'The car was smooth and customer service was great! Will definitely use them again.' },
      { author: 'Lora', date: 'May 4, 2026', rating: 5, body: 'We will rent again from Bill’s Premiere next trip.' },
    ],
    status: 'Available', color: '#edf1f5', plate: 'Turo #3236892', emoji: 'SUV',
  },
  {
    id: 3819957, name: 'Toyota Sienna', year: 2026, trim: 'XLE', category: 'Hybrid Minivan', seats: 8, mpg: 36, fuel: 'Hybrid', transmission: 'Automatic', price: 66,
    rating: null, reviewCount: 0, trips: 0, reviewer: '', review: 'New listing — book this car and be the first to review it.',
    imageUrl: 'https://images.turo.com/media/vehicle/images/Gg3dR8LqSLS4Om1QSJN5ew.heic', turoUrl: 'https://turo.com/us/en/minivan-rental/united-states/gibsonton-fl/toyota/sienna/3819957',
    features: [
      { group: 'Safety', items: ['Adaptive cruise control', 'Backup camera', 'Blind spot warning', 'Brake assist', 'Lane departure warning', 'Lane keeping assist'] },
      { group: 'Connectivity', items: ['Android Auto', 'Apple CarPlay', 'Bluetooth', 'USB charger', 'USB input'] },
      { group: 'Convenience', items: ['GPS', 'Keyless entry', 'Toll pass', 'Heated seats', 'Sunroof', 'Must be 21+ to book'] },
    ], included: INCLUDED, extras: [], reviews: [],
    status: 'Available', color: '#eef4ef', plate: 'Turo #3819957', emoji: 'Minivan',
  },
  {
    id: 3264581, name: 'GMC Yukon XL', year: 2019, trim: 'Denali', category: 'Luxury SUV', seats: 7, mpg: 17, fuel: 'Gas', transmission: 'Automatic', price: 82.13,
    rating: 4.97, reviewCount: 38, trips: 40, reviewer: 'Tyrone', review: 'Well organized.',
    imageUrl: 'https://images.turo.com/media/vehicle/images/LPr_QHUmSE29w-VH4R5VLw.heic', turoUrl: 'https://turo.com/us/en/suv-rental/united-states/gibsonton-fl/gmc/yukon-xl/3264581',
    features: [
      { group: 'Safety', items: ['All-wheel drive', 'Backup camera', 'Blind spot warning', 'Brake assist', 'Lane departure warning', 'Lane keeping assist'] },
      { group: 'Connectivity', items: ['Android Auto', 'Apple CarPlay', 'AUX input', 'Bluetooth', 'USB charger', 'USB input'] },
      { group: 'Convenience', items: ['GPS', 'Keyless entry', 'Must be 21+ to book'] },
    ], included: INCLUDED, extras: EXTRAS,
    reviews: [
      { author: 'Tyrone', date: 'July 5, 2026', rating: 5, body: 'Well organized.' },
      { author: 'Flip', date: 'July 2, 2026', rating: 5, body: 'Great customer service, prompt responses to questions, excellent truck. Will definitely rent again.' },
      { author: 'Kristin', date: 'June 14, 2026', rating: 5, body: 'The car was great! Bill and Makayla were super responsive. We would definitely rent this vehicle from them again!' },
    ],
    status: 'Available', color: '#e7ebef', plate: 'Turo #3264581', emoji: 'Luxury SUV',
  },
];

const BOOKINGS: Booking[] = [
  { id: 'BK-1048', customer: 'Sophia Wilson', vehicle: 'Buick Enclave', period: 'Jul 18 – Jul 22', total: 203.04, status: 'Active' },
  { id: 'BK-1047', customer: 'Noah Davis', vehicle: 'Toyota Crown', period: 'Jul 18 – Jul 20', total: 111.22, status: 'Confirmed' },
  { id: 'BK-1046', customer: 'Mia Anderson', vehicle: 'Chevrolet Traverse', period: 'Jul 20 – Jul 25', total: 289.40, status: 'Pending' },
  { id: 'BK-1045', customer: 'Ethan Brown', vehicle: 'GMC Yukon XL', period: 'Jul 15 – Jul 18', total: 246.39, status: 'Completed' },
];

const DEFAULT_USERS: AppUser[] = [
  { id: 1, name: 'Alex Morgan', email: 'alex@billspremiere.com', role: 'Administrator', status: 'Active', initials: 'AM', lastActive: 'Now' },
  { id: 2, name: 'Jamie Chen', email: 'jamie@billspremiere.com', role: 'Manager', status: 'Active', initials: 'JC', lastActive: '12 min ago' },
  { id: 3, name: 'Taylor Reed', email: 'taylor@billspremiere.com', role: 'Agent', status: 'Active', initials: 'TR', lastActive: '1 hour ago' },
  { id: 4, name: 'Morgan Lee', email: 'morgan@billspremiere.com', role: 'Agent', status: 'Invited', initials: 'ML', lastActive: 'Invitation sent' },
  { id: 5, name: 'Casey Brooks', email: 'casey@billspremiere.com', role: 'Manager', status: 'Suspended', initials: 'CB', lastActive: 'Jun 28, 2026' },
];

@Injectable({ providedIn: 'root' })
export class DataService {
  readonly vehicles = signal<Vehicle[]>(this.readVehicles());
  readonly bookings = signal(BOOKINGS);
  readonly users = signal<AppUser[]>(this.readUsers());

  addVehicle(input: AddVehicleInput): Vehicle {
    const vehicle: Vehicle = {
      id: Math.max(0, ...this.vehicles().map(current => current.id)) + 1,
      name: input.name.trim(), year: Number(input.year), trim: input.trim.trim(), category: input.category.trim(),
      seats: Number(input.seats), mpg: Number(input.mpg), fuel: input.fuel, transmission: input.transmission,
      price: Number(input.price), status: input.status, plate: input.plate.trim(), imageUrl: input.imageUrl.trim(),
      rating: null, reviewCount: 0, trips: 0, reviewer: '', review: 'New listing — book this car and be the first to review it.',
      turoUrl: '', color: '#e8edf3', emoji: input.category,
      features: [{ group: 'Vehicle features', items: input.features.split(',').map(feature => feature.trim()).filter(Boolean) }],
      included: INCLUDED, extras: [], reviews: [],
    };
    this.saveVehicles([...this.vehicles(), vehicle]);
    return vehicle;
  }

  createBooking(customer: string, vehicle: Vehicle, start: Date, end: Date, total: number): string {
    const nextNumber = Math.max(1048, ...this.bookings().map(booking => Number(booking.id.replace('BK-', '')) || 0)) + 1;
    const id = `BK-${nextNumber}`;
    const format = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    this.bookings.update(bookings => [{ id, customer, vehicle: vehicle.name, period: `${format(start)} – ${format(end)}`, total, status: 'Confirmed' }, ...bookings]);
    return id;
  }

  addUser(name: string, email: string, role: UserRole): void {
    const users = this.users();
    const user: AppUser = {
      id: Math.max(0, ...users.map(user => user.id)) + 1, name, email, role,
      status: 'Invited', initials: name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(),
      lastActive: 'Invitation sent',
    };
    this.saveUsers([...users, user]);
  }

  updateUser(user: AppUser): void { this.saveUsers(this.users().map(current => current.id === user.id ? user : current)); }
  removeUser(id: number): void { this.saveUsers(this.users().filter(user => user.id !== id)); }

  private saveUsers(users: AppUser[]): void {
    this.users.set(users);
    localStorage.setItem('drivewise.users', JSON.stringify(users));
  }

  private saveVehicles(vehicles: Vehicle[]): void {
    this.vehicles.set(vehicles);
    localStorage.setItem('billspremiere.vehicles', JSON.stringify(vehicles));
  }

  private readVehicles(): Vehicle[] {
    try {
      const saved = JSON.parse(localStorage.getItem('billspremiere.vehicles') ?? 'null');
      return Array.isArray(saved) ? saved : VEHICLES;
    } catch { return VEHICLES; }
  }

  private readUsers(): AppUser[] {
    try { return JSON.parse(localStorage.getItem('drivewise.users') ?? 'null') ?? DEFAULT_USERS; }
    catch { return DEFAULT_USERS; }
  }
}
