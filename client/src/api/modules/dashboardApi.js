import { fetchApi, safeJson } from './fetchCore.js';

export const dashboardApi = {
  async list(params = {}) {
    const qs = new URLSearchParams();
    if (params.workspaceId) qs.set('workspaceId', params.workspaceId);
    const url = qs.toString() ? `/dashboard?${qs}` : '/dashboard';
    const res = await fetchApi(url);
    if (!res.ok) {
      const data = await safeJson(res, { error: 'Failed to load dashboards' });
      // For MFA required errors, throw to display message
      if (res.status === 403 && data.code === 'MFA_REQUIRED') {
        const error = new Error(data.error || 'Two-factor authentication is required to view dashboards');
        error.status = res.status;
        error.code = 'MFA_REQUIRED';
        throw error;
      }
      console.warn('Dashboard list failed:', res.status, data.error);
      return { dashboards: [] };
    }
    return safeJson(res, { dashboards: [] });
  },

  async get(id) {
    const res = await fetchApi(`/dashboard/${encodeURIComponent(id)}`);
    if (!res.ok) {
      const data = await safeJson(res, { error: 'Failed to load dashboard' });
      const error = new Error(data.error || (res.status === 403 ? 'You do not have access to this dashboard' : 'Dashboard not found'));
      error.status = res.status;
      // Preserve MFA_REQUIRED code from server, otherwise default based on status
      error.code = data.code || (res.status === 403 ? 'ACCESS_DENIED' : 'NOT_FOUND');
      throw error;
    }
    return safeJson(res, { dashboard: null });
  },

  /**
   * Initialize the Snowflake session for a dashboard
   * This establishes the connection with the correct warehouse and role
   */
  async initSession(id) {
    const res = await fetchApi(`/dashboard/${encodeURIComponent(id)}/init-session`, {
      method: 'POST',
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'Failed to initialize session' });
      const error = new Error(data.error || 'Failed to initialize dashboard session');
      error.status = res.status;
      error.code = data.code || 'SESSION_INIT_FAILED';
      throw error;
    }
    return safeJson(res, { success: false });
  },

  async create(dashboard) {
    const res = await fetchApi('/dashboard', {
      method: 'POST',
      body: JSON.stringify(dashboard),
    });
    const data = await safeJson(res, { success: false, error: 'Failed to parse response' });
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create dashboard');
    }
    return data;
  },

  async update(id, updates) {
    const res = await fetchApi(`/dashboard/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const data = await safeJson(res, { success: false, error: 'Failed to parse response' });
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update dashboard');
    }
    return data;
  },

  async delete(id) {
    const res = await fetchApi(`/dashboard/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await safeJson(res, { success: false, error: 'Failed to parse response' });
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete dashboard');
    }
    return data;
  },

  // Group access management
  async getGroups(id) {
    const res = await fetchApi(`/dashboard/${encodeURIComponent(id)}/groups`);
    if (!res.ok) {
      console.warn('Failed to get dashboard groups:', res.status);
      return { groups: [] };
    }
    return safeJson(res, { groups: [] });
  },

  async updateGroups(id, groupIds) {
    const res = await fetchApi(`/dashboard/${encodeURIComponent(id)}/groups`, {
      method: 'PUT',
      body: JSON.stringify({ groupIds }),
    });
    const data = await safeJson(res, { success: false, error: 'Failed to parse response' });
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update group access');
    }
    return data;
  },

  async grantGroupAccess(id, groupId) {
    const res = await fetchApi(`/dashboard/${encodeURIComponent(id)}/groups`, {
      method: 'POST',
      body: JSON.stringify({ groupId }),
    });
    const data = await safeJson(res, { success: false, error: 'Failed to parse response' });
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to grant group access');
    }
    return data;
  },

  async revokeGroupAccess(id, groupId) {
    const res = await fetchApi(`/dashboard/${encodeURIComponent(id)}/groups/${encodeURIComponent(groupId)}`, {
      method: 'DELETE',
    });
    const data = await safeJson(res, { success: false, error: 'Failed to parse response' });
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to revoke group access');
    }
    return data;
  },

  async getPermission(id) {
    const res = await fetchApi(`/dashboard/${encodeURIComponent(id)}/permission`);
    if (!res.ok) return { permission: 'view' };
    return safeJson(res, { permission: 'view' });
  },

  async exportYaml(id) {
    const res = await fetchApi(`/dashboard/${encodeURIComponent(id)}/yaml`);
    if (!res.ok) return '';
    try {
      return await res.text();
    } catch {
      return '';
    }
  },

  async importYaml(yamlContent) {
    const res = await fetchApi('/dashboard/import', {
      method: 'POST',
      body: JSON.stringify({ yaml: yamlContent }),
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'Failed to import' });
      throw new Error(data.error || 'Failed to import YAML');
    }
    return safeJson(res, { success: true });
  },
};
