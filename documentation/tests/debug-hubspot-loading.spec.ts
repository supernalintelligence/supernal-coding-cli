import { test } from '@playwright/test';

test('Debug: HubSpot script loading and form creation', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  console.log('=== CHECKING HUBSPOT BANNER ===');

  // Check if the banner exists
  const banner = page.locator('.hubspot-banner');
  const bannerVisible = await banner.isVisible();
  console.log('HubSpot banner visible:', bannerVisible);

  if (bannerVisible) {
    const bannerText = await banner.textContent();
    console.log('Banner text:', bannerText?.substring(0, 100));
  }

  console.log('=== CHECKING FORM EMBED AREA ===');

  // Check the form embed area
  const formEmbed = page.locator('.hubspot-form-embed');
  const formEmbedExists = (await formEmbed.count()) > 0;
  console.log('Form embed exists:', formEmbedExists);

  if (formEmbedExists) {
    const formEmbedVisible = await formEmbed.isVisible();
    const formEmbedHTML = await formEmbed.innerHTML();
    console.log('Form embed visible:', formEmbedVisible);
    console.log('Form embed HTML:', formEmbedHTML);

    // Check computed styles
    const styles = await formEmbed.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        height: computed.height,
        minHeight: computed.minHeight
      };
    });
    console.log('Form embed computed styles:', styles);
  }

  console.log('=== CHECKING HUBSPOT SCRIPTS ===');

  // Check if HubSpot scripts are loaded
  const scriptExists =
    (await page.locator('script[src*="46224345"]').count()) > 0;
  console.log('HubSpot embed script exists:', scriptExists);

  // Check if the script has loaded successfully
  const scriptLoaded = await page.evaluate(() => {
    return (
      typeof window !== 'undefined' &&
      document.querySelector('script[src*="46224345"]')?.getAttribute('src')
    );
  });
  console.log('HubSpot script src:', scriptLoaded);

  console.log('=== CHECKING HS-FORM-FRAME ===');

  // Check for the hs-form-frame div
  const hsFormFrame = page.locator('.hs-form-frame');
  const hsFormFrameExists = (await hsFormFrame.count()) > 0;
  console.log('hs-form-frame exists:', hsFormFrameExists);

  if (hsFormFrameExists) {
    const hsFormFrameVisible = await hsFormFrame.isVisible();
    const hsFormFrameHTML = await hsFormFrame.innerHTML();
    const attributes = await hsFormFrame.evaluate((el) => ({
      'data-region': el.getAttribute('data-region'),
      'data-form-id': el.getAttribute('data-form-id'),
      'data-portal-id': el.getAttribute('data-portal-id')
    }));
    console.log('hs-form-frame visible:', hsFormFrameVisible);
    console.log('hs-form-frame HTML:', hsFormFrameHTML);
    console.log('hs-form-frame attributes:', attributes);
  }

  console.log('=== CHECKING LOADING STATE ===');

  // Check loading state
  const loadingDiv = page.locator('.hubspot-loading');
  const loadingExists = (await loadingDiv.count()) > 0;
  const loadingVisible = loadingExists ? await loadingDiv.isVisible() : false;
  console.log('Loading div exists:', loadingExists);
  console.log('Loading div visible:', loadingVisible);

  // Wait a bit more for scripts to load
  console.log('Waiting 5 seconds for scripts to load...');
  await page.waitForTimeout(5000);

  // Check again after waiting
  const hsFormFrameExistsAfterWait = (await hsFormFrame.count()) > 0;
  const hsFormFrameVisibleAfterWait = hsFormFrameExistsAfterWait
    ? await hsFormFrame.isVisible()
    : false;
  console.log('After wait - hs-form-frame exists:', hsFormFrameExistsAfterWait);
  console.log(
    'After wait - hs-form-frame visible:',
    hsFormFrameVisibleAfterWait
  );

  // Take a screenshot
  await page.screenshot({
    path: 'tests/screenshots/hubspot-debug.png',
    fullPage: true
  });
});
