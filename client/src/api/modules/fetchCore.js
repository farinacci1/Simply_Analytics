/**
 * Shared API fetch core: base URL, auth, request queue, session callbacks, fetchApi.
 */

export const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const DEBUG = import.meta.env.VITE_DEBUG === 'true';
const log = (...args) => {
  if (DEBUG) console.log(...args);
};

let sessionWarningCallback;
let sessionExpiredCallback;
let isSessionTerminated = false;
let tokenExpiresAt = null;
let tokenExpiryTimer = null;

/**
 * Check if an error is a Snowflake network policy error (IP not allowed)
 * These occur when a cached connection was established from a different IP (e.g., before VPN)
 */
export function isNetworkPolicyError(error) {
  const message = error?.message || String(error);
  return message.includes('not allowed to access Snowflake') ||
         message.includes('IP/Token') ||
         message.includes('Network policy') ||
         message.includes('network policy');
}

// ============================================================
// Request Queue - Limit concurrent requests to prevent resource exhaustion
// ============================================================
const MAX_CONCURRENT_REQUESTS = 4;
let activeRequests = 0;
const requestQueue = [];

function processQueue() {
  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
    const { resolve, reject, endpoint, options } = requestQueue.shift();
    activeRequests++;

    executeRequest(endpoint, options)
      .then(resolve)
      .catch(reject)
      .finally(() => {
        activeRequests--;
        processQueue();
      });
  }
}

async function executeRequest(endpoint, options) {
  const token = getAuthToken();

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  return response;
}

function queuedFetch(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ resolve, reject, endpoint, options });
    processQueue();
  });
}

/**
 * Get stored auth token
 * Uses sessionStorage so token is cleared when browser closes
 */
export function getAuthToken() {
  return sessionStorage.getItem('authToken');
}

/**
 * Set auth token and track expiry
 * Uses sessionStorage so token is cleared when browser closes
 */
export function setAuthToken(token, expiresIn = null) {
  if (token) {
    sessionStorage.setItem('authToken', token);

    // Track token expiry time
    if (expiresIn) {
      // Parse expiresIn (e.g., "8h", "24h", "1d")
      let expiryMs = 8 * 60 * 60 * 1000; // Default 8 hours
      if (typeof expiresIn === 'string') {
        const match = expiresIn.match(/^(\d+)(h|m|d)$/);
        if (match) {
          const value = parseInt(match[1]);
          const unit = match[2];
          if (unit === 'h') expiryMs = value * 60 * 60 * 1000;
          else if (unit === 'm') expiryMs = value * 60 * 1000;
          else if (unit === 'd') expiryMs = value * 24 * 60 * 60 * 1000;
        }
      } else if (typeof expiresIn === 'number') {
        expiryMs = expiresIn;
      }

      tokenExpiresAt = Date.now() + expiryMs;
      sessionStorage.setItem('tokenExpiresAt', tokenExpiresAt.toString());
    }
  } else {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('tokenExpiresAt');
    tokenExpiresAt = null;

    // Clear token expiry timer
    if (tokenExpiryTimer) {
      clearTimeout(tokenExpiryTimer);
      tokenExpiryTimer = null;
    }
  }
}

export function setSessionCallbacks(onWarning, onExpired) {
  sessionWarningCallback = onWarning;
  sessionExpiredCallback = onExpired;
  isSessionTerminated = false;
}

export function getIsSessionTerminated() {
  return isSessionTerminated;
}

export function setIsSessionTerminated(value) {
  isSessionTerminated = value;
}

export function clearTokenExpiryTimer() {
  if (tokenExpiryTimer) {
    clearTimeout(tokenExpiryTimer);
    tokenExpiryTimer = null;
  }
}

/** @internal Used by session monitoring */
export function debugLog(...args) {
  log(...args);
}

/**
 * Start token expiry timer
 * Automatically expires session when JWT expires
 */
