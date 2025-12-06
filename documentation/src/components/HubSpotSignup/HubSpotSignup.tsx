// COMPLIANCE-TAG: GDPR, CCPA, ePrivacy, CAN-SPAM
// Marketing data collection component - handles PII and consent
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import './HubSpotSignup.css';

interface HubSpotSignupProps {
  formId?: string;
  portalId?: string;
  onSubmit?: (data: any) => void;
  buttonText?: string;
  title?: string;
  description?: string;
  variant?: 'banner' | 'popup' | 'inline';
  showOnPages?: string[];
  onClose?: () => void;
}

const HubSpotSignup: React.FC<HubSpotSignupProps> = ({
  formId,
  portalId,
  onSubmit,
  buttonText = 'Get Early Access',
  title = 'Stay Updated with Supernal Coding',
  description = 'Get notified about new features, enterprise offerings, and development updates.',
  variant = 'inline',
  showOnPages = [],
  onClose
}) => {
  const [showModal, setShowModal] = useState(false);
  const [isHubSpotLoaded, setIsHubSpotLoaded] = useState(false);
  const [isFormCreated, setIsFormCreated] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Use working HubSpot IDs
  const actualFormId = formId || '8f9b35de-f230-430c-ab8e-062afd49fed3';
  const actualPortalId = portalId || '46224345';

  // Load HubSpot script exactly like the working implementation
  useEffect(() => {
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
  }, []);

  // Create HubSpot form for banner variant using the working approach
  useEffect(() => {
    if (
      variant === 'banner' &&
      isFormOpen &&
      !isSuccess &&
      !isFormCreated &&
      formRef.current &&
      isHubSpotLoaded &&
      window.hbspt
    ) {
      // Clear any existing form by emptying the container
      formRef.current.innerHTML = '';

      // Create HubSpot form exactly like the working implementation
      window.hbspt.forms.create({
        portalId: actualPortalId,
        formId: actualFormId,
        region: 'na1',
        target: '#hubspot-banner-form',
        onFormSubmitted: () => {
          console.log('Banner form submitted to HubSpot');
          setIsSuccess(true);
          // Auto-close after showing success state
          setTimeout(() => {
            if (onSubmit) onSubmit({ success: true });
          }, 2000);
        }
      });

      setIsFormCreated(true);
    }
  }, [
    variant,
    isFormOpen,
    isSuccess,
    isFormCreated,
    isHubSpotLoaded,
    actualPortalId,
    actualFormId,
    onSubmit
  ]);

  // Reset form state when form closes
  useEffect(() => {
    if (!isFormOpen) {
      setIsSuccess(false);
      setIsFormCreated(false);
    }
  }, [isFormOpen]);

  // Create HubSpot form for modal variant
  useEffect(() => {
    if (showModal && !isFormCreated && isHubSpotLoaded && window.hbspt) {
      const container = document.getElementById('hubspot-modal-form');
      if (container) {
        container.innerHTML = '';

        window.hbspt.forms.create({
          portalId: actualPortalId,
          formId: actualFormId,
          region: 'na1',
          target: '#hubspot-modal-form',
          onFormSubmitted: () => {
            console.log('Modal form submitted to HubSpot');
            setTimeout(() => {
              setShowModal(false);
              if (onSubmit) onSubmit({ success: true });
            }, 2000);
          }
        });
        setIsFormCreated(true);
      }
    }
  }, [
    showModal,
    isFormCreated,
    isHubSpotLoaded,
    actualPortalId,
    actualFormId,
    onSubmit
  ]);

  const handleFormClick = (e: React.FormEvent) => {
    e.preventDefault();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    if (onClose) onClose();
  };

  // Always render the component since we're using working HubSpot IDs

  // Check if component should show on current page
  if (variant === 'popup' && showOnPages.length > 0) {
    const currentPath =
      typeof window !== 'undefined' ? window.location.pathname : '';
    if (!showOnPages.includes(currentPath)) {
      return null;
    }
  }

  const renderFakeForm = () => (
    <form className="hubspot-fake-form" onSubmit={handleFormClick}>
      <div className="form-group">
        <label htmlFor="fake-email">Email Address</label>
        <input
          id="fake-email"
          type="email"
          placeholder="Enter your email"
          className="form-input"
          onClick={handleFormClick}
          readOnly
        />
      </div>
      <div className="form-group">
        <label htmlFor="fake-name">First Name</label>
        <input
          id="fake-name"
          type="text"
          placeholder="Enter your first name"
          className="form-input"
          onClick={handleFormClick}
          readOnly
        />
      </div>
      <div className="form-group">
        <label htmlFor="fake-company">Company (optional)</label>
        <input
          id="fake-company"
          type="text"
          placeholder="Enter your company"
          className="form-input"
          onClick={handleFormClick}
          readOnly
        />
      </div>
      <button type="submit" className="submit-button">
        {buttonText}
      </button>
    </form>
  );

  const handleBannerClick = () => {
    setIsFormOpen(true);
  };

  const renderBanner = () => {
    if (!isFormOpen) {
      return (
        <div
          className="hubspot-banner"
          onClick={handleBannerClick}
          style={{ cursor: 'pointer' }}
        >
          <div className="banner-content">
            <div className="banner-text">
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
            <div className="banner-cta">
              <button className="banner-button">{buttonText}</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="hubspot-banner-expanded">
        <div className="banner-content">
          {!isSuccess ? (
            <>
              <div className="banner-text">
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <div
                id="hubspot-banner-form"
                ref={formRef}
                className="hubspot-form-container"
              >
                {!isHubSpotLoaded && (
                  <div className="hubspot-loading">
                    <div className="hubspot-spinner"></div>
                    <p>Loading form...</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="hubspot-success">
              <div className="success-icon">
                <svg
                  className="w-6 h-6"
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
              <h3>Welcome to Supernal!</h3>
              <p>You're now connected to the future</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPopupTrigger = () => (
    <button
      onClick={handleFormClick}
      className="popup-trigger-button"
      style={{ display: 'none' }} // Hidden trigger for programmatic use
    >
      {buttonText}
    </button>
  );

  return (
    <>
      {variant === 'banner' && renderBanner()}
      {variant === 'inline' && (
        <div className="hubspot-signup-container">
          <div className="signup-header">
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          {renderFakeForm()}
        </div>
      )}
      {variant === 'popup' && renderPopupTrigger()}

      {/* HubSpot Modal */}
      {showModal && (
        <div className="hubspot-modal-overlay" onClick={closeModal}>
          <div
            className="hubspot-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{title}</h3>
              <button
                className="modal-close"
                onClick={closeModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>{description}</p>
              <div id="hubspot-modal-form" className="hubspot-form-container">
                <div className="loading-spinner">Loading form...</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HubSpotSignup;

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
