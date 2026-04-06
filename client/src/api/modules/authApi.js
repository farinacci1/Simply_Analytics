import { API_BASE, fetchApi, safeJson, setAuthToken } from './fetchCore.js';
import { stopSessionMonitoring } from './sessionManager.js';

export const authApi = {
  // App user login (PostgreSQL)
  // Note: Login doesn't use fetchApi to avoid sending stale auth tokens
  async login(username, password, forceLogin = false) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, forceLogin }),
    });

    const data = await safeJson(res, { success: false, error: 'Login failed' });

    // Handle login-specific errors (401 means invalid credentials, not session expired)
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    if (data.token) {
      setAuthToken(data.token, data.expiresIn);
    }
    return data;
  },

  async emergencyLogin(masterKey) {
    const res = await fetch(`${API_BASE}/auth/emergency-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterKey }),
    });

    const data = await safeJson(res, { success: false, error: 'Emergency login failed' });
    if (!res.ok) {
      throw new Error(data.error || 'Emergency login failed');
    }
    if (data.token) {
      setAuthToken(data.token, data.expiresIn);
    }
    return data;
  },

  async loginWithKeyPair(account, username, privateKey, passphrase) {
    const res = await fetchApi('/auth/keypair', {
      method: 'POST',
      body: JSON.stringify({ account, username, privateKey, passphrase }),
    });
    const data = await safeJson(res, { success: false, error: 'Login failed' });
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  async loginWithPAT(account, username, token) {
    const res = await fetchApi('/auth/pat', {
      method: 'POST',
      body: JSON.stringify({ account, username, token }),
    });
    const data = await safeJson(res, { success: false, error: 'Login failed' });
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  async validate() {
    const res = await fetchApi('/auth/validate');
    if (!res.ok) return { valid: false };
    return safeJson(res, { valid: false });
  },

  async getRoles() {
    const res = await fetchApi('/auth/roles');
    if (!res.ok) return { roles: [] };
    return safeJson(res, { roles: [] });
  },

  async switchRole(role) {
    const res = await fetchApi('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    if (!res.ok) return { success: false };
    return safeJson(res, { success: false });
  },

  async heartbeat() {
    const res = await fetchApi('/auth/heartbeat', {
      method: 'POST',
    });
    if (!res.ok) return { alive: false };
    return safeJson(res, { alive: true });
  },

  async refresh() {
    const res = await fetchApi('/auth/refresh', {
      method: 'POST',
    });
    const data = await safeJson(res, { success: false });
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  async logout() {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null);
      stopSessionMonitoring();
    }
  },

  async testConnection() {
    const res = await fetchApi('/auth/test-connection', {
      method: 'POST',
    });
    if (!res.ok) {
      const data = await safeJson(res, { success: false, error: 'Connection test failed' });
      throw new Error(data.error || 'Connection test failed');
    }
    return safeJson(res, { success: true });
  },

  async dbStatus() {
    const res = await fetchApi('/auth/db-status');
    if (!res.ok) throw new Error('Failed to check database status');
    return safeJson(res, { dbReachable: false, userCount: 0 });
  },

  async emergencyCreateOwner(data) {
    const res = await fetchApi('/auth/emergency-create-owner', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await safeJson(res, { success: false, error: 'Failed to create owner' });
    if (!res.ok) throw new Error(result.error || 'Failed to create owner');
    return result;
  },

  async getPasswordPolicy() {
    const res = await fetch(`${API_BASE}/password-policy`);
    return res.json();
  },

  async updateCredentials({ type, token, privateKey, passphrase }) {
    const res = await fetchApi('/auth/update-credentials', {
      method: 'POST',
      body: JSON.stringify({ type, token, privateKey, passphrase }),
    });
    if (!res.ok) {
      const data = await safeJson(res, { success: false, error: 'Failed to update credentials' });
      throw new Error(data.error || 'Failed to update credentials');
    }
    const data = await safeJson(res, { success: false });
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },
};
