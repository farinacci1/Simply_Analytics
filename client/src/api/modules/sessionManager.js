import {
  API_BASE,
  fetchApi,
  safeJson,
  setSessionCallbacks,
  startTokenExpiryTimer,
  clearTokenExpiryTimer,
  getAuthToken,
  setAuthToken,
  getIsSessionTerminated,
  setIsSessionTerminated,
  debugLog,
} from './fetchCore.js';

const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes of inactivity before logout
const WARNING_BEFORE_TIMEOUT = 2 * 60 * 1000; // Show warning 2 minutes before logout
const HEARTBEAT_INTERVAL = 60 * 1000; // Send heartbeat every 60 seconds to keep Snowflake alive

let inactivityTimer = null;
let warningTimer = null;
let heartbeatTimer = null;
let lastActivityTime = Date.now();

/** Mirrors fetchCore session callbacks for timers created outside token/JWT flows */
let activeSessionWarning = null;
let activeSessionExpired = null;

export function throttle(func, limit) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      func.apply(this, args);
    }
  };
}

export function isTerminatedError(message) {
  if (!message) return false;
  const lowerMsg = message.toLowerCase();
  return lowerMsg.includes('terminated') ||
         lowerMsg.includes('connection closed') ||
         lowerMsg.includes('session expired') ||
         lowerMsg.includes('not authenticated');
}

async function sendHeartbeat() {
  const res = await fetchApi('/auth/heartbeat', {
    method: 'POST',
  });
  if (!res.ok) return { alive: false };
  return safeJson(res, { alive: true });
}

/**
 * Start session monitoring
 * - Tracks user activity (mouse, keyboard, clicks)
 * - Shows warning 2 minutes before 20-minute inactivity timeout
 * - Checks elapsed time when tab becomes visible (handles browser throttling)
 */
export function startSessionMonitoring(onWarning, onExpired) {
  activeSessionWarning = onWarning;
  activeSessionExpired = onExpired;
  setSessionCallbacks(onWarning, onExpired);
  lastActivityTime = Date.now();

  // Start tracking activity
  resetActivityTimer();

  // Start heartbeat to keep session alive
  startHeartbeat();

  // Start JWT token expiry timer
  startTokenExpiryTimer();

  // Track user activity - debounced to avoid excessive calls
  const throttledReset = throttle(resetActivityTimer, 5000);
  document.addEventListener('mousemove', throttledReset);
  document.addEventListener('keypress', throttledReset);
  document.addEventListener('click', throttledReset);
  document.addEventListener('scroll', throttledReset);
  document.addEventListener('touchstart', throttledReset);

  // Handle visibility change - check actual elapsed time when user returns
  // This handles browser timer throttling when tab is in background
  // Also validates session is still active (not revoked by force login elsewhere)
  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      // First check if JWT token has expired locally
      const storedExpiry = sessionStorage.getItem('tokenExpiresAt');
      if (storedExpiry) {
        const expiryTime = parseInt(storedExpiry);
        if (Date.now() >= expiryTime) {
          debugLog('JWT token expired while tab was backgrounded');
          if (activeSessionExpired) {
            activeSessionExpired();
          }
          return;
        }
      }

      // Validate session is still active on server (catches force-login from other tabs)
      // This runs in background and doesn't block UI
      const token = sessionStorage.getItem('authToken');
      if (token && !getIsSessionTerminated()) {
        try {
          const res = await fetch(`${API_BASE}/auth/validate`, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            // Session was revoked (force login from another tab/device)
            if (data.code === 'SESSION_REVOKED' || data.code === 'SERVER_RESTARTED' || res.status === 401) {
              debugLog('Session was revoked while tab was backgrounded');
              setAuthToken(null);
              if (activeSessionExpired) {
                activeSessionExpired(data.code === 'SERVER_RESTARTED' ? 'server_restarted' : 'revoked');
              }
              return;
            }
          }
        } catch (err) {
          // Network error - don't sign out, just log
          console.warn('Could not validate session on visibility change:', err.message);
        }
      }

      // Check inactivity timeout
      const elapsed = Date.now() - lastActivityTime;

      if (elapsed >= INACTIVITY_TIMEOUT) {
        // Session expired while away
        debugLog('Session expired during inactivity (tab was backgrounded)');
        if (activeSessionExpired) {
          activeSessionExpired();
        }
      } else if (elapsed >= INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT) {
        // Should show warning
        const remaining = INACTIVITY_TIMEOUT - elapsed;
        if (activeSessionWarning) {
          activeSessionWarning(remaining);
        }
        // Set final expiry timer
        if (warningTimer) clearTimeout(warningTimer);
        warningTimer = setTimeout(() => {
          if (activeSessionExpired) {
            activeSessionExpired();
          }
        }, remaining);
      }
      // If still within timeout, resetActivityTimer will be called by user interaction
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Store handlers for cleanup
  window._sessionActivityHandler = throttledReset;
  window._sessionVisibilityHandler = handleVisibilityChange;
}

