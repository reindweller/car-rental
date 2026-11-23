import { BookingLog } from '../../core/booking-log.service';

const labels: Record<string, string> = {
  booking_started: 'Booking started', progress: 'Booking progress updated', page_left: 'Customer left the booking page',
  submit_clicked: 'Customer selected Pay & confirm', payment_form_retry: 'Customer retried the payment form',
  availability_started: 'Checking vehicle availability', availability_checked: 'Availability checked',
  availability_failed: 'Availability check failed', payment_intent_started: 'Preparing payment',
  payment_intent_created: 'Payment prepared', payment_confirmation_started: 'Processing card payment',
  payment_succeeded: 'Card payment completed', booking_save_started: 'Saving booking',
  booking_confirmed: 'Booking confirmed', submit_failed: 'Checkout could not finish',
  vehicle: 'Vehicle selection', dates: 'Rental dates', availability: 'Availability check',
  vehicle_unavailable: 'An available vehicle', location: 'Pickup or delivery location', customer_details: 'Contact details',
  agreement: 'Rental agreement', payment_form: 'Secure payment form', card_details: 'Card details',
  payment_intent: 'Payment setup', payment_confirmation: 'Card payment', booking_save: 'Booking confirmation',
  '/payments/intents': 'Payment setup', '/bookings': 'Booking confirmation', '/delivery/check': 'Delivery address check',
  agreement_validation: 'The rental agreement needs to be reviewed and accepted again.',
  dates_unavailable: 'The vehicle is already booked for the selected dates.',
  vehicle_unavailable_reason: 'The selected vehicle is unavailable.',
  payment_amount_mismatch: 'The payment amount does not match the booking total.',
  payment_metadata_mismatch: 'The payment details do not match the booking.',
  payment_incomplete: 'The payment has not completed.', payment_configuration: 'Payments are not configured correctly.',
  payment_credentials: 'The payment provider credentials need attention.',
  delivery_address: 'The delivery address could not be accepted.', payment_provider: 'The payment provider could not complete the request.',
  validation: 'Some booking information was not accepted.', backend_error: 'The booking service encountered an error.',
};
export function readable(value: unknown): string {
  const text = String(value ?? '');
  return labels[text] ?? text.replace(/[_/]+/g, ' ').replace(/^\w/, letter => letter.toUpperCase());
}
export function presentLog(item: BookingLog) {
  const d = item.details;
  const stage = readable(d['stage']) || 'Booking request';
  const failed = d['available'] === false || item.event.endsWith('_failed') || ['availabilityError', 'deliveryError', 'paymentError'].some(key => d[key] === true);
  const success = ['api_succeeded', 'booking_confirmed', 'payment_succeeded', 'payment_intent_created'].includes(item.event);
  const status = failed ? 'Needs attention' : success ? 'Completed' : item.event === 'page_left' ? 'Page closed' : 'In progress';
  const title = item.event === 'api_started' ? `${stage} started` : item.event === 'api_succeeded' ? `${stage} succeeded` : item.event === 'api_failed' ? `${stage} failed` : readable(item.event);
  const notes: string[] = [];
  if (d['reason']) notes.push(readable(d['reason'] === 'vehicle_unavailable' ? 'vehicle_unavailable_reason' : d['reason']));
  if (d['availabilityError'] === true) notes.push('Vehicle availability could not be checked.');
  if (d['deliveryError'] === true) notes.push('The delivery address needs attention.');
  if (d['paymentError'] === true) notes.push('The payment form or payment attempt reported a problem.');
  if (d['available'] === false) notes.push('The selected vehicle is unavailable for these dates.');
  if (d['available'] === true) notes.push('The selected vehicle is available for these dates.');
  if (d['paid'] === true) notes.push('Payment was reported successful, but booking confirmation still needs checking. Review the booking before asking the customer to pay again.');
  if (item.event === 'submit_failed' && d['stage']) notes.push(`Stopped during: ${stage}.`);
  if (item.event === 'page_left') notes.push(d['completed'] === true ? 'A booking confirmation was shown before the customer left.' : 'No confirmation was shown before the customer left. This alone does not mean payment failed.');
  if (item.event === 'payment_intent_created') notes.push('Payment is ready to process; the card has not yet been confirmed as charged.');
  const steps = (key: string) => String(d[key] ?? '').split(',').filter(Boolean).map(readable);
  return { item, title, status, tone: failed ? 'error' : success ? 'success' : 'neutral', notes,
    completed: steps('completedSteps'), pending: steps('blockers'),
    source: item.source === 'server' ? 'Booking service' : 'Customer browser' };
}
