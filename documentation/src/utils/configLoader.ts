// Simple config loader that imports the static marketing config
// This avoids complex YAML parsing in the browser

import {
  isAnalyticsEnabled,
  isHubSpotEnabled,
  type MarketingConfig,
  marketingConfig
} from '../config/marketingConfig';

// Export the config and helper functions
export const loadMarketingConfig = async (): Promise<MarketingConfig> => {
  return marketingConfig;
};

export { isAnalyticsEnabled, isHubSpotEnabled, type MarketingConfig };
