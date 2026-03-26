import { fetchApi, safeJson } from './fetchCore.js';

export const queryApi = {
  async execute(connectionId, sql, binds = []) {
    const res = await fetchApi('/query/execute', {
      method: 'POST',
      body: JSON.stringify({ connectionId, sql, binds }),
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'Query execution failed' });
      throw new Error(data.error || 'Query execution failed');
    }
    return safeJson(res, { rows: [], columns: [] });
  },

  async getSample(connectionId, database, schema, table, limit = 1000000) {
    const encodedPath = [connectionId, database, schema, table].map(encodeURIComponent).join('/');
    const res = await fetchApi(`/query/sample/${encodedPath}?limit=${limit}`);
    if (!res.ok) return { rows: [], columns: [] };
    return safeJson(res, { rows: [], columns: [] });
  },

  async build(modelId, params) {
    const res = await fetchApi(`/query/build/${encodeURIComponent(modelId)}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'Query build failed' });
      throw new Error(data.error || 'Query build failed');
    }
    return safeJson(res, { rows: [], columns: [] });
  },
};
