import { test } from '@playwright/test';

test('Debug: What is actually on the homepage?', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  console.log('Page title:', await page.title());
  console.log('Page URL:', page.url());

  // Check for the SignupCTA component
  const signupCTA = page.locator('.signup-banner');
  const signupCTAVisible = await signupCTA.isVisible();
  console.log('SignupCTA banner (.signup-banner) visible:', signupCTAVisible);

  // Check for HubSpot specific elements
  const hubspotBanner = page.locator('.hubspot-banner');
  const hubspotBannerVisible = await hubspotBanner.isVisible();
  console.log(
    'HubSpot banner (.hubspot-banner) visible:',
    hubspotBannerVisible
  );

  // Check for any HubSpot elements
  const anyHubspot = page.locator('[class*="hubspot"]');
  const hubspotCount = await anyHubspot.count();
  console.log('Any elements with "hubspot" in class:', hubspotCount);

  if (hubspotCount > 0) {
    for (let i = 0; i < hubspotCount; i++) {
      const element = anyHubspot.nth(i);
      const className = await element.getAttribute('class');
      const isVisible = await element.isVisible();
      console.log(
        `HubSpot element ${i + 1}: class="${className}", visible=${isVisible}`
      );
    }
  }

  // Check for the main components we expect
  const homepageFeatures = page
    .locator('section')
    .filter({ hasText: 'Focus on Needs' });
  console.log('HomepageFeatures visible:', await homepageFeatures.isVisible());

  const homepageStats = page.locator('text=Development Metrics');
  console.log('HomepageStats visible:', await homepageStats.isVisible());

  // Take a screenshot to visually inspect
  await page.screenshot({
    path: 'tests/screenshots/debug-homepage.png',
    fullPage: true
  });

  // Log all sections on the page
  const sections = page.locator('section, main > div');
  const sectionCount = await sections.count();
  console.log(`Total sections found: ${sectionCount}`);

  for (let i = 0; i < Math.min(sectionCount, 10); i++) {
    const section = sections.nth(i);
    const text = await section.textContent();
    const className = (await section.getAttribute('class')) || 'no-class';
    console.log(
      `Section ${i + 1}: class="${className}", text="${text?.substring(0, 100)}..."`
    );
  }
});
