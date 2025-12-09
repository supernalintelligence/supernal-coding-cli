/**
 * Google OAuth Flow Handler
 * 
 * Manages OAuth 2.0 authentication for Google APIs.
 * Supports both CLI (localhost callback) and desktop flows.
 */

const http = require('node:http');
const { URL, URLSearchParams } = require('node:url');
const open = require('open');
const fileStorage = require('./storage/file-storage');

// Google OAuth configuration
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// Default scopes for Google Workspace integration
const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
];

// Storage service name
const SERVICE_NAME = 'google';

/**
 * Get stored Google credentials
 */
async function getCredentials() {
  return fileStorage.retrieve(SERVICE_NAME);
}

/**
 * Check if user is authenticated with Google
 */
async function isAuthenticated() {
  const credentials = await getCredentials();
  if (!credentials) return false;
  
  // Check if access token is still valid
  if (credentials.expiry_date && Date.now() >= credentials.expiry_date) {
    // Try to refresh
    try {
      await refreshAccessToken();
      return true;
    } catch {
      return false;
    }
  }
  
  return !!credentials.access_token;
}

/**
 * Build the OAuth authorization URL
 */
function buildAuthUrl(options = {}) {
  const {
    clientId,
    redirectUri = 'http://localhost:3847/callback',
    scopes = DEFAULT_SCOPES,
    state
  } = options;
  
  if (!clientId) {
    throw new Error('Google OAuth client ID is required');
  }
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent' // Force consent to get refresh token
  });
  
  if (state) {
    params.set('state', state);
  }
  
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code, options = {}) {
  const {
    clientId,
    clientSecret,
    redirectUri = 'http://localhost:3847/callback'
  } = options;
  
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }).toString()
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
  }
  
  const tokens = await response.json();
  
  // Calculate expiry timestamp
  const expiryDate = Date.now() + (tokens.expires_in * 1000);
  
  // Store tokens
  await fileStorage.store(SERVICE_NAME, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: expiryDate,
    token_type: tokens.token_type,
    scope: tokens.scope
  }, {
    metadata: { 
      client_id: clientId,
      authenticated_at: new Date().toISOString()
    }
  });
  
  return {
    access_token: tokens.access_token,
    expiry_date: expiryDate
  };
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(options = {}) {
  const credentials = await getCredentials();
  if (!credentials?.refresh_token) {
    throw new Error('No refresh token available. Please re-authenticate.');
  }
  
  // Get client credentials from environment or options
  const clientId = options.clientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = options.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google client ID and secret required for token refresh');
  }
  
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: credentials.refresh_token,
      grant_type: 'refresh_token'
    }).toString()
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
  }
  
  const tokens = await response.json();
  const expiryDate = Date.now() + (tokens.expires_in * 1000);
  
  // Update stored credentials
  await fileStorage.update(SERVICE_NAME, {
    access_token: tokens.access_token,
    expiry_date: expiryDate
  });
  
  return {
    access_token: tokens.access_token,
    expiry_date: expiryDate
  };
}

/**
 * Get a valid access token (refreshes if needed)
 */
async function getAccessToken(options = {}) {
  const credentials = await getCredentials();
  if (!credentials) {
    throw new Error('Not authenticated with Google. Run: sc connect google auth login');
  }
  
  // Check if token needs refresh (with 5 minute buffer)
  const buffer = 5 * 60 * 1000;
  if (credentials.expiry_date && Date.now() >= credentials.expiry_date - buffer) {
    const refreshed = await refreshAccessToken(options);
    return refreshed.access_token;
  }
  
  return credentials.access_token;
}

/**
 * Start OAuth flow from CLI
 * Opens browser and listens for callback on localhost
 */
async function startCLIAuthFlow(options = {}) {
  const {
    clientId,
    clientSecret,
    port = 3847,
    timeout = 120000 // 2 minutes
  } = options;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google client ID and secret are required');
  }
  
  const redirectUri = `http://localhost:${port}/callback`;
  
  return new Promise((resolve, reject) => {
    let server;
    let timeoutId;
    
    // Cleanup function
    const cleanup = () => {
      clearTimeout(timeoutId);
      if (server) {
        server.close();
      }
    };
    
    // Create local server to receive callback
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #dc3545;">Authentication Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          cleanup();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }
        
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #dc3545;">Authentication Failed</h1>
                <p>No authorization code received.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          cleanup();
          reject(new Error('No authorization code received'));
          return;
        }
        
        try {
          // Exchange code for tokens
          const tokens = await exchangeCodeForTokens(code, {
            clientId,
            clientSecret,
            redirectUri
          });
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #28a745;">Authentication Successful!</h1>
                <p>You are now connected to Google Workspace.</p>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);
          
          cleanup();
          resolve(tokens);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #dc3545;">Authentication Failed</h1>
                <p>${err.message}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          cleanup();
          reject(err);
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    
    server.listen(port, () => {
      // Build and open auth URL
      const authUrl = buildAuthUrl({ clientId, redirectUri });
      console.log('Opening browser for Google authentication...');
      console.log(`If browser doesn't open, visit: ${authUrl}`);
      
      open(authUrl).catch(() => {
        console.log('Could not open browser automatically.');
        console.log(`Please visit: ${authUrl}`);
      });
    });
    
    // Set timeout
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Authentication timed out. Please try again.'));
    }, timeout);
  });
}

/**
 * Log out - remove stored credentials
 */
async function logout() {
  await fileStorage.remove(SERVICE_NAME);
  return { success: true };
}

/**
 * Get user info from Google
 */
async function getUserInfo(options = {}) {
  const accessToken = await getAccessToken(options);
  
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }
  
  return response.json();
}

module.exports = {
  getCredentials,
  isAuthenticated,
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getAccessToken,
  startCLIAuthFlow,
  logout,
  getUserInfo,
  // Constants
  DEFAULT_SCOPES,
  SERVICE_NAME
};

