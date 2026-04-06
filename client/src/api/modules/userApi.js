import { fetchApi, safeJson } from './fetchCore.js';

function throwApiError(data, fallback) {
  const err = new Error(data.error || fallback);
  if (data.code) err.code = data.code;
  throw err;
}

export const userApi = {
  async getAll() {
    const res = await fetchApi('/users');
    return safeJson(res, { users: [] });
  },

  async getById(userId) {
    const res = await fetchApi(`/users/${userId}`);
    return safeJson(res, { user: null });
  },

  async create(userData) {
    const res = await fetchApi('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      throwApiError(await safeJson(res, { error: 'Failed to create user' }), 'Failed to create user');
    }
    return safeJson(res, { user: null });
  },

  async update(userId, updates) {
    const res = await fetchApi(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      throwApiError(await safeJson(res, { error: 'Failed to update user' }), 'Failed to update user');
    }
    return safeJson(res, { user: null });
  },

  async updateRole(userId, role) {
    const res = await fetchApi(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      throwApiError(await safeJson(res, { error: 'Failed to update role' }), 'Failed to update role');
    }
    return safeJson(res, { user: null });
  },

  async changePassword(userId, currentPassword, newPassword) {
    const res = await fetchApi(`/users/${userId}/change-password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to change password' });
      throw new Error(error.error);
    }
    return safeJson(res, { success: false });
  },

  async updateEmail(userId, email) {
    const res = await fetchApi(`/users/${userId}/email`, {
      method: 'PUT',
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to update email' });
      throw new Error(error.error);
    }
    return safeJson(res, { success: true });
  },

  async resetPassword(userId, newPassword) {
    const res = await fetchApi(`/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) {
      throwApiError(await safeJson(res, { error: 'Failed to reset password' }), 'Failed to reset password');
    }
    return safeJson(res, { success: false });
  },

  async delete(userId) {
    const res = await fetchApi(`/users/${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throwApiError(await safeJson(res, { error: 'Failed to delete user' }), 'Failed to delete user');
    }
    return safeJson(res, { success: false });
  },

  async getTheme() {
    const res = await fetchApi('/users/me/theme');
    return safeJson(res, { theme: 'light' });
  },

  async updateTheme(theme) {
    const res = await fetchApi('/users/me/theme', {
      method: 'PUT',
      body: JSON.stringify({ theme }),
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to update theme' });
      throw new Error(error.error);
    }
    return safeJson(res, { theme: 'light' });
  },

  async transferOwnership(newOwnerId) {
    const res = await fetchApi('/users/transfer-ownership', {
      method: 'POST',
      body: JSON.stringify({ newOwnerId }),
    });
    if (!res.ok) {
      throwApiError(await safeJson(res, { error: 'Failed to transfer ownership' }), 'Failed to transfer ownership');
    }
    return safeJson(res, { success: false });
  },

  // Color Schemes
  async getColorSchemes() {
    const res = await fetchApi('/users/color-schemes');
    if (!res.ok) return { colorSchemes: [] };
    return safeJson(res, { colorSchemes: [] });
  },

  async saveColorSchemes(colorSchemes) {
    const res = await fetchApi('/users/color-schemes', {
      method: 'PUT',
      body: JSON.stringify({ colorSchemes }),
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to save color schemes' });
      throw new Error(error.error);
    }
    return safeJson(res, { colorSchemes: [] });
  },

  async getPreferences() {
    const res = await fetchApi('/users/preferences');
    if (!res.ok) return {};
    return safeJson(res, {});
  },

  // ============================================
  // Account Lock/Unlock
  // ============================================

  async lockAccount(userId, reason) {
    const res = await fetchApi(`/users/${userId}/lock`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      throwApiError(await safeJson(res, { error: 'Failed to lock account' }), 'Failed to lock account');
    }
    return safeJson(res, { success: false });
  },

  async unlockAccount(userId, temporaryHours = null) {
    const res = await fetchApi(`/users/${userId}/unlock`, {
      method: 'POST',
      body: JSON.stringify({ temporaryHours }),
    });
    if (!res.ok) {
      throwApiError(await safeJson(res, { error: 'Failed to unlock account' }), 'Failed to unlock account');
    }
    return safeJson(res, { success: false });
  },

  async getSecurityInfo(userId) {
    const res = await fetchApi(`/users/${userId}/security`);
    if (!res.ok) return null;
    return safeJson(res, null);
  },

  // ============================================
  // MFA Bypass
  // ============================================

  async setMfaBypass(userId, hours, reason) {
    const res = await fetchApi(`/users/${userId}/mfa-bypass`, {
      method: 'POST',
      body: JSON.stringify({ hours, reason }),
    });
    if (!res.ok) {
      throwApiError(await safeJson(res, { error: 'Failed to set MFA bypass' }), 'Failed to set MFA bypass');
    }
    return safeJson(res, { success: false });
  },

  async clearMfaBypass(userId) {
    const res = await fetchApi(`/users/${userId}/mfa-bypass`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throwApiError(await safeJson(res, { error: 'Failed to clear MFA bypass' }), 'Failed to clear MFA bypass');
    }
    return safeJson(res, { success: false });
  },

  // ============================================
  // Dashboard Transfer
  // ============================================

  async getUserDashboards(userId) {
    const res = await fetchApi(`/users/${userId}/dashboards`);
    if (!res.ok) return { dashboards: [] };
    return safeJson(res, { dashboards: [] });
  },

  async transferDashboards(fromUserId, toUserId) {
    const res = await fetchApi(`/users/${fromUserId}/transfer-dashboards`, {
      method: 'POST',
      body: JSON.stringify({ toUserId }),
    });
    if (!res.ok) {
      throwApiError(await safeJson(res, { error: 'Failed to transfer dashboards' }), 'Failed to transfer dashboards');
    }
    return safeJson(res, { success: false, transferredCount: 0 });
  },

  // ============================================
  // Admin User Update
  // ============================================

  async adminUpdate(userId, updates) {
    const res = await fetchApi(`/users/${userId}/admin-update`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      throwApiError(await safeJson(res, { error: 'Failed to update user' }), 'Failed to update user');
    }
    return safeJson(res, { user: null });
  },

  // ============================================
  // 2FA Admin Management
  // ============================================

  async get2faStatus(userId) {
    const res = await fetchApi(`/users/${userId}/2fa-status`);
    if (!res.ok) return null;
    return safeJson(res, null);
  },

  async reset2fa(userId) {
    const res = await fetchApi(`/users/${userId}/2fa`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throwApiError(await safeJson(res, { error: 'Failed to reset MFA' }), 'Failed to reset MFA');
    }
    return safeJson(res, { success: false });
  },
};
