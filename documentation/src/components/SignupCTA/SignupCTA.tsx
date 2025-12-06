import type React from 'react';
import useSignupPopup from '../../hooks/useSignupPopup';
import HubSpotSignup from '../HubSpotSignup/HubSpotSignup';
import './SignupCTA.css';

interface SignupCTAProps {
  variant?: 'inline' | 'banner' | 'popup';
  title?: string;
  description?: string;
  buttonText?: string;
  showOnPages?: string[];
  className?: string;
}

const SignupCTA: React.FC<SignupCTAProps> = ({
  variant = 'inline',
  title = 'Stay Updated with Supernal Coding',
  description = 'Get early access to new features, enterprise offerings, and exclusive development insights.',
  buttonText = 'Get Early Access',
  showOnPages = ['/docs/getting-started', '/docs/cli-commands'],
  className = ''
}) => {
  const { shouldShow, hidePopup, handleSignupSuccess } = useSignupPopup({
    onSpecificPages: showOnPages,
    scrollPercentage: 60,
    timeOnPage: 20,
    maxShowsPerSession: 1,
    cooldownDays: 3
  });

  // Don't show if user has already signed up
  if (
    typeof window !== 'undefined' &&
    localStorage.getItem('supernal_popup_signup_completed')
  ) {
    return null;
  }

  if (variant === 'popup') {
    return shouldShow ? (
      <HubSpotSignup
        isPopup={true}
        title={title}
        description={description}
        onClose={hidePopup}
        onSubmit={handleSignupSuccess}
        buttonText="Get Early Access"
      />
    ) : null;
  }

  if (variant === 'banner') {
    return (
      <div className={`signup-banner ${className}`}>
        <HubSpotSignup
          variant="banner"
          title={title}
          description={description}
          buttonText="Get Updates"
          onSubmit={handleSignupSuccess}
        />
      </div>
    );
  }

  // Default inline variant
  return (
    <div className={`signup-cta-inline ${className}`}>
      <HubSpotSignup
        variant="inline"
        title={title}
        description={description}
        onSubmit={handleSignupSuccess}
        buttonText={buttonText || 'Get Early Access'}
      />
    </div>
  );
};

export default SignupCTA;
