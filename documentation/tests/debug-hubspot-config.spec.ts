import { test } from '@playwright/test';

test('Debug: HubSpot configuration values', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Execute code in the browser context to check configuration
  const configValues = await page.evaluate(() => {
    // Access the marketing config
    const getConfigValue = (key, fallback) => {
      if (typeof window !== 'undefined') {
        const customFields = window.docusaurus?.siteConfig?.customFields;
        return customFields?.[key] || fallback;
      }
      return fallback;
    };

    const portalId = getConfigValue('HUBSPOT_PORTAL_ID', 'HUBSPOT_PORTAL_ID');
    const formId = getConfigValue('HUBSPOT_FORM_ID', 'HUBSPOT_FORM_ID');

    return {
      portalId,
      formId,
      hasCustomFields: !!(window as any).docusaurus?.siteConfig?.customFields,
      customFields: (window as any).docusaurus?.siteConfig?.customFields
    };
  });

  console.log('HubSpot configuration debug:');
  console.log('Portal ID:', configValues.portalId);
  console.log('Form ID:', configValues.formId);
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
