import { test as base } from '@playwright/test';

const API = process.env.VITE_BACKEND_URL || 'http://localhost:8001/api';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export const fixtures = {
  API,
  BASE_URL,
};

export async function loginUser(page, email, password) {
  await page.goto(`${BASE_URL}/auth?mode=login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  const signInBtn = page.locator('button:has-text("Sign In")').first();
  await signInBtn.click();

  try {
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  } catch (e) {
    console.warn('Login: dashboard navigation timeout, but proceeding');
  }
}

export async function logoutUser(page) {
  await page.goto(`${BASE_URL}/dashboard`);

  const profileBtn = page.locator('[data-testid="profile-menu"]').first();
  if (await profileBtn.isVisible()) {
    await profileBtn.click();
    const logoutLink = page.locator('text=Logout');
    if (await logoutLink.isVisible()) {
      await logoutLink.click();
    }
  }
}

export async function navigateToJoinFlow(page) {
  await page.goto(`${BASE_URL}/join`);
  await page.waitForLoadState('networkidle');
}

export async function selectSport(page, sport = 'Tennis') {
  const sportBtn = page.locator(`button:has-text("${sport}")`).first();
  if (await sportBtn.isVisible()) {
    await sportBtn.click();
    await page.waitForTimeout(300);
    return true;
  }
  return false;
}

export async function selectDivision(page, division = 'Singles') {
  const divBtn = page.locator(`button:has-text("${division}")`).first();
  if (await divBtn.isVisible()) {
    await divBtn.click();
    await page.waitForTimeout(300);
    return true;
  }
  return false;
}

export async function selectFormat(page, format = 'Flex') {
  const formatBtn = page.locator(`button:has-text("${format}")`).first();
  if (await formatBtn.isVisible()) {
    await formatBtn.click();
    await page.waitForTimeout(300);
    return true;
  }
  return false;
}

export async function selectLeague(page, index = 0) {
  const leagues = page.locator('[data-testid="league-card"]');
  const count = await leagues.count();

  if (count > index) {
    const league = leagues.nth(index);
    await league.click();
    await page.waitForURL('**/leagues/**', { timeout: 5000 });
    return true;
  }
  return false;
}

export async function clickJoinButton(page) {
  const joinBtn = page.locator('[data-testid*="join"], button:has-text("Join")').first();
  if (await joinBtn.isVisible()) {
    await joinBtn.click();
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

export async function waitForPaymentModal(page) {
  const modal = page.locator('[data-testid="payment-modal"]');
  try {
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch (e) {
    return false;
  }
}

export async function waitForSuccessMessage(page) {
  const success = page.locator('text=Successfully joined, text=joined successfully').first();
  try {
    await success.waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch (e) {
    return false;
  }
}

export async function getLeagueDetails(page) {
  const name = await page.locator('[data-testid="league-name"]').first().textContent();
  const sport = await page.locator('[data-testid="league-sport"]').first().textContent();
  const price = await page.locator('[data-testid="league-price"]').first().textContent();

  return { name, sport, price };
}

export async function fillPromoCode(page, code) {
  const promoInput = page.locator('input[placeholder*="Promo"], [data-testid="promo-input"]');
  if (await promoInput.isVisible()) {
    await promoInput.fill(code);

    const applyBtn = page.locator('button:has-text("Apply"), [data-testid="apply-promo"]');
    if (await applyBtn.isVisible()) {
      await applyBtn.click();
      await page.waitForTimeout(1000);
      return true;
    }
  }
  return false;
}

export const test = base.extend({
  fixtures,
  loginUser,
  logoutUser,
  navigateToJoinFlow,
  selectSport,
  selectDivision,
  selectFormat,
  selectLeague,
  clickJoinButton,
  waitForPaymentModal,
  waitForSuccessMessage,
  getLeagueDetails,
  fillPromoCode,
});
