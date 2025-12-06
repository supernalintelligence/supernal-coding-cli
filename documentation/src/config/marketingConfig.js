// Marketing Configuration
// This file is generated from supernal.yaml
// Update the YAML file and regenerate this file for changes
Object.defineProperty(exports, '__esModule', { value: true });
exports.getHubSpotConfig =
  exports.getGoogleAnalyticsId =
  exports.isHubSpotEnabled =
  exports.isAnalyticsEnabled =
  exports.marketingConfig =
    void 0;
// Helper function to get config value safely from Docusaurus customFields
var getConfigValue = (key, fallback) => {
  var _a, _b;
  if (typeof window !== 'undefined') {
    var customFields =
      (_b =
        (_a = window.docusaurus) === null || _a === void 0
          ? void 0
          : _a.siteConfig) === null || _b === void 0
        ? void 0
        : _b.customFields;
    return (
      (customFields === null || customFields === void 0
        ? void 0
        : customFields[key]) || fallback
    );
  }
  return fallback;
};
// Default marketing configuration
// Replace these values with your actual IDs
exports.marketingConfig = {
  enabled: true,
  company_name: 'Supernal Intelligence',
  google_analytics: {
    enabled: true,
    tracking_id: getConfigValue('GA4_TRACKING_ID', 'GA_TRACKING_ID'), // Loaded from customFields in docusaurus.config.ts
    anonymize_ip: true,
    debug_mode: false,
  },
  hubspot: {
    enabled: true,
    portal_id: getConfigValue('HUBSPOT_PORTAL_ID', 'HUBSPOT_PORTAL_ID'), // Loaded from customFields
    form_id: getConfigValue('HUBSPOT_FORM_ID', 'HUBSPOT_FORM_ID'), // Loaded from customFields
  },
  cookies: {
    enabled: true,
    banner_position: 'bottom',
    show_details_by_default: false,
    consent_mode: 'opt-in',
    storage_duration_days: 365,
  },
  privacy: {
    privacy_policy_url: '/docs/privacy-policy',
    cookie_policy_url: '/docs/cookie-policy',
    terms_of_service_url: '/docs/terms-of-service',
  },
  email: {
    signup_enabled: true,
    default_lists: ['general-updates', 'developer-news'],
    double_opt_in: true,
  },
  popup: {
    enabled: true,
    scroll_percentage: 70,
    time_on_page_seconds: 30,
    cooldown_days: 7,
    max_shows_per_session: 1,
    target_pages: ['/docs/getting-started', '/docs/cli-commands'],
    exclude_pages: ['/docs/privacy-policy', '/docs/cookie-policy'],
  },
};
// Helper functions
var isAnalyticsEnabled = () =>
  exports.marketingConfig.enabled &&
  exports.marketingConfig.google_analytics.enabled &&
  exports.marketingConfig.google_analytics.tracking_id !== 'GA_TRACKING_ID';
exports.isAnalyticsEnabled = isAnalyticsEnabled;
var isHubSpotEnabled = () =>
  exports.marketingConfig.enabled &&
  exports.marketingConfig.hubspot.enabled &&
  exports.marketingConfig.hubspot.portal_id !== 'HUBSPOT_PORTAL_ID' &&
  exports.marketingConfig.hubspot.form_id !== 'HUBSPOT_FORM_ID';
exports.isHubSpotEnabled = isHubSpotEnabled;
var getGoogleAnalyticsId = () =>
  exports.marketingConfig.google_analytics.tracking_id;
exports.getGoogleAnalyticsId = getGoogleAnalyticsId;
var getHubSpotConfig = () => ({
  portalId: exports.marketingConfig.hubspot.portal_id,
  formId: exports.marketingConfig.hubspot.form_id,
});
exports.getHubSpotConfig = getHubSpotConfig;
