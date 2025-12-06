import { test } from '@playwright/test';

test('Debug: Production build HubSpot configuration', async ({ page }) => {
  // Test against the production build
  await page.goto('http://localhost:3003/');
  await page.waitForLoadState('networkidle');

  // Execute code in the browser context to check configuration
  const configValues = await page.evaluate(() => {
    const getConfigValue = (key: string, fallback: string): string => {
      if (typeof window !== 'undefined') {
        const customFields = (window as any).docusaurus?.siteConfig
          ?.customFields;
        return customFields?.[key] || fallback;
      }
      return fallback;
    };

    const portalId = getConfigValue('HUBSPOT_PORTAL_ID', 'HUBSPOT_PORTAL_ID');
    const formId = getConfigValue('HUBSPOT_FORM_ID', 'HUBSPOT_FORM_ID');

    return {
      portalId,
      formId,
      hasDocusaurus: !!(window as any).docusaurus,
      hasSiteConfig: !!(window as any).docusaurus?.siteConfig,
      hasCustomFields: !!(window as any).docusaurus?.siteConfig?.customFields,
      customFields: (window as any).docusaurus?.siteConfig?.customFields,
      fullSiteConfig: (window as any).docusaurus?.siteConfig
    };
  });

  console.log('Production build HubSpot configuration debug:');
  console.log('Portal ID:', configValues.portalId);
  console.log('Form ID:', configValues.formId);
  console.log('Has docusaurus:', configValues.hasDocusaurus);
  console.log('Has siteConfig:', configValues.hasSiteConfig);
  console.log('Has customFields:', configValues.hasCustomFields);
  console.log(
    'CustomFields:',
    JSON.stringify(configValues.customFields, null, 2)
  );

  // Check if isHubSpotEnabled would return true
  const isEnabled =
    configValues.portalId !== 'HUBSPOT_PORTAL_ID' &&
    configValues.formId !== 'HUBSPOT_FORM_ID';
  console.log('Would isHubSpotEnabled return true?', isEnabled);
});
