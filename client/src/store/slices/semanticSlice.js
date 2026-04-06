import { semanticApi } from '../../api/apiClient';

export const createSemanticSlice = (set, get) => ({
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

});
