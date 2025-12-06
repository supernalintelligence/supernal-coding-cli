/**
 * Jira Authentication Module
 *
 * Handles Jira API token authentication and credential management.
 * Jira Cloud uses email + API token for basic auth.
 *
 * @example
 * const jira = require('./jira-auth');
 *
 * // Login with API token
 * await jira.login({ domain: 'company.atlassian.net', email: 'user@example.com', token: 'abc123' });
 *
 * // Check status
 * const status = await jira.getStatus();
 * if (status.connected) {
 *   console.log(`Connected as ${status.user.displayName}`);
 * }
 */

const { store, retrieve, remove, exists } = require('./storage/file-storage');

const SERVICE_ID = 'jira';

/**
 * Store Jira credentials
 *
 * @param {Object} credentials - Jira credentials
 * @param {string} credentials.domain - Jira domain (e.g., 'company.atlassian.net')
 * @param {string} credentials.email - User email address
 * @param {string} credentials.token - API token
 */
async function login(credentials) {
  const { domain, email, token } = credentials;

  if (!domain || !email || !token) {
    throw new Error('domain, email, and token are required');
  }

  // Validate credentials by making a test request
  const validation = await validateCredentials({ domain, email, token });

  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid credentials');
  }

  // Store credentials
  await store(
    SERVICE_ID,
    {
      type: 'api-token',
      domain: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      email,
      token,
      user: validation.user
    },
    {
      metadata: {
        connectedAt: new Date().toISOString(),
        userDisplayName: validation.user?.displayName
      }
    }
  );

  return {
    success: true,
    user: validation.user
  };
}

/**
 * Remove stored Jira credentials
 */
async function logout() {
  const result = await remove(SERVICE_ID);
  return result;
}

/**
 * Check if Jira credentials exist
 */
async function isAuthenticated() {
  return exists(SERVICE_ID);
}

/**
 * Get current authentication status
 */
async function getStatus() {
  const credentials = await retrieve(SERVICE_ID);

  if (!credentials) {
    return {
      connected: false,
      error: 'Not authenticated'
    };
  }

  // Validate current credentials
  const validation = await validateCredentials(credentials);

  if (!validation.valid) {
    return {
      connected: false,
      domain: credentials.domain,
      error: validation.error || 'Credentials invalid or expired'
    };
  }

  return {
    connected: true,
    domain: credentials.domain,
    user: validation.user
  };
}

/**
 * Get stored credentials (for API use)
 */
async function getCredentials() {
  return retrieve(SERVICE_ID);
}

/**
 * Validate Jira credentials by fetching current user
 *
 * @param {Object} credentials - Credentials to validate
 * @returns {Object} { valid: boolean, user?: Object, error?: string }
 */
async function validateCredentials(credentials) {
  const { domain, email, token } = credentials;

  // Clean domain
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${cleanDomain}/rest/api/3/myself`;

  // Create Basic auth header
  const authString = Buffer.from(`${email}:${token}`).toString('base64');

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${authString}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: 'Invalid email or API token' };
      }
      if (response.status === 403) {
        return { valid: false, error: 'Access forbidden - check permissions' };
      }
      return { valid: false, error: `Jira API error: ${response.status}` };
    }

    const user = await response.json();

    return {
      valid: true,
      user: {
        accountId: user.accountId,
        displayName: user.displayName,
        email: user.emailAddress,
        avatarUrl: user.avatarUrls?.['48x48']
      }
    };
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.cause?.code === 'ENOTFOUND') {
      return { valid: false, error: `Cannot reach domain: ${cleanDomain}` };
    }
    return { valid: false, error: error.message };
  }
}

/**
 * Make an authenticated request to Jira API
 *
 * @param {string} path - API path (e.g., '/issue/PROJ-123')
 * @param {Object} options - Fetch options
 */
async function apiRequest(path, options = {}) {
  const credentials = await getCredentials();

  if (!credentials) {
    throw new Error('Not authenticated with Jira');
  }

  const { domain, email, token } = credentials;
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${cleanDomain}/rest/api/3${path}`;

  const authString = Buffer.from(`${email}:${token}`).toString('base64');

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${authString}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Jira API error: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage =
        errorJson.errorMessages?.[0] || errorJson.message || errorMessage;
    } catch {
      // Use status
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/**
 * Make an authenticated request to Jira Agile API
 */
async function agileRequest(path, options = {}) {
  const credentials = await getCredentials();

  if (!credentials) {
    throw new Error('Not authenticated with Jira');
  }

  const { domain, email, token } = credentials;
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${cleanDomain}/rest/agile/1.0${path}`;

  const authString = Buffer.from(`${email}:${token}`).toString('base64');

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${authString}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Jira API error: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage =
        errorJson.errorMessages?.[0] || errorJson.message || errorMessage;
    } catch {
      // Use status
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

module.exports = {
  SERVICE_ID,
  login,
  logout,
  isAuthenticated,
  getStatus,
  getCredentials,
  validateCredentials,
  apiRequest,
  agileRequest
};
