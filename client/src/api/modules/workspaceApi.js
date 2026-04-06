import { fetchApi, safeJson } from './fetchCore.js';

export const workspaceApi = {
  async list() {
    const res = await fetchApi('/workspaces');
    return safeJson(res, { workspaces: [] });
  },

  async get(id) {
    const res = await fetchApi(`/workspaces/${id}`);
    return res.json();
  },

  async create(data) {
    const res = await fetchApi('/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await safeJson(res, { error: 'Failed to create workspace' });
      throw new Error(err.error);
    }
    return res.json();
  },

  async update(id, data) {
    const res = await fetchApi(`/workspaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await safeJson(res, { error: 'Failed to update workspace' });
      throw new Error(err.error);
    }
    return res.json();
  },

  async deletePreview(id) {
    const res = await fetchApi(`/workspaces/${id}/delete-preview`);
    if (!res.ok) {
      const err = await safeJson(res, { error: 'Failed to load delete preview' });
      throw new Error(err.error);
    }
    return res.json();
  },

  async delete(id) {
    const res = await fetchApi(`/workspaces/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await safeJson(res, { error: 'Failed to delete workspace' });
      throw new Error(err.error);
    }
    return res.json();
  },

  // Members
  async getMembers(id) {
    const res = await fetchApi(`/workspaces/${id}/members`);
    return safeJson(res, { members: [] });
  },

  async addMember(id, userId) {
    const res = await fetchApi(`/workspaces/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const err = await safeJson(res, { error: 'Failed to add member' });
      throw new Error(err.error);
    }
    return res.json();
  },

  async removeMember(id, userId) {
    const res = await fetchApi(`/workspaces/${id}/members/${userId}`, {
      method: 'DELETE',
    });
    return safeJson(res, { success: false });
  },

  // Connections
  async getConnections(wsId) {
    const res = await fetchApi(`/workspaces/${wsId}/connections`);
    return safeJson(res, { connections: [] });
  },

  async addConnection(wsId, data) {
    const res = await fetchApi(`/workspaces/${wsId}/connections`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await safeJson(res, { error: 'Failed to add connection' });
      throw new Error(err.error);
    }
    return res.json();
  },

  async updateConnection(wsId, wcId, data) {
    const res = await fetchApi(`/workspaces/${wsId}/connections/${wcId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await safeJson(res, { error: 'Failed to update connection' });
      throw new Error(err.error);
    }
    return res.json();
  },

  async checkConnectionUsage(wsId, wcId) {
    const res = await fetchApi(`/workspaces/${wsId}/connections/${wcId}/usage`);
    return safeJson(res, { dashboardCount: 0, askConversationCount: 0 });
  },

  async removeConnection(wsId, wcId) {
    const res = await fetchApi(`/workspaces/${wsId}/connections/${wcId}`, { method: 'DELETE' });
    const data = await safeJson(res, { success: false });
    if (!res.ok) {
      const err = new Error(data.error || 'Failed to remove connection');
      err.status = res.status;
      err.detail = data.detail;
      err.dashboards = data.dashboards;
      throw err;
    }
    return data;
  },

  // Semantic Views
  async addView(wsId, data) {
    const res = await fetchApi(`/workspaces/${wsId}/views`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await safeJson(res, { error: 'Failed to add view' });
      const error = new Error(err.error);
      error.status = res.status;
      throw error;
    }
    return res.json();
  },

  async updateView(wsId, viewId, data) {
    const res = await fetchApi(`/workspaces/${wsId}/views/${viewId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async removeView(wsId, viewId) {
    const res = await fetchApi(`/workspaces/${wsId}/views/${viewId}`, { method: 'DELETE' });
    return res.json();
  },

  // Agents
  async addAgent(wsId, data) {
    const res = await fetchApi(`/workspaces/${wsId}/agents`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await safeJson(res, { error: 'Failed to add agent' });
      const error = new Error(err.error);
      error.status = res.status;
      throw error;
    }
    return res.json();
  },

  async updateAgent(wsId, agentId, data) {
    const res = await fetchApi(`/workspaces/${wsId}/agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async removeAgent(wsId, agentId) {
    const res = await fetchApi(`/workspaces/${wsId}/agents/${agentId}`, { method: 'DELETE' });
    return res.json();
  },
};
