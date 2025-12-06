import { useEffect, useState } from 'react';

interface SignupPopupConfig {
  // Timing triggers
  scrollPercentage?: number; // Show after user scrolls X% of page
  timeOnPage?: number; // Show after X seconds on page
  pageViews?: number; // Show after X page views in session

  // Behavior triggers
  exitIntent?: boolean; // Show when user moves mouse to leave page
  onSpecificPages?: string[]; // Only show on these pages
  excludePages?: string[]; // Never show on these pages

  // Frequency controls
  cooldownDays?: number; // Don't show again for X days after dismissal
  maxShowsPerSession?: number; // Max times to show per session

  // Content targeting
  newVisitors?: boolean; // Only show to new visitors
  returningVisitors?: boolean; // Only show to returning visitors
}

const defaultConfig: SignupPopupConfig = {
  scrollPercentage: 50,
  timeOnPage: 30, // 30 seconds as requested
  pageViews: 1,
  exitIntent: true,
  cooldownDays: 7,
  maxShowsPerSession: 1,
  onSpecificPages: [
    '/docs/',
    '/docs/getting-started',
    '/docs/cli-commands',
    '/docs/workflow',
  ],
  excludePages: [
    '/docs/contributing',
    '/docs/security',
    '/docs/privacy',
    '/docs/terms',
  ],
  newVisitors: true,
  returningVisitors: true,
};

export const useSignupPopup = (config: Partial<SignupPopupConfig> = {}) => {
  const [shouldShow, setShouldShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const finalConfig = { ...defaultConfig, ...config };

  useEffect(() => {
    // Check if we're in browser environment
    if (typeof window === 'undefined') return;

    const currentPath = window.location.pathname;
    const sessionKey = 'supernal_popup_shown_count';
    const dismissalKey = 'supernal_popup_last_dismissed';
    const visitorKey = 'supernal_popup_visitor_type';

    // Check page restrictions
    if (finalConfig.excludePages?.some((page) => currentPath.includes(page))) {
      return;
    }

    if (
      finalConfig.onSpecificPages?.length &&
      !finalConfig.onSpecificPages.some((page) => currentPath.includes(page))
    ) {
      return;
    }

    // Check cooldown period
    const lastDismissed = localStorage.getItem(dismissalKey);
    if (lastDismissed) {
      const daysSinceLastDismissal =
        (Date.now() - parseInt(lastDismissed, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastDismissal < (finalConfig.cooldownDays || 7)) {
        return;
      }
    }

    // Check session limits
    const sessionShownCount = parseInt(
      sessionStorage.getItem(sessionKey) || '0',
      10
    );
    if (sessionShownCount >= (finalConfig.maxShowsPerSession || 1)) {
      return;
    }

    // Check visitor type
    const isNewVisitor = !localStorage.getItem(visitorKey);
    if (!finalConfig.newVisitors && isNewVisitor) return;
    if (!finalConfig.returningVisitors && !isNewVisitor) return;

    // Mark visitor type
    if (isNewVisitor) {
      localStorage.setItem(visitorKey, 'returning');
    }

    let triggered = false;

    // Time-based trigger
    if (finalConfig.timeOnPage) {
      setTimeout(() => {
        if (!triggered) {
          triggered = true;
          setShouldShow(true);
        }
      }, finalConfig.timeOnPage * 1000);
    }

    // Scroll-based trigger
    if (finalConfig.scrollPercentage) {
      const handleScroll = () => {
        const scrolled =
          (window.scrollY /
            (document.documentElement.scrollHeight - window.innerHeight)) *
          100;
        if (scrolled >= finalConfig.scrollPercentage! && !triggered) {
          triggered = true;
          setShouldShow(true);
          window.removeEventListener('scroll', handleScroll);
        }
      };
      window.addEventListener('scroll', handleScroll);

      return () => window.removeEventListener('scroll', handleScroll);
    }

    // Exit intent trigger
    if (finalConfig.exitIntent) {
      const handleMouseLeave = (e: MouseEvent) => {
        if (e.clientY <= 0 && !triggered) {
          triggered = true;
          setShouldShow(true);
        }
      };
      document.addEventListener('mouseleave', handleMouseLeave);

      return () => document.removeEventListener('mouseleave', handleMouseLeave);
    }

    // Page views trigger
    if (finalConfig.pageViews) {
      const pageViewCount =
        parseInt(sessionStorage.getItem('supernal_page_views') || '0', 10) + 1;
      sessionStorage.setItem('supernal_page_views', pageViewCount.toString());

      if (pageViewCount >= finalConfig.pageViews && !triggered) {
        triggered = true;
        setShouldShow(true);
      }
    }
  }, [finalConfig]);

  useEffect(() => {
    if (shouldShow) {
      // Small delay for better UX
      setTimeout(() => setIsVisible(true), 500);
    }
  }, [shouldShow]);

  const showPopup = () => {
    setIsVisible(true);

    // Track analytics
    if (window.gtag) {
      window.gtag('event', 'popup_shown', {
        event_category: 'engagement',
        event_label: 'signup_popup',
      });
    }

    // Update session counter
    const sessionKey = 'supernal_popup_shown_count';
    const currentCount = parseInt(
      sessionStorage.getItem(sessionKey) || '0',
      10
    );
    sessionStorage.setItem(sessionKey, (currentCount + 1).toString());
  };

  const hidePopup = () => {
    setIsVisible(false);
    setShouldShow(false);

    // Track analytics
    if (window.gtag) {
      window.gtag('event', 'popup_closed', {
        event_category: 'engagement',
        event_label: 'signup_popup',
      });
    }

    // Set cooldown
    localStorage.setItem(
      'supernal_popup_last_dismissed',
      Date.now().toString()
    );
  };

  const handleSignupSuccess = (_data: any) => {
    setIsVisible(false);
    setShouldShow(false);

    // Track successful signup
    if (window.gtag) {
      window.gtag('event', 'signup_success', {
        event_category: 'conversion',
        event_label: 'popup_signup',
        value: 10, // Assign value to conversion
      });
    }

    // Long cooldown for successful signups
    localStorage.setItem(
      'supernal_popup_last_dismissed',
      Date.now().toString()
    );
    localStorage.setItem('supernal_popup_signup_completed', 'true');
  };

  return {
    shouldShow: shouldShow && isVisible,
    showPopup,
    hidePopup,
    handleSignupSuccess,
  };
};

export default useSignupPopup;
