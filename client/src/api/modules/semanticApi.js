import { fetchApi, safeJson } from './fetchCore.js';

export const semanticApi = {
  async listViews() {
    const res = await fetchApi('/semantic/views');
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed to list views: ${res.status}`);
    }
    return res.json();
  },

  async getView(database, schema, name, options = {}) {
    // options: { connectionId, role, warehouse }
    const { connectionId, role, warehouse } = typeof options === 'string'
      ? { connectionId: options } // Legacy: just connectionId as string
      : options;

    const queryParams = new URLSearchParams();
    if (connectionId) queryParams.set('connectionId', connectionId);
    if (role) queryParams.set('role', role);
    if (warehouse) queryParams.set('warehouse', warehouse);
    const queryString = queryParams.toString();

    const res = await fetchApi(`/semantic/views/${encodeURIComponent(database)}/${encodeURIComponent(schema)}/${encodeURIComponent(name)}${queryString ? `?${queryString}` : ''}`);
    if (!res.ok) {
      // Try to parse error response
      try {
        const errorData = await res.json();
        // Return the error data so caller can handle gracefully
        return { error: errorData.error || `Failed to get view: ${res.status}`, columns: [] };
      } catch {
        return { error: `Failed to get view: ${res.status}`, columns: [] };
      }
    }
    try {
      return await res.json();
    } catch (e) {
      return { error: 'Invalid response from server', columns: [] };
    }
  },

  async query(params, connectionId = null) {
    // Accept either object params or legacy separate args
    let body;
    if (typeof params === 'object' && params !== null && 'semanticView' in params) {
      // Object format: { semanticView, dimensions, measures, filters, orderBy, limit, connectionId }
      body = { ...params };
      // Allow connectionId to be passed in params or as second arg
      if (connectionId) body.connectionId = connectionId;
    } else {
      // Legacy positional format: (semanticView, dimensions, measures, filters, orderBy, limit)
      body = {
        semanticView: arguments[0],
        dimensions: arguments[1],
        measures: arguments[2],
        filters: arguments[3],
        orderBy: arguments[4],
        limit: arguments[5],
      };
    }

    const res = await fetchApi('/semantic/query', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let errorMessage = `Query failed: ${res.status}`;
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        const text = await res.text();
        if (text) errorMessage = text;
      }
      throw new Error(errorMessage);
    }
    return res.json();
  },

  /**
   * Generate SQL preview from field configuration
   * Backend is the SINGLE SOURCE OF TRUTH for SQL generation
   *
   * @param {Object} params - { semanticView, fields, customColumns, connectionId, role, warehouse }
   * @param {string} params.semanticView - Fully qualified semantic view name
   * @param {Array} params.fields - Field config: [{ name, shelf, aggregation, filter, sortDir }]
   * @param {Array} params.customColumns - Calculated fields: [{ name, expression }]
   * @returns {Object} - { sql, dimensions, measures, valid }
   */
  async preview(params) {
    const res = await fetchApi('/semantic/preview', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      // Don't throw - return error in response format
      return {
        sql: `-- Preview error: ${res.status}`,
        dimensions: [],
        measures: [],
        valid: false,
      };
    }
    return res.json();
  },

  /**
   * Execute a pivot query on a semantic view
   * @param {Object} params - { semanticView, rowDimensions, pivotColumn, measures, aggregation, filters, limit }
   */
  async pivot(params) {
    const res = await fetchApi('/semantic/pivot', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      let errorMessage = `Pivot query failed: ${res.status}`;
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        const text = await res.text();
        if (text) errorMessage = text;
      }
      throw new Error(errorMessage);
    }
    return res.json();
  },

  /**
   * Get distinct values for a field (optimized for filter dropdowns)
   * @param {Object} params - { semanticView, field, search?, limit?, connectionId?, role?, warehouse? }
   * @returns {Promise<{ values: any[], totalCount: number, hasMore: boolean }>}
   */
  async getDistinctValues(params) {
    const res = await fetchApi('/semantic/distinct-values', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      let errorMessage = `Failed to get distinct values: ${res.status}`;
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        const text = await res.text();
        if (text) errorMessage = text;
      }
      throw new Error(errorMessage);
    }
    return res.json();
  },

  async listDatabases() {
    const res = await fetchApi('/semantic/databases');
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed to list databases: ${res.status}`);
    }
    return res.json();
  },

  async listSchemas(database) {
    const res = await fetchApi(`/semantic/schemas/${encodeURIComponent(database)}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed to list schemas: ${res.status}`);
    }
    return res.json();
  },

  // ============================================================
  // Cortex AI Functions
  // ============================================================

  /**
   * Execute Cortex COMPLETE for LLM text generation
   */
  async cortexComplete(params) {
    const res = await fetchApi('/semantic/cortex/complete', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'Cortex COMPLETE failed' });
      throw new Error(data.error || 'Cortex COMPLETE failed');
    }
    return res.json();
  },

  /**
   * Ask a natural language question about a semantic view
   */
  async cortexAsk(params) {
    const res = await fetchApi('/semantic/cortex/ask', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'Cortex ASK failed' });
      throw new Error(data.error || 'Cortex ASK failed');
    }
    return res.json();
  },

  /**
   * Generate AI insights about query results
   */
  async cortexInsights(params) {
    const res = await fetchApi('/semantic/cortex/insights', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'Cortex INSIGHTS failed' });
      throw new Error(data.error || 'Cortex INSIGHTS failed');
    }
    return res.json();
  },

  /**
   * Analyze sentiment of text
   */
  async cortexSentiment(text) {
    const res = await fetchApi('/semantic/cortex/sentiment', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'Cortex SENTIMENT failed' });
      throw new Error(data.error || 'Cortex SENTIMENT failed');
    }
    return res.json();
  },

  /**
   * Summarize text
   */
  async cortexSummarize(text) {
    const res = await fetchApi('/semantic/cortex/summarize', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'Cortex SUMMARIZE failed' });
      throw new Error(data.error || 'Cortex SUMMARIZE failed');
    }
    return res.json();
  },

  /**
   * Translate text
   */
  async cortexTranslate(text, fromLanguage, toLanguage) {
    const res = await fetchApi('/semantic/cortex/translate', {
      method: 'POST',
      body: JSON.stringify({ text, fromLanguage, toLanguage }),
    });
    if (!res.ok) {
      const data = await safeJson(res, { error: 'Cortex TRANSLATE failed' });
      throw new Error(data.error || 'Cortex TRANSLATE failed');
    }
    return res.json();
  },

  /**
   * List available Cortex LLM models
   */
  async cortexModels() {
    const res = await fetchApi('/semantic/cortex/models');
    if (!res.ok) {
      return { models: [] };
    }
    return res.json();
  },

  /**
   * Execute a query with custom calculated columns
   */
  async queryWithCustomColumns(params) {
    const res = await fetchApi('/semantic/query-with-custom-columns', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      let errorMessage = `Query failed: ${res.status}`;
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        const text = await res.text();
        if (text) errorMessage = text;
      }
      throw new Error(errorMessage);
    }
    return res.json();
  },
};
