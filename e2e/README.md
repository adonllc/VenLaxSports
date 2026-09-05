# Playwright E2E Tests - VenLax Sports

End-to-end tests for VenLax Sports using Playwright.

## Setup

### 1. Install Playwright

```bash
cd frontend
yarn add -D @playwright/test
npx playwright install
```

### 2. Environment Variables

Create a `.env.test` file in the project root (or set environment variables):

```bash
# Backend API
VITE_BACKEND_URL=http://localhost:8001/api

# Frontend base URL
BASE_URL=http://localhost:3000

# Test credentials (optional - defaults to test values)
TEST_EMAIL=test@venlaxsports.com
TEST_PASSWORD=TestPassword123!

# Skip server start (useful if running manually)
SKIP_SERVER=false
```

### 3. Start Dev Servers

```bash
# Terminal 1: Backend
cd backend
uvicorn server:app --reload --port 8001

# Terminal 2: Frontend
cd frontend
yarn start
```

## Running Tests

### Run all tests
```bash
yarn test:e2e
```

### Run in headed mode (see browser)
```bash
yarn test:e2e:headed
```

### Run in debug mode
```bash
yarn test:e2e:debug
```

### Run in UI mode (interactive)
```bash
yarn test:e2e:ui
```

### Run specific test file
```bash
npx playwright test e2e/join-league.spec.js
```

### Run specific test
```bash
npx playwright test -g "Complete join flow"
```

## Test Structure

Tests are in `e2e/` directory:

- `join-league.spec.js` — Join league flow tests
- `fixtures.js` — Reusable test utilities and helpers

## Test Coverage

### Join League Tests

1. **Navigate join flow** — Verify join flow UI loads
2. **Complete flow** — Sport → Format → Division → League selection
3. **Free league join** — Join without payment
4. **Paid league join** — Payment modal appears
5. **Doubles invite** — Join with doubles token
6. **League detail page** — Tab navigation
7. **Promo code** — Apply discount code
8. **Partner search** — Doubles partner selection
9. **Error handling** — Network failure graceful degradation
10. **Mobile responsive** — Test on mobile viewport
11. **Keyboard navigation** — Accessibility test

## Writing New Tests

Use the fixtures provided in `fixtures.js`:

```javascript
import { test } from './fixtures';

test('My new test', async ({ page, loginUser, selectSport }) => {
  await loginUser(page, 'test@example.com', 'password123');
  await selectSport(page, 'Tennis');
  // ... test logic
});
```

## Debugging

### View test traces
```bash
npx playwright show-trace test-results/trace.zip
```

### View failed test videos
Videos are saved in `test-results/` for failed tests

### Get debug logs
```bash
PWDEBUG=1 npx playwright test
```

## CI/CD Integration

Tests run with:
- Retries enabled (2 retries in CI)
- Screenshots on failure
- Video recording on failure
- Trace collection

Set `CI=true` environment variable to enable CI mode.

## Troubleshooting

### Tests timeout
- Increase timeout: `await page.waitForTimeout(5000)` for longer waits
- Check if dev servers are running on correct ports
- Check `BASE_URL` and `VITE_BACKEND_URL` env vars

### Login fails
- Verify test user exists in database
- Check `TEST_EMAIL` and `TEST_PASSWORD` env vars
- Verify backend auth is working

### Payment modal doesn't appear
- Ensure league has a price set
- Check Stripe configuration

### Mobile tests fail
- Check viewport dimensions in test
- May need to adjust CSS for mobile layout

## Notes

- Tests run sequentially (workers: 1) for stability
- Each test is independent
- Artifacts (screenshots, videos, traces) saved in `test-results/`
- HTML report generated after each run
