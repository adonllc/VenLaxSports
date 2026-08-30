import asyncio
from playwright.async_api import async_playwright

async def test_rewards_page():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        # Enable network logging
        async def log_response(response):
            if 'referrals' in response.url:
                print(f"[API] {response.status} {response.url}")
                try:
                    body = await response.text()
                    print(f"[BODY] {body}")
                except:
                    pass

        page.on("response", log_response)

        # Navigate to login
        print("[TEST] Navigating to login...")
        await page.goto("https://venlaxsports.com/auth")
        await page.wait_for_load_state("networkidle")

        # Login with test credentials
        print("[TEST] Logging in...")
        await page.fill("input[type='email']", "adonllcusa@gmail.com")
        await page.fill("input[type='password']", "Venlaxsports1!")
        await page.click("button[type='submit']")
        await page.wait_for_load_state("networkidle")

        # Navigate to rewards
        print("[TEST] Navigating to /rewards...")
        await page.goto("https://venlaxsports.com/rewards")
        await page.wait_for_load_state("networkidle")

        # Check if referral code is visible
        try:
            code = await page.inner_text("code")
            print(f"[SUCCESS] Referral code found: {code}")
        except:
            print("[ERROR] Referral code not found on page")

        # Check for copy button
        try:
            await page.wait_for_selector("button:has-text('Copy')", timeout=5000)
            print("[SUCCESS] Copy button found")
        except:
            print("[ERROR] Copy button not found")

        await browser.close()

asyncio.run(test_rewards_page())
