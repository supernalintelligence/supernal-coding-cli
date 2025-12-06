// COMPLIANCE-TAG: GDPR, CCPA, ePrivacy, CAN-SPAM
// Comprehensive HubSpot integration with auto-popup and navbar button
import type React from 'react';
import { useEffect, useState } from 'react';
import { useSignupPopup } from '../../hooks/useSignupPopup';
import HubSpotModal from '../HubSpotModal/HubSpotModal';
import './HubSpotIntegration.css';

interface HubSpotIntegrationProps {
  enableAutoPopup?: boolean;
  enableNavbarButton?: boolean;
  navbarButtonText?: string;
}

const HubSpotIntegration: React.FC<HubSpotIntegrationProps> = ({
  enableAutoPopup = true,
  enableNavbarButton = true,
  navbarButtonText = 'Get Early Access'
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasSignedUp, setHasSignedUp] = useState(false);

  // Use the signup popup hook for auto-popup functionality
  const { shouldShow, hidePopup, handleSignupSuccess } = useSignupPopup({
    timeOnPage: 30, // 30 seconds as requested
    scrollPercentage: 50,
    pageViews: 1,
    cooldownDays: 7,
    maxShowsPerSession: 1
  });

  // Check if user has already signed up
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const signupCompleted = localStorage.getItem(
        'supernal_popup_signup_completed'
      );
      setHasSignedUp(!!signupCompleted);
    }
  }, []);

  // Auto-open modal when popup should show (and auto-popup is enabled)
  useEffect(() => {
    if (enableAutoPopup && shouldShow && !hasSignedUp && !isModalOpen) {
      setIsModalOpen(true);
    }
  }, [enableAutoPopup, shouldShow, hasSignedUp, isModalOpen]);

  const handleOpenModal = () => {
    setIsModalOpen(true);

    // Track manual button click
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'signup_modal_opened', {
        event_category: 'engagement',
        event_label: 'navbar_signup_button'
      });
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);

    // If this was triggered by auto-popup, mark it as dismissed
    if (shouldShow) {
      hidePopup();
    }
  };

  const handleSignupComplete = () => {
    setHasSignedUp(true);
    handleSignupSuccess({ email: 'unknown' }); // Pass required parameter

    // Track successful signup
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'signup_success', {
        event_category: 'conversion',
        event_label: shouldShow ? 'auto_popup_signup' : 'navbar_signup',
        value: 10
      });
    }
  };

  // Add navbar button to the DOM if enabled
  useEffect(() => {
    if (!enableNavbarButton || typeof window === 'undefined') return;

    const addNavbarButton = () => {
      // Find the navbar items container
      const navbarItems = document.querySelector('.navbar__items--right');
      if (!navbarItems) return;

      // Check if button already exists
      if (document.querySelector('#hubspot-navbar-button')) return;

      // Create the button
      const button = document.createElement('button');
      button.id = 'hubspot-navbar-button';
      button.className = 'hubspot-navbar-button';
      button.textContent = navbarButtonText;
      button.onclick = handleOpenModal;

      // Insert before the GitHub link
      const githubLink = navbarItems.querySelector('a[href*="github"]');
      if (githubLink) {
        navbarItems.insertBefore(button, githubLink);
      } else {
        navbarItems.appendChild(button);
      }
    };

    // Try to add button immediately
    addNavbarButton();

    // Also try after a short delay in case navbar isn't ready
    const timeout = setTimeout(addNavbarButton, 1000);

    // Cleanup
    return () => {
      clearTimeout(timeout);
      const button = document.querySelector('#hubspot-navbar-button');
      if (button) {
        button.remove();
      }
    };
  }, [enableNavbarButton, navbarButtonText, handleOpenModal]);

  return (
    <HubSpotModal
      isOpen={isModalOpen}
      onClose={handleCloseModal}
      onSignupComplete={handleSignupComplete}
    />
  );
};

export default HubSpotIntegration;
