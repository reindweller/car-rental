import { test, expect, Page } from '@playwright/test';

const vehicle = { id: 1, name: 'Test car', year: 2026, price: 50, status: 'Available', carLocation: 'Airport', pickupLocations: [], imageUrl: '', category: 'SUV', features: [], included: [] };
async function setup(page: Page, options: { availabilityFailure?: boolean; empty?: boolean; saveFailure?: boolean } = {}) {
  const logs: any[] = [];
  let payments = 0, saves = 0, availability = 0;
  await page.route('**/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.split('/v1')[1];
    let body: any = [];
    let status = 200;
    if (path === '/vehicles') body = options.empty ? [] : [vehicle];
    if (path === '/availability') {
      availability++;
      body = { unavailableVehicleIds: [] };
      if (options.availabilityFailure && availability === 1) { status = 500; body = { message: 'Availability temporarily unavailable' }; }
    }
    if (path === '/booking-logs') {
      if (route.request().method() === 'POST') { logs.push(route.request().postDataJSON()); body = { accepted: true }; }
      else body = { items: [{ attemptId: 'test-attempt', event: 'api_failed', source: 'server', createdAt: new Date().toISOString(), details: { stage: '/bookings', status: 400 } }] };
    }
    if (path === '/payments/intents') { payments++; body = { id: 'pi_mock', clientSecret: 'mock_secret' }; }
    if (path === '/bookings' && route.request().method() === 'POST') {
      saves++; body = { ...route.request().postDataJSON(), id: 'BK-12345678', paymentStatus: 'Paid' };
      if (options.saveFailure && saves === 1) { status = 500; body = { message: 'Booking storage is temporarily unavailable' }; }
    }
    await route.fulfill({ status, json: body });
  });
  await page.addInitScript(() => {
    (window as any).Stripe = () => ({ elements: () => ({ create: () => {
      const handlers: Record<string, Function> = {};
      return { on: (name: string, fn: Function) => handlers[name] = fn,
        mount: () => setTimeout(() => { handlers['ready']?.(); handlers['change']?.({ complete: true }); }, 50),
        clear() {}, destroy() {} };
    } }), confirmCardPayment: async () => ({ paymentIntent: { id: 'pi_mock', status: 'succeeded' } }) });
  });
  return { logs, counts: () => ({ payments, saves }) };
}
async function fill(page: Page) {
  const start = new Date(); start.setDate(start.getDate() + 30);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  await page.goto(`/book?start=${start.toISOString().slice(0,10)}T10:00&end=${end.toISOString().slice(0,10)}T10:00`);
  await page.getByLabel('First name', { exact: true }).fill('Test');
  await page.getByLabel('Last name', { exact: true }).fill('Customer');
  await page.getByLabel('Email address', { exact: true }).fill('customer@example.com');
  await page.getByLabel('Mobile number', { exact: true }).fill('+12025550123');
  await page.getByRole('checkbox').check();
}
test('booking completes and logs milestones; save retry does not charge twice', async ({ page }) => {
  const state = await setup(page, { saveFailure: true });
  await fill(page);
  await page.getByRole('button', { name: /^Pay / }).click();
  await expect(page.locator('.payment-error')).toContainText('Booking storage is temporarily unavailable');
  await page.getByRole('button', { name: /^Pay / }).click();
  await expect(page.getByRole('heading', { name: /ready to drive/ })).toBeVisible();
  expect(state.counts()).toEqual({ payments: 1, saves: 2 });
  await expect.poll(() => state.logs.map(log => log.event)).toContain('booking_confirmed');
  expect(state.logs.map(log => log.event)).toEqual(expect.arrayContaining(['payment_succeeded', 'submit_failed', 'booking_confirmed']));
  expect(new Set(state.logs.map(log => log.attemptId)).size).toBe(1);
  expect(JSON.stringify(state.logs)).not.toContain('customer@example.com');
});
test('availability failure explains disabled payment and retry recovers', async ({ page }) => {
  await setup(page, { availabilityFailure: true }); await fill(page);
  await expect(page.getByRole('button', { name: /^Pay / })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry availability' }).click();
  await expect(page.getByRole('button', { name: /^Pay / })).toBeEnabled();
});
test('empty fleet has a usable fallback', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, { empty: true }); await page.goto('/book');
  await expect(page.getByRole('heading', { name: 'No vehicles available' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('staff can inspect Logs from navigation', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => {
    const payload = btoa(JSON.stringify({ sub: 'staff', name: 'Test Agent', email: 'staff@example.com', 'custom:role': 'Agent' }));
    localStorage.setItem('billspremiere.cognito-session', JSON.stringify({ idToken: `test.${payload}.test`, accessToken: 'test', refreshToken: 'test', expiresAt: Date.now() + 3600000 }));
  });
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Logs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Logs', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'api_failed', exact: true })).toBeVisible();
});
test('anonymous visitors cannot view Logs', async ({ page }) => {
  await setup(page); await page.goto('/logs');
  await expect(page).toHaveURL(/\/login$/);
});