export function startTokenExpiryTimer() {
  // Clear existing timer
  if (tokenExpiryTimer) {
    clearTimeout(tokenExpiryTimer);
    tokenExpiryTimer = null;
  }

  // Get expiry time from sessionStorage or calculated
  const storedExpiry = sessionStorage.getItem('tokenExpiresAt');
  if (storedExpiry) {
    tokenExpiresAt = parseInt(storedExpiry);
  }

  if (!tokenExpiresAt) {
    // Default to 8 hours from now if not set
    tokenExpiresAt = Date.now() + (8 * 60 * 60 * 1000);
  }

  const timeUntilExpiry = tokenExpiresAt - Date.now();

  if (timeUntilExpiry <= 0) {
    // Token already expired
    log('JWT token already expired');
    if (sessionExpiredCallback) {
      sessionExpiredCallback();
    }
    return;
  }

  log(`JWT token expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes`);

  // Show warning 5 minutes before expiry
  const warningTime = timeUntilExpiry - (5 * 60 * 1000);
  if (warningTime > 0) {
    tokenExpiryTimer = setTimeout(() => {
      log('JWT token expiring soon - showing warning');
      if (sessionWarningCallback) {
        sessionWarningCallback(5 * 60 * 1000); // 5 minutes remaining
      }

      // Set final expiry timer
      tokenExpiryTimer = setTimeout(() => {
        log('JWT token expired');
        if (sessionExpiredCallback) {
          sessionExpiredCallback();
        }
      }, 5 * 60 * 1000);
    }, warningTime);
  } else {
    // Less than 5 minutes remaining, just set expiry timer
    tokenExpiryTimer = setTimeout(() => {
      log('JWT token expired');
      if (sessionExpiredCallback) {
        sessionExpiredCallback();
      }
    }, timeUntilExpiry);
  }
}

/**
 * Make API request with authentication
 * Uses request queue to limit concurrent requests
 */
export async function fetchApi(endpoint, options = {}) {
  // Use queued fetch to limit concurrent requests
  const response = await queuedFetch(endpoint, options);

  if (response.status === 401) {
    // Try to get the actual error message from the response
    let errorMessage = 'Session expired';
    let isSessionInvalid = false;
    let isServerRestarted = false;
    try {
      const errorData = await response.clone().json();
      if (errorData.error) {
        errorMessage = errorData.error;

        // Check for token expiration or session revocation
        if (errorData.code === 'TOKEN_EXPIRED' || errorData.expired) {
          isSessionInvalid = true;
          errorMessage = 'Your session has expired. Please sign in again.';
          log('JWT token expired - signing out user');
        } else if (errorData.code === 'SESSION_REVOKED') {
          isSessionInvalid = true;
          errorMessage = 'You have been signed out.';
          log('Session was revoked - signing out user');
        } else if (errorData.code === 'SERVER_RESTARTED' || errorData.serverRestarted) {
          isSessionInvalid = true;
          isServerRestarted = true;
          errorMessage = 'Connection to server was lost. Please sign in again.';
          log('Server restarted - all sessions invalidated');
        }

        // Check if this is an IP/network policy error (not a session issue)
        const isNetworkPolicyErr = errorMessage.includes('not allowed to access') ||
                                   errorMessage.includes('IP/Token') ||
                                   errorMessage.includes('network policy');

        if (isNetworkPolicyErr) {
          // This is a Snowflake network policy restriction, not session expiry
          throw new Error(`Snowflake Access Denied: ${errorMessage}`);
        }
      }
    } catch (parseError) {
      // If we already threw a network policy error, re-throw it
      if (parseError.message.includes('Snowflake Access Denied')) {
        throw parseError;
      }
      // Otherwise continue with generic session expired
      isSessionInvalid = true;
    }

    // Only sign out user if this is actually a session-related 401
    // Don't sign out for 401s due to password validation, 2FA, etc.
    if (isSessionInvalid) {
      // Token expired/invalid/server restarted - clear auth state
      setAuthToken(null);
      if (sessionExpiredCallback) {
        // Pass additional context for server restart notification
        sessionExpiredCallback(isServerRestarted ? 'server_restarted' : 'expired');
      }
    }

    throw new Error(errorMessage);
  }

  return response;
}

// Helper to safely parse JSON response
export async function safeJson(res, defaultValue = null) {
  try {
    const text = await res.text();
    if (!text || text.trim() === '') {
      return defaultValue;
    }
    return JSON.parse(text);
  } catch (e) {
    console.warn('Failed to parse JSON response:', e.message);
    return defaultValue;
  }
}
