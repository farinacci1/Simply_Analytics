import { API_BASE, fetchApi, safeJson, setAuthToken } from './fetchCore.js';

export const twoFactorApi = {
  // Get current user's 2FA status
  async getStatus() {
    const res = await fetchApi('/2fa/status');
    if (!res.ok) throw new Error('Failed to get MFA status');
    return safeJson(res, {});
  },

  // TOTP Setup
  async setupTotp() {
    const res = await fetchApi('/2fa/totp/setup', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to set up TOTP');
    return safeJson(res, {});
  },

  async verifyTotp(code) {
    const res = await fetchApi('/2fa/totp/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    const data = await safeJson(res, { success: false });
    if (!res.ok) throw new Error(data.error || 'Failed to verify TOTP');
    return data;
  },

  async disableTotp(password) {
    const res = await fetchApi('/2fa/totp', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
    const data = await safeJson(res, { success: false });
    if (!res.ok) throw new Error(data.error || 'Failed to disable TOTP');
    return data;
  },

  // Passkey Setup
  async getPasskeyRegistrationOptions() {
    const res = await fetchApi('/2fa/passkey/register-options', { method: 'POST' });
    const data = await safeJson(res, {});
    if (!res.ok) throw new Error(data.error || 'Failed to get passkey options');
    return data;
  },

  async verifyPasskeyRegistration(response, name) {
    const res = await fetchApi('/2fa/passkey/register-verify', {
      method: 'POST',
      body: JSON.stringify({ response, name }),
    });
    const data = await safeJson(res, { success: false });
    if (!res.ok) throw new Error(data.error || 'Failed to register passkey');
    return data;
  },

  async getPasskeys() {
    const res = await fetchApi('/2fa/passkeys');
    if (!res.ok) throw new Error('Failed to get passkeys');
    return safeJson(res, { passkeys: [] });
  },

  async removePasskey(id, password) {
    const res = await fetchApi(`/2fa/passkey/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
    const data = await safeJson(res, { success: false });
    if (!res.ok) throw new Error(data.error || 'Failed to remove passkey');
    return data;
  },

  // Login 2FA Verification (used during login flow)
  async validateTotp(userId, code, pendingToken, forceLogin = false) {
    const res = await fetch(`${API_BASE}/2fa/validate/totp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code, pendingToken, forceLogin }),
    });
    const data = await safeJson(res, { success: false });
    if (!res.ok) {
      const error = new Error(data.error || 'Invalid code');
      error.code = data.code;
      throw error;
    }
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  async getPasskeyAuthOptions(userId, pendingToken) {
    const res = await fetch(`${API_BASE}/2fa/validate/passkey/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, pendingToken }),
    });
    const data = await safeJson(res, {});
    if (!res.ok) throw new Error(data.error || 'Failed to get passkey options');
    return data;
  },

  async verifyPasskeyAuth(userId, response, pendingToken, forceLogin = false) {
    const res = await fetch(`${API_BASE}/2fa/validate/passkey/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, response, pendingToken, forceLogin }),
    });
    const data = await safeJson(res, { success: false });
    if (!res.ok) {
      const error = new Error(data.error || 'Passkey verification failed');
      error.code = data.code;
      throw error;
    }
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },
};
