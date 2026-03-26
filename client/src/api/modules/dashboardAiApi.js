import { fetchApi, safeJson } from './fetchCore.js';

export const dashboardAiApi = {
  async generate(params) {
    const res = await fetchApi('/dashboard-ai/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'AI dashboard generation failed' });
      throw new Error(data.error || 'AI dashboard generation failed');
    }
    return res.json();
  },

  async generateWidget(params) {
    const res = await fetchApi('/dashboard-ai/generate-widget', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'AI widget generation failed' });
      throw new Error(data.error || 'AI widget generation failed');
    }
    return res.json();
  },

  async modify(params) {
    const res = await fetchApi('/dashboard-ai/modify', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'AI dashboard modification failed' });
      throw new Error(data.error || 'AI dashboard modification failed');
    }
    return res.json();
  },

  async chat(params) {
    const res = await fetchApi('/dashboard-ai/chat', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'AI chat failed' });
      throw new Error(data.error || 'AI chat failed');
    }
    return res.json();
  },

  async explore(params) {
    const res = await fetchApi('/dashboard-ai/explore', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'Explorer AI failed' });
      throw new Error(data.error || 'Explorer AI failed');
    }
    return res.json();
  },
};
