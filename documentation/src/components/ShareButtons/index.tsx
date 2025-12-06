import { useEffect, useState } from 'react';
import { markdownToLinkedIn } from 'supernal-linkedin-formatter';
import styles from './styles.module.css';

interface ShareButtonsProps {
  title: string;
  description?: string;
  url?: string;
  shareBlurbs?: {
    twitter?: string;
    facebook?: string;
    linkedin?: string;
  };
  floating?: boolean;
}

export default function ShareButtons({
  title,
  description = '',
  url,
  shareBlurbs = {},
  floating = false
}: ShareButtonsProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(!floating);
  const [isExpanded, setIsExpanded] = useState(false);

  // Use provided URL or fallback to window location
  const shareUrl =
    url || (typeof window !== 'undefined' ? window.location.href : '');

  // Show floating button after scrolling down
  useEffect(() => {
    if (!floating) return;

    const handleScroll = () => {
      const scrolled = window.scrollY > 300;
      setIsVisible(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [floating]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const getTwitterUrl = () => {
    const text = shareBlurbs.twitter || `${title}\n\n${shareUrl}`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  };

  const getFacebookUrl = () => {
    const quote = shareBlurbs.facebook || description;
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(quote)}`;
  };

  const getLinkedInUrl = () => {
    // Use supernal-linkedin-formatter to convert markdown to LinkedIn-friendly Unicode
    let text = markdownToLinkedIn(title);
    if (shareBlurbs.linkedin) {
      text = markdownToLinkedIn(shareBlurbs.linkedin);
    } else if (description) {
      text += `\n\n${markdownToLinkedIn(description)}`;
    }
    text += `\n\n${shareUrl}`;
    return `https://www.linkedin.com/feed/?shareActive&mini=true&text=${encodeURIComponent(text)}`;
  };

  if (floating) {
    return (
      <div
        className={`${styles.floatingShare} ${isVisible ? styles.visible : ''} ${isExpanded ? styles.expanded : ''}`}
      >
        <button
          className={styles.floatingToggle}
          onClick={() => setIsExpanded(!isExpanded)}
          title="Share this post"
          aria-label="Toggle share options"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={styles.shareIcon}
          >
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
          </svg>
        </button>

        <div className={styles.floatingButtons}>
          <button
            onClick={handleCopyLink}
            className={`${styles.floatingButton} ${styles.copyLink}`}
            title="Copy link"
          >
            {copied ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M4.715 6.542L3.343 7.914a3 3 0 104.243 4.243l1.828-1.829A3 3 0 008.586 5.5L8 6.086a1.001 1.001 0 00-.154.199 2 2 0 01.861 3.337L6.88 11.45a2 2 0 11-2.83-2.83l.793-.792a4.018 4.018 0 01-.128-1.287z" />
                <path d="M6.586 4.672A3 3 0 007.414 9.5l.775-.776a2 2 0 01-.896-3.346L9.12 3.55a2 2 0 112.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 00-4.243-4.243L6.586 4.672z" />
              </svg>
            )}
          </button>

          <a
            href={getTwitterUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.floatingButton} ${styles.twitter}`}
            title="Share on Twitter"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>

          <a
            href={getFacebookUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.floatingButton} ${styles.facebook}`}
            title="Share on Facebook"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </a>

          <a
            href={getLinkedInUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.floatingButton} ${styles.linkedin}`}
            title="Share on LinkedIn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>
        </div>
      </div>
    );
  }

  // Original inline share buttons
  return (
    <div className={styles.shareButtons}>
      <div className={styles.shareTitle}>Share this post:</div>
      <div className={styles.buttonGroup}>
        <button
          onClick={handleCopyLink}
          className={`${styles.shareButton} ${styles.copyLink}`}
          title="Copy link"
        >
          {copied ? (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M4.715 6.542L3.343 7.914a3 3 0 104.243 4.243l1.828-1.829A3 3 0 008.586 5.5L8 6.086a1.001 1.001 0 00-.154.199 2 2 0 01.861 3.337L6.88 11.45a2 2 0 11-2.83-2.83l.793-.792a4.018 4.018 0 01-.128-1.287z" />
                <path d="M6.586 4.672A3 3 0 007.414 9.5l.775-.776a2 2 0 01-.896-3.346L9.12 3.55a2 2 0 112.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 00-4.243-4.243L6.586 4.672z" />
              </svg>
              <span>Copy Link</span>
            </>
          )}
        </button>

        <a
          href={getTwitterUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.shareButton} ${styles.twitter}`}
          title="Share on Twitter"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span>Twitter</span>
        </a>

        <a
          href={getFacebookUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.shareButton} ${styles.facebook}`}
          title="Share on Facebook"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>Facebook</span>
        </a>

        <a
          href={getLinkedInUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.shareButton} ${styles.linkedin}`}
          title="Share on LinkedIn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          <span>LinkedIn</span>
        </a>
      </div>
    </div>
  );
}
