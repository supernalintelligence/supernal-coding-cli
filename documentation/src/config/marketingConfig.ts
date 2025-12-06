// Marketing Configuration
// This file is generated from supernal.yaml
// Update the YAML file and regenerate this file for changes

// Helper function to get config value safely from Docusaurus customFields
const getConfigValue = (key: string, fallback: string): string => {
  if (typeof window !== 'undefined') {
    const customFields = (window as any).docusaurus?.siteConfig?.customFields;
    return customFields?.[key] || fallback;
  }
  return fallback;
};

export interface MarketingConfig {
  enabled: boolean;
  company_name: string;
  google_analytics: {
    enabled: boolean;
    tracking_id: string;
    anonymize_ip: boolean;
    debug_mode: boolean;
  };
  hubspot: {
    enabled: boolean;
    portal_id: string;
    form_id: string;
    api_key?: string;
  };
  cookies: {
    enabled: boolean;
    banner_position: 'bottom' | 'top';
    show_details_by_default: boolean;
    consent_mode: 'opt-in' | 'opt-out';
    storage_duration_days: number;
  };
  privacy: {
    privacy_policy_url: string;
    cookie_policy_url: string;
    terms_of_service_url: string;
  };
  email: {
    signup_enabled: boolean;
    default_lists: string[];
    double_opt_in: boolean;
  };
  popup: {
    enabled: boolean;
    scroll_percentage: number;
    time_on_page_seconds: number;
    cooldown_days: number;
    max_shows_per_session: number;
    target_pages: string[];
    exclude_pages: string[];
  };
}

// Default marketing configuration
// Replace these values with your actual IDs
export const marketingConfig: MarketingConfig = {
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
    portal_id: '46224345', // Hardcoded working portal ID
    form_id: '8f9b35de-f230-430c-ab8e-062afd49fed3', // Hardcoded working form ID
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
    scroll_percentage: 50,
    time_on_page_seconds: 30, // 30 seconds as requested
    cooldown_days: 7,
    max_shows_per_session: 1,
    target_pages: [
      '/docs/',
      '/docs/getting-started',
      '/docs/cli-commands',
      '/docs/workflow',
    ],
    exclude_pages: [
      '/docs/privacy-policy',
      '/docs/cookie-policy',
      '/docs/terms',
      '/docs/contributing',
      '/docs/security',
    ],
  },
};

// Helper functions
export const isAnalyticsEnabled = (): boolean => {
  return (
    marketingConfig.enabled &&
    marketingConfig.google_analytics.enabled &&
    marketingConfig.google_analytics.tracking_id !== 'GA_TRACKING_ID'
  );
};

export const isHubSpotEnabled = (): boolean => {
  return (
    marketingConfig.enabled &&
    marketingConfig.hubspot.enabled &&
    marketingConfig.hubspot.portal_id !== 'HUBSPOT_PORTAL_ID' &&
    marketingConfig.hubspot.form_id !== 'HUBSPOT_FORM_ID'
  );
};

export const getGoogleAnalyticsId = (): string => {
  return marketingConfig.google_analytics.tracking_id;
};

export const getHubSpotConfig = () => {
  return {
    portalId: marketingConfig.hubspot.portal_id,
    formId: marketingConfig.hubspot.form_id,
  };
};
