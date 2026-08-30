import asyncio
from playwright.async_api import async_playwright

async def test_mobile_dashboard():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={"width": 375, "height": 667})
        page = await context.new_page()

        try:
            # Navigate to home first
            print("[TEST] Loading home page...")
            await page.goto("https://venlaxsports.com/")
            await page.wait_for_load_state("networkidle")

            # Click user menu or find login
            print("[TEST] Looking for login link...")
            try:
                await page.click("a[data-testid='nav-login']", timeout=5000)
                print("[TEST] Clicked login link")
            except:
                print("[ERROR] Login link not found, trying /auth directly")
                await page.goto("https://venlaxsports.com/auth")

            await page.wait_for_load_state("networkidle")

            # Find & fill form
            print("[TEST] Waiting for email input...")
            await page.wait_for_selector("input[type='email']", timeout=5000)

            print("[TEST] Entering credentials...")
            await page.fill("input[type='email']", "adonllcusa@gmail.com")
            await page.fill("input[type='password']", "Venlaxsports1!")

            # Find submit button
            buttons = await page.query_selector_all("button[type='submit']")
            print(f"[TEST] Found {len(buttons)} submit buttons, clicking first...")
            if buttons:
                await buttons[0].click()

            print("[TEST] Waiting for redirect after login...")
            await page.wait_for_url("**/dashboard", timeout=10000)
            print("[SUCCESS] Logged in and navigated to dashboard")

            # Take screenshot
            print("[TEST] Taking mobile screenshot...")
            await page.screenshot(path="/tmp/mobile_dashboard.png")
            print("[SUCCESS] Screenshot saved")

            # Check content
            body_text = await page.inner_text("body")
            print(f"[INFO] Page text length: {len(body_text)} chars")

            if len(body_text) > 200:
                print("[SUCCESS] Page has content")
            else:
                print(f"[ERROR] Page appears blank. Text preview: {body_text[:100]}")

        except Exception as e:
            print(f"[ERROR] {type(e).__name__}: {str(e)}")

        await browser.close()

asyncio.run(test_mobile_dashboard())
