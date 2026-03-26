import { fetchApi, safeJson } from './fetchCore.js';

export const groupApi = {
  async getAll() {
    const res = await fetchApi('/groups');
    return safeJson(res, { groups: [] });
  },

  async getMyGroups() {
    const res = await fetchApi('/groups/my-groups');
    return safeJson(res, { groups: [] });
  },

  async getById(groupId) {
    const res = await fetchApi(`/groups/${groupId}`);
    return safeJson(res, { group: null });
  },

  async getMembers(groupId) {
    const res = await fetchApi(`/groups/${groupId}/members`);
    return safeJson(res, { members: [] });
  },

  async create(groupData) {
    const res = await fetchApi('/groups', {
      method: 'POST',
      body: JSON.stringify(groupData),
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to create group' });
      throw new Error(error.error);
    }
    return safeJson(res, { group: null });
  },

  async update(groupId, updates) {
    const res = await fetchApi(`/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to update group' });
      throw new Error(error.error);
    }
    return safeJson(res, { group: null });
  },

  async delete(groupId) {
    const res = await fetchApi(`/groups/${groupId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to delete group' });
      throw new Error(error.error);
    }
    return safeJson(res, { success: false });
  },

  async addMember(groupId, userId) {
    const res = await fetchApi(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to add member' });
      throw new Error(error.error);
    }
    return safeJson(res, { success: false });
  },

  async removeMember(groupId, userId) {
    const res = await fetchApi(`/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await safeJson(res, { error: 'Failed to remove member' });
      throw new Error(error.error);
    }
    return safeJson(res, { success: false });
  },
};
