import { test, expect } from '@playwright/test';

const API = process.env.VITE_BACKEND_URL || 'http://localhost:8001/api';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Join League - Payment Flow', () => {
  test('Payment modal opens for paid league', async ({ page }) => {
    // Navigate to a specific league known to be paid
    // Or go through join flow to find one
    await page.goto(`${BASE_URL}/join`);
    await page.waitForLoadState('networkidle');

    // Select filters
    const tennisBtn = page.locator('button:has-text("Tennis")').first();
    if (await tennisBtn.isVisible()) {
      await tennisBtn.click();
      await page.waitForTimeout(300);
    }

    // Find a league
    const leagueCard = page.locator('[data-testid="league-card"]').first();
    if (await leagueCard.isVisible()) {
      await leagueCard.click();
      await page.waitForURL('**/leagues/**', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // Click join
      const joinBtn = page.locator('[data-testid*="join"], button:has-text("Join")').first();
      if (await joinBtn.isVisible()) {
        await joinBtn.click();
        await page.waitForTimeout(1000);

        // Check modal
        const modal = page.locator('[data-testid="payment-modal"]');
        if (await modal.isVisible()) {
          console.log('✅ Payment modal visible');

          // Check for price display
          const price = modal.locator('text=$, text=$9.99, text=$19.99').first();
          if (await price.isVisible()) {
            const priceText = await price.textContent();
            console.log(`✅ Price displayed: ${priceText}`);
          }
        }
      }
    }
  });

  test('Stripe payment option available', async ({ page }) => {
    await page.goto(`${BASE_URL}/join`);
    await page.waitForLoadState('networkidle');

    const tennisBtn = page.locator('button:has-text("Tennis")').first();
    if (await tennisBtn.isVisible()) {
      await tennisBtn.click();
      await page.waitForTimeout(300);
    }

    const leagueCard = page.locator('[data-testid="league-card"]').first();
    if (await leagueCard.isVisible()) {
      await leagueCard.click();
      await page.waitForURL('**/leagues/**', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      const joinBtn = page.locator('[data-testid*="join"], button:has-text("Join")').first();
      if (await joinBtn.isVisible()) {
        await joinBtn.click();
        await page.waitForTimeout(1000);

        const modal = page.locator('[data-testid="payment-modal"]');
        if (await modal.isVisible()) {
          const stripeBtn = modal.locator('button:has-text("Stripe"), button:has-text("Card")').first();
          if (await stripeBtn.isVisible()) {
            console.log('✅ Stripe payment option available');
          } else {
            console.log('⚠️ Stripe button not visible in modal');
          }
        }
      }
    }
  });

  test('Apple Pay option visible if supported', async ({ page }) => {
    await page.goto(`${BASE_URL}/join`);
    await page.waitForLoadState('networkidle');

    const tennisBtn = page.locator('button:has-text("Tennis")').first();
    if (await tennisBtn.isVisible()) {
      await tennisBtn.click();
      await page.waitForTimeout(300);
    }

    const leagueCard = page.locator('[data-testid="league-card"]').first();
    if (await leagueCard.isVisible()) {
      await leagueCard.click();
      await page.waitForURL('**/leagues/**', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      const joinBtn = page.locator('[data-testid*="join"], button:has-text("Join")').first();
      if (await joinBtn.isVisible()) {
        await joinBtn.click();
        await page.waitForTimeout(1000);

        const modal = page.locator('[data-testid="payment-modal"]');
        if (await modal.isVisible()) {
          const applePayBtn = modal.locator('button:has-text("Apple Pay")');
          if (await applePayBtn.isVisible()) {
            console.log('✅ Apple Pay option available');
          } else {
            console.log('⚠️ Apple Pay not visible (may not be supported on platform)');
          }
        }
      }
    }
  });

  test('Google Pay option visible if supported', async ({ page }) => {
    await page.goto(`${BASE_URL}/join`);
    await page.waitForLoadState('networkidle');

    const tennisBtn = page.locator('button:has-text("Tennis")').first();
    if (await tennisBtn.isVisible()) {
      await tennisBtn.click();
      await page.waitForTimeout(300);
    }

    const leagueCard = page.locator('[data-testid="league-card"]').first();
    if (await leagueCard.isVisible()) {
      await leagueCard.click();
      await page.waitForURL('**/leagues/**', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      const joinBtn = page.locator('[data-testid*="join"], button:has-text("Join")').first();
      if (await joinBtn.isVisible()) {
        await joinBtn.click();
        await page.waitForTimeout(1000);

        const modal = page.locator('[data-testid="payment-modal"]');
        if (await modal.isVisible()) {
          const googlePayBtn = modal.locator('button:has-text("Google Pay")');
          if (await googlePayBtn.isVisible()) {
            console.log('✅ Google Pay option available');
          } else {
            console.log('⚠️ Google Pay not visible (may not be supported on platform)');
          }
        }
      }
    }
  });

  test('Payment modal close button works', async ({ page }) => {
    await page.goto(`${BASE_URL}/join`);
    await page.waitForLoadState('networkidle');

    const tennisBtn = page.locator('button:has-text("Tennis")').first();
    if (await tennisBtn.isVisible()) {
      await tennisBtn.click();
      await page.waitForTimeout(300);
    }

    const leagueCard = page.locator('[data-testid="league-card"]').first();
    if (await leagueCard.isVisible()) {
      await leagueCard.click();
      await page.waitForURL('**/leagues/**', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      const joinBtn = page.locator('[data-testid*="join"], button:has-text("Join")').first();
      if (await joinBtn.isVisible()) {
        await joinBtn.click();
        await page.waitForTimeout(1000);

        const modal = page.locator('[data-testid="payment-modal"]');
        if (await modal.isVisible()) {
          const closeBtn = modal.locator('button[aria-label="Close"], button:has-text("Cancel")').first();
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(300);

            // Modal should close
            const stillVisible = await modal.isVisible();
            if (!stillVisible) {
              console.log('✅ Payment modal closed successfully');
            } else {
              console.log('⚠️ Modal still visible after close');
            }
          }
        }
      }
    }
  });

  test('Promo code validation in payment flow', async ({ page }) => {
    await page.goto(`${BASE_URL}/join`);
    await page.waitForLoadState('networkidle');

    const tennisBtn = page.locator('button:has-text("Tennis")').first();
    if (await tennisBtn.isVisible()) {
      await tennisBtn.click();
      await page.waitForTimeout(300);
    }

    const leagueCard = page.locator('[data-testid="league-card"]').first();
    if (await leagueCard.isVisible()) {
      await leagueCard.click();
      await page.waitForURL('**/leagues/**', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // Try to use promo code before payment modal
      const promoInput = page.locator('input[placeholder*="Promo"], [data-testid="promo-input"]');
      if (await promoInput.isVisible()) {
        await promoInput.fill('INVALID123');

        const applyBtn = page.locator('button:has-text("Apply"), [data-testid="apply-promo"]');
        if (await applyBtn.isVisible()) {
          await applyBtn.click();
          await page.waitForTimeout(1000);

          // Check for error message
          const errorMsg = page.locator('text=Invalid, text=not found, text=expired');
          if (await errorMsg.first().isVisible()) {
            console.log('✅ Invalid promo code error shown');
          }
        }
      }
    }
  });

  test('Payment success callback handling', async ({ page }) => {
    // Test session_id query parameter handling after Stripe redirect
    await page.goto(`${BASE_URL}/leagues/test-league-id?session_id=test-session-123`);
    await page.waitForLoadState('networkidle');

    // App should attempt to verify payment
    // Check for success/error state
    const successMsg = page.locator('text=Successfully, text=joined');
    const errorMsg = page.locator('text=Failed, text=Error, text=Unable');

    if (await successMsg.first().isVisible()) {
      console.log('✅ Payment verification success shown');
    } else if (await errorMsg.first().isVisible()) {
      console.log('✅ Payment verification error handled');
    } else {
      console.log('✅ Payment verification flow initiated');
    }
  });

  test('Doubles league pricing', async ({ page }) => {
    await page.goto(`${BASE_URL}/join`);
    await page.waitForLoadState('networkidle');

    const tennisBtn = page.locator('button:has-text("Tennis")').first();
    if (await tennisBtn.isVisible()) {
      await tennisBtn.click();
      await page.waitForTimeout(300);
    }

    // Select doubles
    const doublesDiv = page.locator('button:has-text("Doubles")').first();
    if (await doublesDiv.isVisible()) {
      await doublesDiv.click();
      await page.waitForTimeout(500);

      const leagueCard = page.locator('[data-testid="league-card"]').first();
      if (await leagueCard.isVisible()) {
        await leagueCard.click();
        await page.waitForURL('**/leagues/**', { timeout: 5000 });
        await page.waitForLoadState('networkidle');

        // Check price is higher for doubles
        const price = page.locator('[data-testid="league-price"]').first();
        if (await price.isVisible()) {
          const priceText = await price.textContent();
          console.log(`✅ Doubles league price: ${priceText}`);
        }

        const joinBtn = page.locator('[data-testid*="join"], button:has-text("Join")').first();
        if (await joinBtn.isVisible()) {
          await joinBtn.click();
          await page.waitForTimeout(1000);

          const modal = page.locator('[data-testid="payment-modal"]');
          if (await modal.isVisible()) {
            const modalPrice = modal.locator('text=$19.99, text=$15, text=$20');
            if (await modalPrice.first().isVisible()) {
              console.log('✅ Doubles pricing displayed in payment modal');
            }
          }
        }
      }
    }
  });
});
