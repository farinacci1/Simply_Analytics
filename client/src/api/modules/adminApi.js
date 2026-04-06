import { fetchApi } from './fetchCore.js';
import { API_BASE } from './fetchCore.js';

function authHeaders() {
  const token = sessionStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export const adminApi = {
  async getConfig() {
    const res = await fetchApi('/admin/config');
    return res.json();
  },

  async getConfigSection(section) {
    const res = await fetchApi(`/admin/config/${section}`);
    return res.json();
  },

  async updateConfigSection(section, values) {
    const res = await fetchApi(`/admin/config/${section}`, {
      method: 'PUT',
      body: JSON.stringify(values),
    });
    return res.json();
  },

  async testConnection(type, overrides = {}) {
    const res = await fetchApi('/admin/test-connection', {
      method: 'POST',
      body: JSON.stringify({ type, ...overrides }),
    });
    return res.json();
  },

  runMigrations(onMessage, onComplete, onError) {
    return new Promise((resolve) => {
      const token = sessionStorage.getItem('authToken');
      fetch(`${API_BASE}/admin/migrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      }).then((res) => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        function read() {
          reader.read().then(({ done, value }) => {
            if (done) { resolve(); return; }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === 'log') onMessage?.(data.message);
                  else if (data.type === 'complete') onComplete?.(data);
                  else if (data.type === 'error') onError?.(data.message);
                } catch (_) {}
              }
            }
            read();
          });
        }
        read();
      }).catch((err) => {
        onError?.(err.message);
        resolve();
      });
    });
  },

  async rotateKey(keyType) {
    const res = await fetchApi(`/admin/rotate-key/${keyType}`, { method: 'POST' });
    return res.json();
  },

  async getSystemInfo() {
    const res = await fetchApi('/admin/system');
    return res.json();
  },

  async testMigrationTarget(destConfig) {
    const res = await fetchApi('/admin/test-migration-target', {
      method: 'POST',
      body: JSON.stringify(destConfig),
    });
    return res.json();
  },

  migrateData(destConfig, onProgress, onComplete, onError) {
    return new Promise((resolve) => {
      const token = sessionStorage.getItem('authToken');
      fetch(`${API_BASE}/admin/migrate-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(destConfig),
      }).then((res) => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        function read() {
          reader.read().then(({ done, value }) => {
            if (done) { resolve(); return; }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === 'progress') onProgress?.(data);
                  else if (data.type === 'complete') onComplete?.(data);
                  else if (data.type === 'error') onError?.(data.message);
                } catch (_) {}
              }
            }
            read();
          });
        }
        read();
      }).catch((err) => {
        onError?.(err.message);
        resolve();
      });
    });
  },

  async switchBackend(destConfig) {
    const res = await fetchApi('/admin/switch-backend', {
      method: 'POST',
      body: JSON.stringify(destConfig),
    });
    return res.json();
  },

  async verifyMasterKey(key) {
    const res = await fetchApi('/admin/master-key/verify', {
      method: 'POST',
      body: JSON.stringify({ key }),
    });
    return res.json();
  },
};
