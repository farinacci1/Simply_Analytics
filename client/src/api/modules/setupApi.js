import { API_BASE, fetchApi } from './fetchCore.js';

export const setupApi = {
  async getStatus() {
    try {
      const res = await fetch(`${API_BASE}/setup/status`);
      if (!res.ok) return { configured: true };
      return res.json();
    } catch (_) {
      return { configured: true };
    }
  },

  async getProgress() {
    const res = await fetchApi('/setup/progress');
    if (!res.ok) throw new Error('Failed to fetch setup progress');
    return res.json();
  },

  async getMasterKey() {
    const res = await fetchApi('/setup/master-key');
    return res.json();
  },

  async testDatabase(config) {
    const res = await fetchApi('/setup/test-database', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return res.json();
  },

  async testRedis(config) {
    const res = await fetchApi('/setup/test-redis', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return res.json();
  },

  async saveConfig(config) {
    const res = await fetchApi('/setup/save-config', {
      method: 'POST',
      body: JSON.stringify({ config }),
    });
    return res.json();
  },

  runMigrations(onMessage, onComplete, onError) {
    const token = sessionStorage.getItem('authToken');
    return new Promise((resolve) => {
      fetch(`${API_BASE}/setup/run-migrations`, {
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
            if (done) {
              resolve();
              return;
            }
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

  async createOwner(data) {
    const res = await fetchApi('/setup/create-owner', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async complete() {
    const res = await fetchApi('/setup/complete', { method: 'POST' });
    return res.json();
  },
};
