var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.hasOwn(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.useSignupPopup = void 0;
var react_1 = require('react');
var defaultConfig = {
  scrollPercentage: 70,
  timeOnPage: 30, // 30 seconds
  pageViews: 2,
  exitIntent: true,
  cooldownDays: 7,
  maxShowsPerSession: 1,
  onSpecificPages: ['/docs/', '/docs/getting-started', '/docs/cli-commands'],
  excludePages: ['/docs/contributing', '/docs/security'],
  newVisitors: true,
  returningVisitors: true,
};
var useSignupPopup = (config) => {
  if (config === void 0) {
    config = {};
  }
  var _a = (0, react_1.useState)(false),
    shouldShow = _a[0],
    setShouldShow = _a[1];
  var _b = (0, react_1.useState)(false),
    isVisible = _b[0],
    setIsVisible = _b[1];
  var finalConfig = __assign(__assign({}, defaultConfig), config);
  (0, react_1.useEffect)(() => {
    var _a, _b;
    // Check if we're in browser environment
    if (typeof window === 'undefined') return;
    var currentPath = window.location.pathname;
    var sessionKey = 'supernal_popup_shown_count';
    var dismissalKey = 'supernal_popup_last_dismissed';
    var visitorKey = 'supernal_popup_visitor_type';
    // Check page restrictions
    if (
      (_a = finalConfig.excludePages) === null || _a === void 0
        ? void 0
        : _a.some((page) => currentPath.includes(page))
    ) {
      return;
    }
    if (
      ((_b = finalConfig.onSpecificPages) === null || _b === void 0
        ? void 0
        : _b.length) &&
      !finalConfig.onSpecificPages.some((page) => currentPath.includes(page))
    ) {
      return;
    }
    // Check cooldown period
    var lastDismissed = localStorage.getItem(dismissalKey);
    if (lastDismissed) {
      var daysSinceLastDismissal =
        (Date.now() - parseInt(lastDismissed, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastDismissal < (finalConfig.cooldownDays || 7)) {
        return;
      }
    }
    // Check session limits
    var sessionShownCount = parseInt(
      sessionStorage.getItem(sessionKey) || '0',
      10
    );
    if (sessionShownCount >= (finalConfig.maxShowsPerSession || 1)) {
      return;
    }
    // Check visitor type
    var isNewVisitor = !localStorage.getItem(visitorKey);
    if (!finalConfig.newVisitors && isNewVisitor) return;
    if (!finalConfig.returningVisitors && !isNewVisitor) return;
    // Mark visitor type
    if (isNewVisitor) {
      localStorage.setItem(visitorKey, 'returning');
    }
    var triggered = false;
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
      var handleScroll_1 = () => {
        var scrolled =
          (window.scrollY /
            (document.documentElement.scrollHeight - window.innerHeight)) *
          100;
        if (scrolled >= finalConfig.scrollPercentage && !triggered) {
          triggered = true;
          setShouldShow(true);
          window.removeEventListener('scroll', handleScroll_1);
        }
      };
      window.addEventListener('scroll', handleScroll_1);
      return () => window.removeEventListener('scroll', handleScroll_1);
    }
    // Exit intent trigger
    if (finalConfig.exitIntent) {
      var handleMouseLeave_1 = (e) => {
        if (e.clientY <= 0 && !triggered) {
          triggered = true;
          setShouldShow(true);
        }
      };
      document.addEventListener('mouseleave', handleMouseLeave_1);
      return () =>
        document.removeEventListener('mouseleave', handleMouseLeave_1);
    }
    // Page views trigger
    if (finalConfig.pageViews) {
      var pageViewCount =
        parseInt(sessionStorage.getItem('supernal_page_views') || '0', 10) + 1;
      sessionStorage.setItem('supernal_page_views', pageViewCount.toString());
      if (pageViewCount >= finalConfig.pageViews && !triggered) {
        triggered = true;
        setShouldShow(true);
      }
    }
  }, [finalConfig]);
  (0, react_1.useEffect)(() => {
    if (shouldShow) {
      // Small delay for better UX
      setTimeout(() => setIsVisible(true), 500);
    }
  }, [shouldShow]);
  var showPopup = () => {
    setIsVisible(true);
    // Track analytics
    if (window.gtag) {
      window.gtag('event', 'popup_shown', {
        event_category: 'engagement',
        event_label: 'signup_popup',
      });
    }
    // Update session counter
    var sessionKey = 'supernal_popup_shown_count';
    var currentCount = parseInt(sessionStorage.getItem(sessionKey) || '0', 10);
    sessionStorage.setItem(sessionKey, (currentCount + 1).toString());
  };
  var hidePopup = () => {
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
  var handleSignupSuccess = (_data) => {
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
    showPopup: showPopup,
    hidePopup: hidePopup,
    handleSignupSuccess: handleSignupSuccess,
  };
};
exports.useSignupPopup = useSignupPopup;
exports.default = exports.useSignupPopup;
