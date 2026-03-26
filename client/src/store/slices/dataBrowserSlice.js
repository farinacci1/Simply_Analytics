import { API_BASE, authFetch } from '../storeUtils';

export const createDataBrowserSlice = (set, get) => ({
  databases: [],
  schemas: [],
  tables: [],
  columns: [],
  selectedDatabase: null,
  selectedSchema: null,
  selectedTable: null,

  queryResults: null,
  queryError: null,

  loadDatabases: async () => {
    const { connectionId } = get();
    if (!connectionId) return;

    set({ isLoading: true });
    try {
      const response = await authFetch(`${API_BASE}/connection/databases/${connectionId}`);
      const data = await response.json();
      set({ databases: data.databases, isLoading: false });
    } catch (error) {
      console.error('Failed to load databases:', error);
      set({ isLoading: false });
    }
  },

  selectDatabase: async (database) => {
    const { connectionId } = get();
    set({ selectedDatabase: database, selectedSchema: null, selectedTable: null, schemas: [], tables: [], columns: [] });

    if (!connectionId) return;

    try {
      const response = await authFetch(`${API_BASE}/connection/schemas/${connectionId}/${database}`);
      const data = await response.json();
      set({ schemas: data.schemas });
    } catch (error) {
      console.error('Failed to load schemas:', error);
    }
  },

  selectSchema: async (schema) => {
    const { connectionId, selectedDatabase } = get();
    set({ selectedSchema: schema, selectedTable: null, tables: [], columns: [] });

    if (!connectionId) return;

    try {
      const response = await authFetch(`${API_BASE}/connection/tables/${connectionId}/${selectedDatabase}/${schema}`);
      const data = await response.json();
      set({ tables: data.tables });
    } catch (error) {
      console.error('Failed to load tables:', error);
    }
  },

  selectTable: async (table) => {
    const { connectionId, selectedDatabase, selectedSchema } = get();
    set({ selectedTable: table });

    if (!connectionId) return;

    try {
      const response = await authFetch(
        `${API_BASE}/connection/columns/${connectionId}/${selectedDatabase}/${selectedSchema}/${table}`
      );
      const data = await response.json();
      set({ columns: data.columns });
    } catch (error) {
      console.error('Failed to load columns:', error);
    }
  },

  executeQuery: async (sql) => {
    const { connectionId } = get();
    if (!connectionId) return;

    set({ isLoading: true, queryError: null });
    try {
      const response = await authFetch(`${API_BASE}/query/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, sql }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      set({ queryResults: data, isLoading: false });
      return data;
    } catch (error) {
      set({ queryError: error.message, isLoading: false });
      throw error;
    }
  },

  getSampleData: async () => {
    const { connectionId, selectedDatabase, selectedSchema, selectedTable } = get();
    if (!connectionId || !selectedTable) return;

    set({ isLoading: true, queryError: null });
    try {
      const response = await authFetch(
        `${API_BASE}/query/sample/${connectionId}/${selectedDatabase}/${selectedSchema}/${selectedTable}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      set({ queryResults: data, isLoading: false });
      return data;
    } catch (error) {
      set({ queryError: error.message, isLoading: false });
    }
  },
});
