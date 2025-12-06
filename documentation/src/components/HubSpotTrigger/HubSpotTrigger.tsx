// COMPLIANCE-TAG: GDPR, CCPA, ePrivacy, CAN-SPAM
// Small trigger button that opens HubSpot signup modal
import type React from 'react';
import { useState } from 'react';
import HubSpotModal from '../HubSpotModal/HubSpotModal';
import './HubSpotTrigger.css';

interface HubSpotTriggerProps {
  buttonText?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const HubSpotTrigger: React.FC<HubSpotTriggerProps> = ({
  buttonText = 'Get Early Access',
  variant = 'primary',
  size = 'medium',
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);

    // Optional: Track the button click event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'signup_modal_opened', {
        event_category: 'engagement',
        event_label: 'hubspot_signup_trigger'
      });
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSignupComplete = () => {
    // Optional: Track successful signup
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'signup_success', {
        event_category: 'conversion',
        event_label: 'hubspot_signup_trigger',
        value: 10
      });
    }
  };

  return (
    <>
      <button
        className={`hubspot-trigger hubspot-trigger--${variant} hubspot-trigger--${size} ${className}`}
        onClick={handleOpenModal}
        type="button"
      >
        {buttonText}
      </button>

      <HubSpotModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSignupComplete={handleSignupComplete}
      />
    </>
  );
};

export default HubSpotTrigger;
