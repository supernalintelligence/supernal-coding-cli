import Layout from '@theme/Layout';
import { useEffect, useState } from 'react';

export default function Dashboard(): JSX.Element {
  const [dashboardUrl, setDashboardUrl] = useState('');
  const [isEmbedded, setIsEmbedded] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Check if embedded dashboard is enabled
  useEffect(() => {
    // Check if embedding is disabled via environment (browser-safe)
    const embedDisabled =
      typeof window !== 'undefined' &&
      window.location.search.includes('disable-embedded=true');

    if (embedDisabled) {
      setIsEmbedded(false);
      setIsLoading(false);
      return;
    }

    if (typeof window !== 'undefined') {
      const isLocalDevelopment =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      if (isLocalDevelopment) {
        // Try to detect the dashboard port by checking common ports
        const tryPorts = [3002, 3006];
        let foundPort = false;

        const checkPort = async (port: number): Promise<boolean> => {
          try {
            const response = await fetch(`http://localhost:${port}/`, {
              method: 'GET',
              timeout: 2000
            } as any);

            if (response.ok) {
              const text = await response.text();
              console.log(
                `Port ${port} response starts with:`,
                text.substring(0, 100)
              );

              // Must be HTML and contain dashboard content
              const isHTML = text.includes('<html>');
              const hasDashboard = text.includes(
                'Supernal Coding - Progress Dashboard'
              );
              const notDocusaurus =
                !text.includes('docusaurus') && !text.includes('plugin-pages');
              const notAPI = !text.startsWith('{');

              const result = isHTML && hasDashboard && notDocusaurus && notAPI;
              console.log(
                `Port ${port} check: HTML=${isHTML}, Dashboard=${hasDashboard}, NotDocs=${notDocusaurus}, NotAPI=${notAPI}, Result=${result}`
              );

              return result;
            }
            return false;
          } catch (error) {
            console.log(`Port ${port} failed:`, error);
            return false;
          }
        };

        const findDashboardPort = async () => {
          for (const port of tryPorts) {
            if (await checkPort(port)) {
              setDashboardUrl(`http://localhost:${port}`);
              foundPort = true;
              break;
            }
          }

          if (!foundPort) {
            // Fallback to the actual dashboard port
            setDashboardUrl('http://localhost:3002');
          }
          setIsLoading(false);
        };

        findDashboardPort();
      } else {
        // In production (Vercel), the dashboard HTML is served at /dashboard
        setDashboardUrl('/dashboard-app');
        setIsLoading(false);
      }
    }
  }, []);

  if (!isEmbedded) {
    return (
      <Layout
        title="Dashboard Disabled"
        description="Embedded dashboard is disabled"
      >
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            maxWidth: '600px',
            margin: '0 auto'
          }}
        >
          <h1>📊 Dashboard Access</h1>
          <p>The embedded dashboard is disabled for this deployment.</p>

          <div
            style={{
              background: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              padding: '1.5rem',
              margin: '2rem 0'
            }}
          >
            <h3>Alternative Access Methods:</h3>
            <ul style={{ textAlign: 'left', display: 'inline-block' }}>
              <li>
                <strong>Local Development:</strong> Run{' '}
                <code>sc dashboard serve</code>
              </li>
              <li>
                <strong>Standalone Dashboard:</strong> Visit the dashboard
                service directly
              </li>
              <li>
                <strong>API Access:</strong> Use the REST API endpoints for data
              </li>
            </ul>
          </div>

          <div
            style={{
              fontSize: '0.9rem',
              color: '#6c757d',
              marginTop: '2rem'
            }}
          >
            <p>
              To disable embedded dashboard, add{' '}
              <code>?disable-embedded=true</code> to the URL
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Live Project Dashboard"
      description="Real-time project analytics and requirements tracking"
    >
      <div
        style={{
          width: '100%',
          height: 'calc(100vh - 60px)', // Full viewport height minus navbar
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#fff'
        }}
      >
        {isLoading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              backgroundColor: '#f5f5f5'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #f3f3f3',
                  borderTop: '4px solid #3498db',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px auto'
                }}
              ></div>
              <p style={{ color: '#666', margin: 0 }}>Loading dashboard...</p>
            </div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : (
          <iframe
            src={dashboardUrl}
            title="Supernal Coding Dashboard"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block'
            }}
            allow="fullscreen"
            onLoad={() => console.log('Dashboard loaded successfully')}
            onError={() => setError('Failed to load dashboard')}
          />
        )}

        {/* Status indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            zIndex: 1000
          }}
        >
          {error ? (
            <span style={{ color: '#ff6b6b' }}>❌ {error}</span>
          ) : (
            <span>
              📊 Dashboard Service: Port{' '}
              {dashboardUrl.startsWith('http')
                ? new URL(dashboardUrl).port
                : 'Unknown'}
            </span>
          )}
        </div>

        {/* Fallback message */}
        {error && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              textAlign: 'center',
              maxWidth: '400px'
            }}
          >
            <h3>Dashboard Unavailable</h3>
            <p>The dashboard service is not running.</p>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Run <code>sc dashboard serve</code> to start the dashboard
              service.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
