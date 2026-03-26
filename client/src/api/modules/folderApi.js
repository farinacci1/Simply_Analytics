import { fetchApi, safeJson } from './fetchCore.js';

export const folderApi = {
  async getContents(folderId = null) {
    const url = folderId ? `/folders/${folderId}/contents` : '/folders/contents';
    const res = await fetchApi(url);
    return safeJson(res, { folders: [], dashboards: [] });
  },

  async getPath(folderId) {
    const res = await fetchApi(`/folders/${folderId}/path`);
    return safeJson(res, []);
  },

  async getById(folderId) {
    const res = await fetchApi(`/folders/${folderId}`);
    return safeJson(res, null);
  },

  async create(folderData) {
    const res = await fetchApi('/folders', {
      method: 'POST',
      body: JSON.stringify(folderData),
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to create folder' });
      throw new Error(error.error);
    }
    return safeJson(res, null);
  },

  async update(folderId, updates) {
    const res = await fetchApi(`/folders/${folderId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to update folder' });
      throw new Error(error.error);
    }
    return safeJson(res, null);
  },

  async delete(folderId) {
    const res = await fetchApi(`/folders/${folderId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to delete folder' });
      throw new Error(error.error);
    }
    return safeJson(res, { success: true });
  },

  async search(query) {
    const res = await fetchApi('/folders/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
    return safeJson(res, { folders: [], dashboards: [] });
  },

  async moveDashboard(dashboardId, folderId) {
    const res = await fetchApi(`/folders/move-dashboard/${dashboardId}`, {
      method: 'PUT',
      body: JSON.stringify({ folderId }),
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to move dashboard' });
      throw new Error(error.error);
    }
    return safeJson(res, null);
  },

  // Folder access management
  async getAccess(folderId) {
    const res = await fetchApi(`/folders/${folderId}/access`);
    return safeJson(res, { groups: [] });
  },

  async grantAccess(folderId, groupId) {
    const res = await fetchApi(`/folders/${folderId}/access`, {
      method: 'POST',
      body: JSON.stringify({ groupId }),
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to grant access' });
      throw new Error(error.error);
    }
    return safeJson(res, { success: true });
  },

  async revokeAccess(folderId, groupId) {
    const res = await fetchApi(`/folders/${folderId}/access/${groupId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to revoke access' });
      throw new Error(error.error);
    }
    return safeJson(res, { success: true });
  },
};
