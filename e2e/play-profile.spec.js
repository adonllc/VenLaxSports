import { test, expect } from '@playwright/test';
import { loginUser, fixtures } from './fixtures.js';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe('play profile', () => {
  test.skip(!email || !password, 'E2E_EMAIL / E2E_PASSWORD not set');

  test('edit, save, and persist after reload', async ({ page }) => {
    await loginUser(page, email, password);
    await page.goto(`${fixtures.BASE_URL}/dashboard`);

    await page.getByTestId('edit-play-profile-btn').click();
    await page.getByTestId('pp-court-side-left').click();
    await page.getByTestId('pp-hand-right').click();
    await page.getByTestId('pp-avail-weekend_morning').click();
    await page.getByTestId('pp-looking-for-partner').check();
    await page.getByTestId('save-play-profile-btn').click();

    const summary = page.getByTestId('play-profile-summary');
    await expect(summary).toContainText('Left side');
    await expect(summary).toContainText('Looking for a partner');

    await page.reload();
    await expect(page.getByTestId('play-profile-summary')).toContainText('Weekend mornings');
  });
});
