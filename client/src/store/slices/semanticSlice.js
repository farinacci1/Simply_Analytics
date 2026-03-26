import { semanticApi, queryApi } from '../../api/apiClient';
import { API_BASE, authFetch } from '../storeUtils';

export const createSemanticSlice = (set, get) => ({
  semanticModels: [],
  selectedModel: null,
  
  semanticViewMetadataCache: {},

  availableSemanticViews: [],
  loadingSemanticViews: false,

  loadSemanticViews: async () => {
    set({ loadingSemanticViews: true });
    try {
      const response = await semanticApi.listViews();
      set({ 
        availableSemanticViews: response.views || [],
        loadingSemanticViews: false,
      });
    } catch (error) {
      console.warn('Failed to load semantic views:', error);
      set({ loadingSemanticViews: false, availableSemanticViews: [] });
    }
  },

  loadModels: async () => {
    try {
      const response = await authFetch(`${API_BASE}/semantic/models`);
      const data = await response.json();
      set({ semanticModels: data.models || [] });
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  },

  createModel: async (modelData) => {
    try {
      const response = await authFetch(`${API_BASE}/semantic/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modelData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      set((state) => ({ semanticModels: [...state.semanticModels, data.model] }));
      return data.model;
    } catch (error) {
      console.error('Failed to create model:', error);
      throw error;
    }
  },

  generateModel: async (name, description) => {
    const { connectionId, selectedDatabase, selectedSchema, selectedTable, columns } = get();
    if (!selectedTable || !columns.length) return;

    try {
      const response = await authFetch(`${API_BASE}/semantic/models/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          database: selectedDatabase,
          schema: selectedSchema,
          table: selectedTable,
          columns,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      set((state) => ({ semanticModels: [...state.semanticModels, data.model] }));
      return data.model;
    } catch (error) {
      console.error('Failed to generate model:', error);
      throw error;
    }
  },

  selectModel: (model) => set({ selectedModel: model }),

  getCachedViewMetadata: (fullyQualifiedName) => {
    if (!fullyQualifiedName) return null;
    return get().semanticViewMetadataCache[fullyQualifiedName] || null;
  },
  
  setCachedViewMetadata: (fullyQualifiedName, metadata) => {
    if (!fullyQualifiedName || !metadata) return;
    set((state) => ({
      semanticViewMetadataCache: {
        ...state.semanticViewMetadataCache,
        [fullyQualifiedName]: {
          ...metadata,
          cachedAt: Date.now(),
        },
      },
    }));
  },
  
  prefetchSemanticViewMetadata: async (dashboard) => {
    if (!dashboard?.tabs) return;
    
    const { getCachedViewMetadata, setCachedViewMetadata } = get();
    
    const fqnSet = new Set();
    dashboard.tabs.forEach(tab => {
      (tab.widgets || []).forEach(widget => {
        const refs = widget.semanticViewsReferenced || [];
        refs.forEach(ref => {
          const fqn = typeof ref === 'object' ? ref.fullyQualifiedName : null;
          if (fqn) fqnSet.add(fqn);
        });
        if (widget.semanticView && widget.semanticView.includes('.')) {
          fqnSet.add(widget.semanticView);
        }
      });
    });
    
    (dashboard.semanticViewsReferenced || []).forEach(ref => {
      const fqn = typeof ref === 'object' ? ref.fullyQualifiedName : null;
      if (fqn) fqnSet.add(fqn);
    });
    
    if (fqnSet.size === 0) return;
    
    const parseColumns = (columns) => {
      const dimensions = [], measures = [], facts = [];
      const stripPrefix = (name) => name?.includes('.') ? name.split('.').pop() : name;
      
      const isSnowflakeFormat = columns?.[0]?.object_kind !== undefined;
      
      if (isSnowflakeFormat) {
        const objectMap = new Map();
        columns.forEach(({ object_kind, object_name, property, property_value, parent_entity }) => {
          if (!object_name) return;
          if (!objectMap.has(object_name)) {
            objectMap.set(object_name, { name: stripPrefix(object_name), kind: object_kind, parentEntity: parent_entity, properties: {} });
          }
          if (property && property_value !== undefined) {
            objectMap.get(object_name).properties[property] = property_value;
          }
        });
        objectMap.forEach((obj) => {
          const kind = (obj.kind || '').toUpperCase();
          const fieldObj = { name: obj.name, type: obj.properties.DATA_TYPE || '', description: obj.properties.DESCRIPTION || '', parentEntity: obj.parentEntity };
          if (kind === 'METRIC' || kind === 'MEASURE') measures.push({ ...fieldObj, aggregation: obj.properties.DEFAULT_AGGREGATION || 'sum' });
          else if (kind === 'DIMENSION') dimensions.push(fieldObj);
          else if (kind === 'FACT') facts.push(fieldObj);
        });
      } else {
        (columns || []).forEach(col => {
          const name = col.name || col.column_name || col.NAME;
          const type = col.type || col.data_type || '';
          const semType = col.semantic_type || col.kind;
          if (!name) return;
          const fieldObj = { name, type, description: col.description || '' };
          if (semType === 'measure' || col.aggregation) measures.push({ ...fieldObj, aggregation: col.aggregation || 'sum' });
          else if (semType === 'dimension') dimensions.push(fieldObj);
          else if (semType === 'fact') facts.push(fieldObj);
          else {
            const upper = type.toUpperCase();
            (upper.includes('NUMBER') || upper.includes('INT') || upper.includes('FLOAT') || upper.includes('DECIMAL')) ? facts.push(fieldObj) : dimensions.push(fieldObj);
          }
        });
      }
      return { dimensions, measures, facts };
    };
    
    const fetches = [...fqnSet].map(async (fqn) => {
      if (getCachedViewMetadata(fqn)) return;
      
      try {
        const parts = fqn.split('.');
        if (parts.length !== 3) return;
        const [database, schema, name] = parts;
        
        const data = await semanticApi.getView(database, schema, name, {
          connectionId: dashboard.connection_id,
          role: dashboard.role,
          warehouse: dashboard.warehouse,
        });
        
        let metadata;
        if (data?.columns?.length > 0) {
          metadata = parseColumns(data.columns);
        } else if (data?.dimensions || data?.measures || data?.facts) {
          metadata = { dimensions: data.dimensions || [], measures: data.measures || [], facts: data.facts || [] };
        }
        
        if (metadata) {
          setCachedViewMetadata(fqn, metadata);
        }
      } catch (err) {
        console.warn(`[Prefetch] Failed to fetch metadata for ${fqn}:`, err.message);
      }
    });
    
    await Promise.allSettled(fetches);
  },

  clearCachedViewMetadata: (fullyQualifiedName) => {
    if (!fullyQualifiedName) return;
    set((state) => {
      const newCache = { ...state.semanticViewMetadataCache };
      delete newCache[fullyQualifiedName];
      return { semanticViewMetadataCache: newCache };
    });
  },
  
  clearAllViewMetadataCache: () => {
    set({ semanticViewMetadataCache: {} });
  },

  removeSemanticModel: async (modelId) => {
    const { selectedModel } = get();
    try {
      await authFetch(`${API_BASE}/semantic/models/${modelId}`, { method: 'DELETE' });
      set((state) => ({
        semanticModels: state.semanticModels.filter(m => m.id !== modelId),
        selectedModel: selectedModel?.id === modelId ? null : selectedModel,
      }));
    } catch (error) {
      console.error('Failed to delete model:', error);
      throw error;
    }
  },

  executeModelQuery: async (modelId, dimensions, measures, filters, orderBy, limit) => {
    const { connectionId, semanticModels } = get();
    const model = semanticModels.find((m) => m.id === modelId);
    if (!connectionId || !model) return;

    try {
      const data = await queryApi.build(modelId, {
        connectionId,
        model,
        dimensions,
        measures,
        filters,
        orderBy,
        limit,
      });
      return data;
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  },

  exportModelToYaml: (modelId) => {
    const { semanticModels } = get();
    const model = semanticModels.find(m => m.id === modelId);
    
    if (!model) return null;
    
    return import('js-yaml').then(yaml => yaml.dump({
      id: model.id,
      name: model.name,
      description: model.description || '',
      source: model.source,
      dimensions: model.dimensions || [],
      measures: model.measures || [],
      joins: model.joins || [],
      calculated_fields: model.calculated_fields || [],
    }, { indent: 2, lineWidth: 120, noRefs: true }));
  },

  importModelFromYaml: async (yamlString) => {
    try {
      const yaml = await import('js-yaml');
      const parsed = yaml.load(yamlString);
      
      if (!parsed || !parsed.name) {
        throw new Error('Invalid model YAML');
      }

      const model = {
        id: `model-${Date.now()}`,
        name: parsed.name,
        description: parsed.description,
        source: parsed.source,
        dimensions: parsed.dimensions || [],
        measures: parsed.measures || [],
        joins: parsed.joins || [],
        calculated_fields: parsed.calculated_fields || [],
      };
      
      set((state) => ({
        semanticModels: [...state.semanticModels, model],
      }));
      
      return model;
    } catch (error) {
      console.error('Failed to import model from YAML:', error);
      throw error;
    }
  },

  validateModelYaml: async (yamlString) => {
    try {
      const yaml = await import('js-yaml');
      const config = yaml.load(yamlString);
      const errors = [];

      if (!config.name) errors.push('Model name is required');
      if (!config.source) errors.push('Source configuration is required');

      (config.dimensions || []).forEach((dim, index) => {
        if (!dim.name) errors.push(`Dimension ${index + 1}: name is required`);
        if (!dim.sql) errors.push(`Dimension ${index + 1}: sql is required`);
      });

      (config.measures || []).forEach((measure, index) => {
        if (!measure.name) errors.push(`Measure ${index + 1}: name is required`);
        if (!measure.sql) errors.push(`Measure ${index + 1}: sql is required`);
      });

      return { valid: errors.length === 0, errors };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  },
});
