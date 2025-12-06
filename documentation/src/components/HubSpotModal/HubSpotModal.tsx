// COMPLIANCE-TAG: GDPR, CCPA, ePrivacy, CAN-SPAM
// HubSpot modal popup component for email collection
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import './HubSpotModal.css';

interface HubSpotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignupComplete?: () => void;
  portalId?: string;
  formId?: string;
}

// Helper function to safely get config values from Docusaurus customFields
const getConfigValue = (key: string, fallback: string): string => {
  if (typeof window !== 'undefined') {
    const customFields = (window as any).docusaurus?.siteConfig?.customFields;
    return customFields?.[key] || fallback;
  }
  return fallback;
};

const HubSpotModal: React.FC<HubSpotModalProps> = ({
  isOpen,
  onClose,
  onSignupComplete,
  portalId,
  formId
}) => {
  const [isHubSpotLoaded, setIsHubSpotLoaded] = useState(false);
  const [isFormCreated, setIsFormCreated] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Get HubSpot configuration from environment variables via customFields
  const actualPortalId =
    portalId || getConfigValue('HUBSPOT_PORTAL_ID', '46224345');
  const actualFormId =
    formId ||
    getConfigValue('HUBSPOT_FORM_ID', '8f9b35de-f230-430c-ab8e-062afd49fed3');

  // Load HubSpot script when modal opens
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Load HubSpot Forms script if not already loaded
      if (!window.hbspt) {
        const script = document.createElement('script');
        script.src = '//js.hsforms.net/forms/embed/v2.js';
        script.charset = 'utf-8';
        script.type = 'text/javascript';
        script.onload = () => setIsHubSpotLoaded(true);
        document.head.appendChild(script);
      } else {
        setIsHubSpotLoaded(true);
      }
    }
  }, []);

  useEffect(() => {
    if (
      isOpen &&
      !isSuccess &&
      !isFormCreated &&
      formRef.current &&
      isHubSpotLoaded &&
      window.hbspt
    ) {
      // Clear any existing form by emptying the container
      formRef.current.innerHTML = '';

      // Create HubSpot form
      window.hbspt.forms.create({
        portalId: actualPortalId,
        formId: actualFormId,
        region: 'na1',
        target: '#hubspot-modal-form',
        onFormSubmitted: () => {
          setIsSuccess(true);
          // Auto-close after showing success state
          setTimeout(() => {
            onSignupComplete?.();
            onClose();
          }, 2000);
        }
      });

      setIsFormCreated(true);
    }
  }, [
    isOpen,
    isSuccess,
    isFormCreated,
    isHubSpotLoaded,
    actualPortalId,
    actualFormId,
    onSignupComplete,
    onClose
  ]);

  // Reset form state when form closes
  useEffect(() => {
    if (!isOpen) {
      setIsSuccess(false);
      setIsFormCreated(false);
    }
  }, [isOpen]);

  // Handle click outside to close modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="hubspot-modal-overlay" onClick={handleBackdropClick}>
      <div className="hubspot-modal-content">
        <div className="hubspot-modal-header">
          <button
            className="hubspot-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="hubspot-modal-body">
          {!isSuccess ? (
            <>
              <div className="text-center mb-4">
                <h3 className="text-xl font-semibold mb-2">
                  Join Supernal Coding
                </h3>
                <p className="text-gray-400 text-sm">
                  Get notified about new features, enterprise offerings, and
                  development updates.
                </p>
              </div>

              <div id="hubspot-modal-form" ref={formRef} className="space-y-4">
                {!isHubSpotLoaded && (
                  <div className="hubspot-loading">
                    <div className="hubspot-spinner"></div>
                    <p>Loading form...</p>
                  </div>
                )}
              </div>

              <div className="mt-4 text-center">
                <p className="text-xs text-gray-400">
                  By signing up, you agree to our{' '}
                  <a
                    href="/docs/terms"
                    className="text-blue-500 hover:underline"
                  >
                    Terms
                  </a>{' '}
                  and{' '}
                  <a
                    href="/docs/privacy"
                    className="text-blue-500 hover:underline"
                  >
                    Privacy Policy
                  </a>
                </p>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Welcome to Supernal Coding!
              </h3>
              <p className="text-gray-400 text-sm">
                You're now connected to the future of development
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HubSpotModal;

// Add HubSpot types to window object
declare global {
  interface Window {
    hbspt: {
      forms: {
        create: (config: any) => any;
      };
    };
  }
}
