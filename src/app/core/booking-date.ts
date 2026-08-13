import { Booking } from './models';

export function formatBookingPeriod(booking: Booking): string {
  const start = bookingDateTime(booking.startDate, '10:00');
  const end = bookingDateTime(booking.endDate, '10:00');
  if (!start || !end) return booking.period;
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function bookingDateTime(value: string | undefined, fallbackTime: string): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [hours, minutes] = (match[4] ? `${match[4]}:${match[5]}` : fallbackTime).split(':').map(Number);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hours, minutes);
}
