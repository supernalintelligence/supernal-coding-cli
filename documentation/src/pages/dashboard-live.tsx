import { useHistory } from '@docusaurus/router';
import type React from 'react';
import { useEffect, useState } from 'react';

export default function DashboardRedirect(): React.ReactElement {
  const [dashboardUrl, setDashboardUrl] = useState<string>('');
  const history = useHistory();

  useEffect(() => {
    // Determine the dashboard URL based on environment
    const isDevelopment =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    const url = isDevelopment
      ? 'http://localhost:3006'
      : 'https://www.dashboard.coding.supernal.ai';

    setDashboardUrl(url);

    // Open the dashboard in a new tab
    window.open(url, '_blank', 'noopener,noreferrer');

    // Navigate back to the home page after opening the dashboard
    setTimeout(() => {
      history.push('/');
    }, 500);
  }, [history]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <h1>Opening Dashboard...</h1>
      <p>
        If the dashboard doesn't open automatically,{' '}
        <a href={dashboardUrl || '#'} target="_blank" rel="noopener noreferrer">
          click here
        </a>
        .
      </p>
    </div>
  );
}
