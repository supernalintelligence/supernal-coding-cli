// COMPLIANCE-TAG: GDPR, CCPA, ePrivacy, Cookie-Law
// Component for privacy regulation compliance - cookie consent management
import type React from 'react';
import { useEffect, useState } from 'react';
import './CookieBanner.css';

// Helper function to safely get config values from Docusaurus customFields
const getConfigValue = (key: string, fallback: string): string => {
  if (typeof window !== 'undefined') {
    const customFields = (window as any).docusaurus?.siteConfig?.customFields;
    return customFields?.[key] || fallback;
  }
  return fallback;
};

interface CookieBannerProps {
  companyName?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
}

const CookieBanner: React.FC<CookieBannerProps> = ({
  companyName = 'Supernal Intelligence',
  privacyPolicyUrl = 'https://supernal.ai/privacy',
  cookiePolicyUrl = 'https://supernal.ai/terms'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false,
    preferences: false
  });
  const [showDetails, setShowDetails] = useState(false);

  // Define applyCookieSettings before useEffect to avoid "Cannot access before initialization" error
  const applyCookieSettings = (prefs: typeof preferences) => {
    // Google Analytics
    if (prefs.analytics) {
      // Enable GA if tracking ID is available
      if (
        window.gtag &&
        getConfigValue('GA4_TRACKING_ID', 'GA_TRACKING_ID') !== 'GA_TRACKING_ID'
      ) {
        window.gtag('consent', 'update', {
          analytics_storage: 'granted',
          ad_storage: prefs.marketing ? 'granted' : 'denied'
        });
      }
    } else {
      // Disable GA
      if (window.gtag) {
        window.gtag('consent', 'update', {
          analytics_storage: 'denied',
          ad_storage: 'denied'
        });
      }
    }

    // HubSpot tracking
    if (prefs.marketing) {
      // Enable HubSpot tracking
      if (window._hsq) {
        window._hsq.push(['doNotTrack', false]);
      }
    } else {
      // Disable HubSpot tracking
      if (window._hsq) {
        window._hsq.push(['doNotTrack', true]);
      }
    }

    // Other analytics tools can be added here
    console.log('Cookie preferences applied:', prefs);
  };

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setIsVisible(true);
    } else {
      // Load saved preferences and apply them
      const savedPrefs = JSON.parse(consent);
      setPreferences(savedPrefs);
      applyCookieSettings(savedPrefs);
    }
  }, [applyCookieSettings]);

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true
    };

    setPreferences(allAccepted);
    localStorage.setItem('cookie-consent', JSON.stringify(allAccepted));
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    applyCookieSettings(allAccepted);
    setIsVisible(false);

    // Track acceptance
    if (window.gtag) {
      window.gtag('event', 'cookie_consent', {
        event_category: 'privacy',
        event_label: 'accept_all'
      });
    }
  };

  const acceptNecessary = () => {
    const necessaryOnly = {
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false
    };

    setPreferences(necessaryOnly);
    localStorage.setItem('cookie-consent', JSON.stringify(necessaryOnly));
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    applyCookieSettings(necessaryOnly);
    setIsVisible(false);
  };

  const saveCustomPreferences = () => {
    localStorage.setItem('cookie-consent', JSON.stringify(preferences));
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    applyCookieSettings(preferences);
    setIsVisible(false);

    // Track custom preferences
    if (window.gtag) {
      window.gtag('event', 'cookie_consent', {
        event_category: 'privacy',
        event_label: 'custom_preferences',
        custom_parameters: preferences
      });
    }
  };

  const updatePreference = (key: keyof typeof preferences) => {
    if (key === 'necessary') return; // Cannot disable necessary cookies

    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (!isVisible) return null;

  return (
    <div className="cookie-banner-overlay">
      <div className="cookie-banner">
        <div className="cookie-content">
          <div className="cookie-header">
            <h3>🍪 Cookie Settings</h3>
            <button
              className="close-btn"
              onClick={() => setIsVisible(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="cookie-description">
            <p>
              We use cookies to enhance your experience and analyze site usage.
            </p>
          </div>

          <div className="cookie-actions">
            <button
              className="btn btn-customize"
              onClick={() => setShowDetails(!showDetails)}
              title="Customize cookie preferences"
            >
              ⚙️
            </button>
            <button className="btn btn-required" onClick={acceptNecessary}>
              Required
            </button>
            <button className="btn btn-accept-all" onClick={acceptAll}>
              All
            </button>
          </div>

          {showDetails && (
            // Detailed preferences
            <div className="cookie-preferences">
              <div className="preference-category">
                <div className="preference-header">
                  <span className="preference-title">Essential</span>
                  <span className="preference-status required">Required</span>
                </div>
                <p className="preference-description">
                  Basic site functionality and security.
                </p>
              </div>

              <div className="preference-category">
                <div className="preference-header">
                  <span className="preference-title">Analytics</span>
                  <label className="preference-toggle">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={() => updatePreference('analytics')}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <p className="preference-description">
                  Site usage insights (Google Analytics).
                </p>
              </div>

              <div className="preference-category">
                <div className="preference-header">
                  <span className="preference-title">Marketing</span>
                  <label className="preference-toggle">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={() => updatePreference('marketing')}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <p className="preference-description">
                  Relevant content and campaigns (HubSpot).
                </p>
              </div>

              <div className="preference-category">
                <div className="preference-header">
                  <span className="preference-title">Preferences</span>
                  <label className="preference-toggle">
                    <input
                      type="checkbox"
                      checked={preferences.preferences}
                      onChange={() => updatePreference('preferences')}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <p className="preference-description">
                  Remember your settings and choices.
                </p>
              </div>

              <div className="cookie-actions">
                <button
                  className="btn btn-save"
                  onClick={saveCustomPreferences}
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {showDetails && (
            <div className="cookie-links">
              <a
                href={privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>
              <a
                href={cookiePolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms of Service
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Extend Window interface for TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    _hsq?: any[];
  }
}

export default CookieBanner;
