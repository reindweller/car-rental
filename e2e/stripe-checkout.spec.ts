import { test, expect } from '@playwright/test';
import { environment } from '../src/environments/environment';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

async function card(page: Page, number: string) {
  await page.frameLocator('#card-number-element iframe[title]').locator('input[name="cardnumber"]').fill(number);
  await page.frameLocator('#card-expiry-element iframe[title]').locator('input[name="exp-date"]').fill('1234');
  await page.frameLocator('#card-cvc-element iframe[title="Secure CVC input frame"]').locator('input[name="cvc"]').fill('123');
}

async function prepare(page: Page) {
  expect(environment.stripe.publishableKey.startsWith('pk_test_')).toBe(true);
  const start = new Date(); start.setUTCDate(start.getUTCDate() + 90);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
  const dates = { start: start.toISOString().slice(0, 10) + 'T10:00', end: end.toISOString().slice(0, 10) + 'T10:00' };
  const response = await page.request.get(`${environment.aws.apiUrl}/vehicles`);
  expect(response.ok()).toBe(true);
  const vehicles = await response.json();
  const availability = await (await page.request.get(`${environment.aws.apiUrl}/availability`, { params: dates })).json();
  const vehicle = vehicles.find((item: any) => item.status === 'Available' && item.carLocation && !availability.unavailableVehicleIds.includes(item.id));
  expect(vehicle, 'An available vehicle with a pickup location is required').toBeTruthy();
  await page.goto(`/book?${new URLSearchParams({ ...dates, vehicle: String(vehicle.id) })}`);
  await page.getByLabel('First name', { exact: true }).fill('E2E');
  await page.getByLabel('Last name', { exact: true }).fill('Stripe Test');
  await page.getByLabel('Email address', { exact: true }).fill('stripe-e2e@example.com');
  await page.getByLabel('Mobile number', { exact: true }).fill('+12025550123');
  await page.getByRole('checkbox').check();
  return { vehicle, dates };
}

test.describe('test-mode payment submissions', () => {
  test.skip(process.env['E2E_STRIPE_PAYMENTS'] !== '1', 'Enable only after verifying the deployed backend uses sk_test.');

  test('declined card shows an error without creating a booking', async ({ page }) => {
    await prepare(page);
    let bookings = 0;
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/bookings')) bookings++; });
    await card(page, '4000000000009995');
    const intent = page.waitForResponse(response => response.url().endsWith('/payments/intents') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /^Pay / }).click();
    const response = await intent;
    expect(response.ok(), await response.text()).toBe(true);
    await expect(page.locator('.payment-error')).toContainText(/insufficient|declined/i, { timeout: 30000 });
    expect(bookings).toBe(0);
  });

  test('paid booking recovers from one interrupted booking request without a second payment', async ({ page }, testInfo) => {
    const { vehicle, dates } = await prepare(page);
    let intents = 0;
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/payments/intents')) intents++; });
    let bookingAttempts = 0;
    await page.route('**/v1/bookings', async route => {
      if (route.request().method() === 'POST' && ++bookingAttempts === 1) await route.abort('failed');
      else await route.continue();
    });
    await card(page, '4242424242424242');
    await page.getByRole('button', { name: /^Pay / }).click();
    await expect(page.locator('.payment-error')).toBeVisible({ timeout: 45000 });
    expect(bookingAttempts, 'Payment must succeed before the interrupted booking request').toBe(1);
    const saved = page.waitForResponse(response => response.url().endsWith('/bookings') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /^Pay / }).click();
    const response = await saved;
    const booking = await response.json();
    expect(response.ok(), JSON.stringify(booking)).toBe(true);
    mkdirSync('tmp/e2e', { recursive: true });
    writeFileSync('tmp/e2e/created-booking.json', JSON.stringify(booking, null, 2));
    await testInfo.attach('booking-result', { body: JSON.stringify({ id: booking.id, paymentStatus: booking.paymentStatus, total: booking.total }), contentType: 'application/json' });
    await expect(page.getByRole('heading', { name: /ready to drive/ })).toBeVisible();
    expect(booking.paymentStatus).toBe('Paid');
    expect(booking.agreementAccepted).toBe(true);
    expect(booking.total).toBe(Math.round((vehicle.price + Math.round(vehicle.price * 8) / 100) * 100) / 100);
    expect(intents).toBe(1);
    const duplicate = await page.request.post(`${environment.aws.apiUrl}/bookings`, { data: response.request().postDataJSON() });
    expect(duplicate.ok(), await duplicate.text()).toBe(true);
    expect((await duplicate.json()).id).toBe(booking.id);
    const available = await (await page.request.get(`${environment.aws.apiUrl}/availability`, { params: dates })).json();
    expect(available.unavailableVehicleIds).toContain(vehicle.id);
    await page.getByRole('button', { name: 'Book another car' }).click();
    await card(page, '4242424242424242');
    await expect(page.locator('.payment-fields')).not.toHaveClass(/loading/);
  });
});

test('real Stripe test-mode card fields load and accept input', async ({ page }) => {
  expect(environment.stripe.publishableKey.startsWith('pk_test_')).toBe(true);
  const failedRequests: string[] = [];
  page.on('requestfailed', request => failedRequests.push(`${new URL(request.url()).hostname}: ${request.failure()?.errorText}`));
  await page.goto('/book');
  await expect(page.locator('.payment-panel')).toBeVisible({ timeout: 30000 });
  try {
    await expect(page.locator('#card-number-element iframe')).toBeVisible({ timeout: 30000 });
    await page.frameLocator('#card-number-element iframe').locator('input[name="cardnumber"]').fill('4242424242424242', { timeout: 30000 });
    await page.frameLocator('#card-expiry-element iframe').locator('input[name="exp-date"]').fill('1234');
    await page.frameLocator('#card-cvc-element iframe[title="Secure CVC input frame"]').locator('input[name="cvc"]').fill('123');
    await expect(page.locator('.payment-fields')).not.toHaveClass(/loading/);
    await expect(page.locator('.payment-error')).toHaveCount(0);
  } catch (error) {
    console.log('Payment UI:', await page.locator('.payment-panel').innerText());
    console.log('Failed request hosts:', failedRequests);
    throw error;
  }
});
