import { fetchApi, safeJson } from './fetchCore.js';

export const connectionApi = {
  async test(config) {
    const res = await fetchApi('/connection/test', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return safeJson(res, { success: false, error: 'Connection test failed' });
  },

  async getWarehouses() {
    const res = await fetchApi('/connection/warehouses');
    if (!res.ok) return { warehouses: [] };
    return safeJson(res, { warehouses: [] });
  },

  async getRoles() {
    const res = await fetchApi('/connection/roles');
    if (!res.ok) return { roles: [] };
    return safeJson(res, { roles: [] });
  },
};