/**
 * Stop session monitoring
 */
export function stopSessionMonitoring() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  if (warningTimer) {
    clearTimeout(warningTimer);
    warningTimer = null;
  }

  // Stop heartbeat
  stopHeartbeat();

  // Stop token expiry timer
  clearTokenExpiryTimer();

  const handler = window._sessionActivityHandler;
  if (handler) {
    document.removeEventListener('mousemove', handler);
    document.removeEventListener('keypress', handler);
    document.removeEventListener('click', handler);
    document.removeEventListener('scroll', handler);
    document.removeEventListener('touchstart', handler);
    window._sessionActivityHandler = null;
  }

  // Remove visibility change handler
  const visibilityHandler = window._sessionVisibilityHandler;
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    window._sessionVisibilityHandler = null;
  }
}

/**
 * Reset activity timer - called on user activity
 * After 18 minutes of inactivity: show warning
 * After 20 minutes of inactivity: expire session
 */
export function resetActivityTimer() {
  lastActivityTime = Date.now();

  // Clear existing timers
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  if (warningTimer) {
    clearTimeout(warningTimer);
    warningTimer = null;
  }

  // Set warning timer (18 minutes = 20 min - 2 min warning)
  const warningDelay = INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT;

  inactivityTimer = setTimeout(() => {
    // Show warning with time remaining (2 minutes)
    if (activeSessionWarning) {
      activeSessionWarning(WARNING_BEFORE_TIMEOUT);
    }

    // Set final expiry timer (2 more minutes)
    warningTimer = setTimeout(() => {
      if (activeSessionExpired) {
        activeSessionExpired();
      }
    }, WARNING_BEFORE_TIMEOUT);
  }, warningDelay);
}

/**
 * Start heartbeat to keep session alive
 * Sends heartbeat every 60 seconds
 */
export function startHeartbeat() {
  // Reset terminated flag when starting new session
  setIsSessionTerminated(false);

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  // Send immediate heartbeat
  sendHeartbeat().catch(err => {
    console.warn('Initial heartbeat failed:', err.message);
    if (isTerminatedError(err.message)) {
      stopHeartbeat();
    }
  });

  // Continue sending heartbeats regularly
  heartbeatTimer = setInterval(async () => {
    // Skip if session is terminated
    if (getIsSessionTerminated()) {
      stopHeartbeat();
      return;
    }

    try {
      const result = await sendHeartbeat();
      if (!result.alive && result.sessionValid === false) {
        console.warn('Session invalidated by server');
        stopHeartbeat();
        if (activeSessionExpired) {
          activeSessionExpired();
        }
      }
    } catch (error) {
      console.warn('Heartbeat failed:', error.message);

      // Stop heartbeat on termination errors
      if (isTerminatedError(error.message)) {
        console.warn('Connection terminated, stopping heartbeat');
        stopHeartbeat();
      }
      // Don't expire on other failures - network might be temporarily down
    }
  }, HEARTBEAT_INTERVAL);
}

/**
 * Stop heartbeat explicitly
 */
export function stopHeartbeat() {
  setIsSessionTerminated(true);
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Set callback for Snowflake connection errors
 * This is useful for showing network policy errors to the user
 */
export function setSnowflakeErrorCallback(callback) {
  window._snowflakeErrorCallback = callback;
}

/**
 * Keep session alive (user clicked "Keep me signed in")
 * Resets inactivity timer and refreshes session with server
 */
export async function keepSessionAlive() {
  // Don't try if session is already terminated
  if (getIsSessionTerminated()) {
    console.warn('Cannot keep session alive - session already terminated');
    return;
  }

  resetActivityTimer();
  try {
    await sendHeartbeat();
    debugLog('Session kept alive');
  } catch (error) {
    console.error('Failed to keep session alive:', error);
    if (isTerminatedError(error.message)) {
      stopHeartbeat();
    }
  }
}

// ============================================================
// Session Persistence
// ============================================================

/**
 * Persist session to sessionStorage (cleared when browser closes)
 */
export function persistSession(user, token) {
  if (token) {
    setAuthToken(token);
  }
  if (user) {
    sessionStorage.setItem('userInfo', JSON.stringify(user));
  }
}

/**
 * Restore session from sessionStorage
 */
export function restoreSession() {
  const token = getAuthToken();
  const userInfo = sessionStorage.getItem('userInfo');

  if (token && userInfo) {
    try {
      return { token, user: JSON.parse(userInfo) };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Clear persisted session
 */
export function clearPersistedSession() {
  setAuthToken(null);
  sessionStorage.removeItem('userInfo');
  localStorage.removeItem('lastDashboardId');
}

/**
 * Persist last viewed dashboard
 */
export function persistLastDashboard(dashboardId) {
  if (dashboardId) {
    localStorage.setItem('lastDashboardId', dashboardId);
  }
}

/**
 * Get last viewed dashboard
 */
export function getLastDashboard() {
  return localStorage.getItem('lastDashboardId');
}
