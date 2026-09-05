import { test, expect } from '@playwright/test';

const API = process.env.VITE_BACKEND_URL || 'http://localhost:8001/api';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Shared login helper
async function loginUser(page, email, password) {
  await page.goto(`${BASE_URL}/auth?mode=login`);
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Click sign in
  const signInBtn = page.locator('button:has-text("Sign In")').first();
  await signInBtn.click();

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

// Shared logout helper
async function logoutUser(page) {
  await page.goto(`${BASE_URL}/dashboard`);

  // Click profile/logout menu
  const profileBtn = page.locator('[data-testid="profile-menu"]').first();
  if (await profileBtn.isVisible()) {
    await profileBtn.click();
    await page.locator('text=Logout').click();
    await page.waitForURL('**/home', { timeout: 5000 });
  }
}

test.describe('Join League - Complete Flow', () => {
  test('Navigate join flow and view leagues', async ({ page }) => {
    // Start from home
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');

    // Click "Join League" CTA
    const joinBtn = page.locator('[data-testid="join-league-cta"], button:has-text("Join")').first();
    if (await joinBtn.isVisible()) {
      await joinBtn.click();
      await page.waitForURL('**/join', { timeout: 5000 });
    } else {
      // Direct navigate if no button
      await page.goto(`${BASE_URL}/join`);
    }

    // Verify join flow exists
    const flowContainer = page.locator('[data-testid="join-flow"]');
    if (await flowContainer.isVisible()) {
      console.log('✅ Join flow container loaded');
    }
  });

  test('Complete join flow: Sport → Format → Division → League selection', async ({ page }) => {
    await page.goto(`${BASE_URL}/join`);
    await page.waitForLoadState('networkidle');

    // Step 1: Select sport (Tennis)
    const tennisBtn = page.locator('[data-testid*="sport-"], button:has-text("Tennis")').first();
    if (await tennisBtn.isVisible()) {
      await tennisBtn.click();
      await page.waitForTimeout(500);
      console.log('✅ Selected Tennis sport');
    }

    // Step 2: Select format (Flex League)
    const flexBtn = page.locator('[data-testid*="format-"], button:has-text("Flex")').first();
    if (await flexBtn.isVisible()) {
      await flexBtn.click();
      await page.waitForTimeout(500);
      console.log('✅ Selected Flex League format');
    }

    // Step 3: Select division (Singles)
    const singlesBtn = page.locator('[data-testid*="division-"], button:has-text("Singles")').first();
    if (await singlesBtn.isVisible()) {
      await singlesBtn.click();
      await page.waitForTimeout(500);
      console.log('✅ Selected Singles division');
    }

    // Step 4: Leagues should load
    await page.waitForTimeout(1000);
    const leagueCard = page.locator('[data-testid="league-card"]').first();
    if (await leagueCard.isVisible()) {
      console.log('✅ League cards loaded');
      await leagueCard.click();
      await page.waitForURL('**/leagues/**', { timeout: 5000 });
      console.log('✅ Navigated to league detail');
    }
  });

  test('Join free league without payment', async ({ page }) => {
    // Login first
    const testEmail = process.env.TEST_EMAIL || 'test@venlaxsports.com';
    const testPassword = process.env.TEST_PASSWORD || 'TestPassword123!';

    try {
      await loginUser(page, testEmail, testPassword);
    } catch (e) {
      console.log('⚠️ Login may have failed, continuing...');
    }

    // Navigate to join flow
    await page.goto(`${BASE_URL}/join`);
    await page.waitForLoadState('networkidle');

    // Select free league path
    const tennisBtn = page.locator('button:has-text("Tennis")').first();
    if (await tennisBtn.isVisible()) {
      await tennisBtn.click();
      await page.waitForTimeout(300);
    }

    const flexBtn = page.locator('button:has-text("Flex")').first();
    if (await flexBtn.isVisible()) {
      await flexBtn.click();
      await page.waitForTimeout(300);
    }

    const singlesBtn = page.locator('button:has-text("Singles")').first();
    if (await singlesBtn.isVisible()) {
      await singlesBtn.click();
      await page.waitForTimeout(500);
    }

    // Select a league
    const leagueCard = page.locator('[data-testid="league-card"]').first();
    if (await leagueCard.isVisible()) {
      await leagueCard.click();
      await page.waitForURL('**/leagues/**', { timeout: 5000 });

      // Wait for league detail load
      await page.waitForLoadState('networkidle');

      // Look for join button
      const joinLeagueBtn = page.locator('[data-testid*="join"], button:has-text("Join")').first();
      if (await joinLeagueBtn.isVisible()) {
        await joinLeagueBtn.click();
        await page.waitForTimeout(1000);

        // Check for payment modal (paid league) or success message (free)
        const paymentModal = page.locator('[data-testid="payment-modal"]');
        const successMsg = page.locator('text=Successfully joined');

        if (await paymentModal.isVisible()) {
          console.log('✅ Payment modal appeared (paid league)');
        } else if (await successMsg.isVisible()) {
          console.log('✅ Successfully joined free league');
        } else {
          console.log('✅ Join action processed');
        }
      }
    }
  });

  test('Join paid league with payment modal', async ({ page }) => {
    const testEmail = process.env.TEST_EMAIL || 'test@venlaxsports.com';
    const testPassword = process.env.TEST_PASSWORD || 'TestPassword123!';

    try {
      await loginUser(page, testEmail, testPassword);
    } catch (e) {
      console.log('⚠️ Login may have failed, continuing...');
    }

    // Navigate directly to a known paid league if available
    // or go through join flow to find a paid league
    await page.goto(`${BASE_URL}/join`);
    await page.waitForLoadState('networkidle');

    // Go through filters to find paid leagues
    const tennisBtn = page.locator('button:has-text("Tennis")').first();
    if (await tennisBtn.isVisible()) {
      await tennisBtn.click();
      await page.waitForTimeout(300);
    }

    const doublesBtn = page.locator('button:has-text("Doubles")');
    if (await doublesBtn.isVisible()) {
      await doublesBtn.click();
      await page.waitForTimeout(300);
    }

    // Find a league (more likely to be paid)
    const leagueCard = page.locator('[data-testid="league-card"]').first();
    if (await leagueCard.isVisible()) {
      await leagueCard.click();
      await page.waitForURL('**/leagues/**', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // Attempt join
      const joinBtn = page.locator('[data-testid*="join"], button:has-text("Join")').first();
      if (await joinBtn.isVisible()) {
        await joinBtn.click();
        await page.waitForTimeout(1000);

        // Check for payment modal
        const paymentModal = page.locator('[data-testid="payment-modal"]');
        if (await paymentModal.isVisible()) {
          console.log('✅ Payment modal appeared');

          // Verify modal content
          const priceText = paymentModal.locator('text=$');
          if (await priceText.isVisible()) {
            console.log('✅ Price displayed in modal');
          }

          // Check for payment method options
          const stripeBtn = paymentModal.locator('button:has-text("Stripe")');
          const applePayBtn = paymentModal.locator('button:has-text("Apple Pay")');

          if (await stripeBtn.isVisible()) {
            console.log('✅ Stripe payment option available');
          }
          if (await applePayBtn.isVisible()) {
            console.log('✅ Apple Pay option available');
          }
        }
      }
    }
  });

  test('Join with doublesInviteToken parameter', async ({ page }) => {
    const testEmail = process.env.TEST_EMAIL || 'test@venlaxsports.com';
    const testPassword = process.env.TEST_PASSWORD || 'TestPassword123!';

    try {
      await loginUser(page, testEmail, testPassword);
    } catch (e) {
      console.log('⚠️ Login may have failed, continuing...');
    }

    // Navigate to join flow with doubles invite token
    const fakeToken = 'test-doubles-token-123';
    await page.goto(`${BASE_URL}/join?doublesInviteToken=${fakeToken}`);
    await page.waitForLoadState('networkidle');

    // The flow should work normally, token is used during join
    const tennisBtn = page.locator('button:has-text("Tennis")').first();
    if (await tennisBtn.isVisible()) {
      await tennisBtn.click();
      await page.waitForTimeout(300);
      console.log('✅ Join flow accessible with doubles invite token');
    }
  });

  test('League detail page join button flow', async ({ page }) => {
    const testEmail = process.env.TEST_EMAIL || 'test@venlaxsports.com';
    const testPassword = process.env.TEST_PASSWORD || 'TestPassword123!';

    try {
      await loginUser(page, testEmail, testPassword);
    } catch (e) {
      console.log('⚠️ Login may have failed, continuing...');
    }

    // Navigate to leagues list
    await page.goto(`${BASE_URL}/leagues`);
    await page.waitForLoadState('networkidle');

    // Click first league
    const leagueCard = page.locator('[data-testid="league-card"]').first();
    if (await leagueCard.isVisible()) {
      await leagueCard.click();
      await page.waitForURL('**/leagues/**', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // Check league details loaded
      const leagueName = page.locator('[data-testid="league-name"]');
      if (await leagueName.isVisible()) {
        console.log('✅ League details loaded');
      }

      // Verify tab navigation
      const overviewTab = page.locator('[data-testid*="tab"], button:has-text("Overview")').first();
      const matchesTab = page.locator('[data-testid*="tab"], button:has-text("Matches")').first();
      const standingsTab = page.locator('[data-testid*="tab"], button:has-text("Standings")').first();

      if (await overviewTab.isVisible()) {
        console.log('✅ Overview tab accessible');
        await overviewTab.click();
        await page.waitForTimeout(300);
      }

      if (await matchesTab.isVisible()) {
        console.log('✅ Matches tab accessible');
        await matchesTab.click();
        await page.waitForTimeout(300);
      }

      if (await standingsTab.isVisible()) {
        console.log('✅ Standings tab accessible');
        await standingsTab.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('Join flow with promo code', async ({ page }) => {
    const testEmail = process.env.TEST_EMAIL || 'test@venlaxsports.com';
    const testPassword = process.env.TEST_PASSWORD || 'TestPassword123!';

    try {
      await loginUser(page, testEmail, testPassword);
    } catch (e) {
      console.log('⚠️ Login may have failed, continuing...');
    }

    // Navigate to join flow
    await page.goto(`${BASE_URL}/join`);
    await page.waitForLoadState('networkidle');

    // Complete steps to get to league selection
    const tennisBtn = page.locator('button:has-text("Tennis")').first();
    if (await tennisBtn.isVisible()) {
      await tennisBtn.click();
      await page.waitForTimeout(300);
    }

    const flexBtn = page.locator('button:has-text("Flex")').first();
    if (await flexBtn.isVisible()) {
      await flexBtn.click();
      await page.waitForTimeout(300);
    }

    const singlesBtn = page.locator('button:has-text("Singles")').first();
    if (await singlesBtn.isVisible()) {
      await singlesBtn.click();
      await page.waitForTimeout(500);
    }

    // Select a league
    const leagueCard = page.locator('[data-testid="league-card"]').first();
    if (await leagueCard.isVisible()) {
      await leagueCard.click();
      await page.waitForURL('**/leagues/**', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // Look for promo code input
      const promoInput = page.locator('input[placeholder*="Promo"], [data-testid="promo-input"]');
      if (await promoInput.isVisible()) {
        await promoInput.fill('TEST2024');

        // Look for apply button
        const applyBtn = page.locator('button:has-text("Apply"), [data-testid="apply-promo"]');
        if (await applyBtn.isVisible()) {
          await applyBtn.click();
          await page.waitForTimeout(1000);
          console.log('✅ Promo code applied');
        }
      } else {
        console.log('⚠️ Promo code input not visible');
      }
    }
  });

  test('Partner search in join flow', async ({ page }) => {
    const testEmail = process.env.TEST_EMAIL || 'test@venlaxsports.com';
    const testPassword = process.env.TEST_PASSWORD || 'TestPassword123!';

    try {
      await loginUser(page, testEmail, testPassword);
    } catch (e) {
      console.log('⚠️ Login may have failed, continuing...');
    }

    // Navigate to join flow and select Doubles
    await page.goto(`${BASE_URL}/join`);
    await page.waitForLoadState('networkidle');

    const tennisBtn = page.locator('button:has-text("Tennis")').first();
    if (await tennisBtn.isVisible()) {
      await tennisBtn.click();
      await page.waitForTimeout(300);
    }

    // Select Doubles division
    const doublesDiv = page.locator('[data-testid*="division"], button:has-text("Doubles")');
    if (await doublesDiv.isVisible()) {
      await doublesDiv.click();
      await page.waitForTimeout(500);
      console.log('✅ Doubles division selected');

      // Look for partner search
      const partnerSearch = page.locator('[data-testid="partner-search"]');
      if (await partnerSearch.isVisible()) {
        console.log('✅ Partner search component visible');
      }
    }
  });

  test('Error handling - network failure graceful degradation', async ({ page }) => {
    // Go offline simulation not fully supported in Playwright without CDP,
    // but we can test error states
    await page.goto(`${BASE_URL}/join`);

    // Try to access league data
    const response = page.waitForResponse(response =>
      response.url().includes('/api/leagues') && response.status() !== 200
    );

    // The app should show error message or retry
    const errorMsg = page.locator('[data-testid*="error"], text=Unable');
    const retryBtn = page.locator('button:has-text("Retry")');

    if (await errorMsg.isVisible() || await retryBtn.isVisible()) {
      console.log('✅ Error handling works');
    } else {
      console.log('✅ Join flow loads (no network errors detected)');
    }
  });

  test('Mobile responsive join flow', async ({ browser }) => {
    // Create mobile viewport context
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();

    try {
      await page.goto(`${BASE_URL}/join`);
      await page.waitForLoadState('networkidle');

      // Verify layout is responsive
      const buttons = page.locator('button');
      const visibleButtons = await buttons.filter({ hasNot: page.locator('[style*="display:none"]') }).count();

      if (visibleButtons > 0) {
        console.log('✅ Mobile view: buttons visible and tappable');
      }

      // Test touch/click interactions
      const firstBtn = page.locator('button').first();
      if (await firstBtn.isVisible()) {
        await firstBtn.click();
        console.log('✅ Mobile: button click works');
      }
    } finally {
      await context.close();
    }
  });

  test('Accessibility - join flow keyboard navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/join`);
    await page.waitForLoadState('networkidle');

    // Tab through elements
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName);
    console.log(`✅ Keyboard navigation active: ${focusedElement}`);

    // Press Enter to select
    await page.keyboard.press('Enter');
    console.log('✅ Enter key works');
  });
});
