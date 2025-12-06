import { test } from '@playwright/test';

test('Debug: Marketing config function values', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Execute code in the browser context to check marketing config directly
  const configValues = await page.evaluate(() => {
    // Import the marketing config (this might not work in browser context)
    // Let's access it through the module system or check what's actually imported

    // Let's check if we can access the functions from the global scope
    // or if they're available through any other means
    return {
      windowKeys: Object.keys(window),
      documentTitle: document.title
      // We'll need to check what's actually available
    };
  });

  console.log(
    'Available window keys (first 20):',
    configValues.windowKeys.slice(0, 20)
  );
  console.log('Document title:', configValues.documentTitle);
});

test('Check if HubSpot components are imported', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Look for HubSpot related errors in console
  const consoleMessages: string[] = [];
  page.on('console', (msg) => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`);
  });

  // Wait a bit to collect console messages
  await page.waitForTimeout(2000);

  console.log('Console messages:');
  consoleMessages.forEach((msg) => console.log('  ', msg));

  // Check if there are any React errors
  const hasErrors = consoleMessages.some(
    (msg) =>
      msg.includes('error') || msg.includes('Error') || msg.includes('failed')
  );

  console.log('Has console errors:', hasErrors);
});
