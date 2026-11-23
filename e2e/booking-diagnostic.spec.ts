import { test, expect } from '@playwright/test';

test('live fleet, availability, and secure fields load without charging', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', e => failures.push(e.message));
  const start = new Date(); start.setDate(start.getDate() + 30);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  await page.goto(`${process.env['E2E_BOOKING_URL'] || '/book'}?start=${start.toISOString().slice(0,10)}T10:00&end=${end.toISOString().slice(0,10)}T10:00`);
  await expect(page.locator('.payment-panel')).toBeVisible();
  await expect(page.locator('.payment-fields')).not.toHaveClass(/loading/, { timeout: 35000 });
  await expect(page.locator('#card-number-element iframe')).toBeVisible();
  await expect(page.locator('.availability-error')).toHaveCount(0);
  await page.getByLabel('First name', { exact: true }).fill('Diagnostic');
  await page.getByLabel('Last name', { exact: true }).fill('Check');
  await page.getByLabel('Email address', { exact: true }).fill('diagnostic@example.com');
  await page.getByLabel('Mobile number', { exact: true }).fill('+12025550123');
  await page.getByRole('checkbox').check();
  expect(failures).toEqual([]);
  console.log('Live booking blockers:', await page.locator('.summary .hint').allTextContents());
});

