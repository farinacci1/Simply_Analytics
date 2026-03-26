import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../../store/appStore';
import { semanticApi } from '../../../api/apiClient';
import { parseColumnsToMetadata } from '../utils';

const DEBUG = import.meta.env.VITE_DEBUG === 'true';
const log = (...args) => DEBUG && console.log(...args);

/**
 * Manages semantic view selection, metadata fetching, caching, and fallbacks.
 * Returns the list of available semantic views, the selected view metadata,
 * loading state, and the auto-selected semanticViewId.
 */
export default function useViewMetadata({ widget, semanticViewId, setSemanticViewId }) {
  const {
    semanticModels, currentDashboard,
    getCachedViewMetadata, setCachedViewMetadata,
  } = useAppStore();

  const [semanticViews, setSemanticViews] = useState([]);
  const [selectedView, setSelectedView] = useState(null);
  const [viewMetadata, setViewMetadata] = useState(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  const semanticViewsInitializedRef = useRef(false);
  const widgetIdRef = useRef(widget?.id);

  // Load semantic views from dashboard on mount (only once per widget)
  useEffect(() => {
    if (semanticViewsInitializedRef.current && widgetIdRef.current === widget?.id) return;
    semanticViewsInitializedRef.current = true;
    widgetIdRef.current = widget?.id;

    log('useViewMetadata: Loading semantic views from dashboard:', {
      dashboardId: currentDashboard?.id,
      semanticViewsReferenced: currentDashboard?.semanticViewsReferenced,
    });

    if (currentDashboard?.semanticViewsReferenced?.length > 0) {
      setSemanticViews(currentDashboard.semanticViewsReferenced);

      if (widget?.semanticViewId) {
        setSemanticViewId(widget.semanticViewId);
      } else if (widget?.semanticViewsReferenced?.[0]) {
        setSemanticViewId(widget.semanticViewsReferenced[0].name);
      } else {
        const first = currentDashboard.semanticViewsReferenced[0];
        setSemanticViewId(typeof first === 'string' ? first : first.name);
      }
    } else {
      console.warn('useViewMetadata: No semantic views configured for this dashboard');
      if (widget?.semanticViewsReferenced?.length > 0) {
        log('useViewMetadata: Using semantic views from widget:', widget.semanticViewsReferenced);
        setSemanticViews(widget.semanticViewsReferenced);
        setSemanticViewId(widget.semanticViewsReferenced[0].name);
      }
    }
  }, [currentDashboard?.id, currentDashboard?.semanticViewsReferenced, widget?.id]);

  // Helper to get fallback metadata from semantic models
  const getFallbackMetadata = useCallback((viewName) => {
    const model = semanticModels.find(m =>
      m.id === viewName || m.name === viewName || m.name?.toLowerCase() === viewName?.toLowerCase()
    );
    if (model) return { dimensions: model.dimensions || [], measures: model.measures || [], facts: model.facts || [] };
    if (semanticModels.length > 0) {
      const first = semanticModels[0];
      return { dimensions: first.dimensions || [], measures: first.measures || [], facts: first.facts || [] };
    }
    return null;
  }, [semanticModels]);

  // Resolve the fully qualified name for a semantic view
  const resolveFQN = useCallback((viewObj) => {
    if (typeof viewObj === 'object' && viewObj) {
      if (viewObj.fullyQualifiedName) return viewObj.fullyQualifiedName;
      if (viewObj.full_name) return viewObj.full_name;
      if (viewObj.database && viewObj.schema && viewObj.name) return `${viewObj.database}.${viewObj.schema}.${viewObj.name}`;
      if (viewObj.databaseName && viewObj.schemaName && viewObj.name) return `${viewObj.databaseName}.${viewObj.schemaName}.${viewObj.name}`;
    }
    return null;
  }, []);

  // Fetch metadata when semantic view changes
  useEffect(() => {
    const fetchViewMetadata = async () => {
      if (!semanticViewId) { setViewMetadata(null); setSelectedView(null); return; }

      const viewObj = semanticViews.find(v => (typeof v === 'string' ? v : v.name) === semanticViewId);
      setSelectedView(viewObj);

      let fqn = resolveFQN(viewObj);

      if (!fqn && widget?.semanticViewsReferenced?.[0]?.fullyQualifiedName) {
        fqn = widget.semanticViewsReferenced[0].fullyQualifiedName;
      }
      if (!fqn && currentDashboard?.semanticViewsReferenced) {
        const dv = currentDashboard.semanticViewsReferenced.find(v => (typeof v === 'string' ? v : v.name) === semanticViewId);
        if (typeof dv === 'object' && dv?.fullyQualifiedName) fqn = dv.fullyQualifiedName;
      }
      if (!fqn) {
        const viewName = typeof viewObj === 'string' ? viewObj : (viewObj?.name || semanticViewId);
        const db = currentDashboard?.connection?.database;
        const schema = currentDashboard?.connection?.schema || 'PUBLIC';
        if (db) fqn = `${db}.${schema}.${viewName}`;
      }

      if (fqn) {
        const cached = getCachedViewMetadata(fqn);
        if (cached) { log('Using cached metadata for:', fqn); setViewMetadata(cached); return; }

        setLoadingMetadata(true);
        try {
          const parts = fqn.split('.');
          const [database, schema, name] = parts.length === 3 ? parts : [null, null, fqn];
          if (database && schema && name) {
            const data = await semanticApi.getView(database, schema, name, {
              connectionId: currentDashboard?.connection_id,
              role: currentDashboard?.role,
              warehouse: currentDashboard?.warehouse,
            });
            if (data?.columns?.length > 0) {
              const md = parseColumnsToMetadata(data.columns);
              setViewMetadata(md); setCachedViewMetadata(fqn, md);
            } else if (data?.dimensions || data?.measures || data?.facts) {
              const md = { dimensions: data.dimensions || [], measures: data.measures || [], facts: data.facts || [] };
              setViewMetadata(md); setCachedViewMetadata(fqn, md);
            } else {
              console.warn('View metadata returned unexpected data:', data);
              const fb = getFallbackMetadata(semanticViewId);
              if (fb) { setViewMetadata(fb); setCachedViewMetadata(fqn, fb); }
              else setViewMetadata({ dimensions: [], measures: [], facts: [] });
            }
          } else {
            setViewMetadata({ dimensions: [], measures: [], facts: [] });
          }
        } catch (error) {
          console.error('Failed to fetch view metadata:', error);
          const fb = getFallbackMetadata(semanticViewId);
          if (fb) { setViewMetadata(fb); setCachedViewMetadata(fqn, fb); }
          else setViewMetadata({ dimensions: [], measures: [], facts: [] });
        } finally {
          setLoadingMetadata(false);
        }
      } else {
        const fb = getFallbackMetadata(semanticViewId);
        if (fb) { log('Using semantic model metadata for view:', semanticViewId); setViewMetadata(fb); }
        else { console.warn('No metadata available for view:', semanticViewId); setViewMetadata({ dimensions: [], measures: [], facts: [] }); }
      }
    };
    fetchViewMetadata();
  }, [semanticViewId, semanticViews, semanticModels, currentDashboard, getCachedViewMetadata, setCachedViewMetadata, resolveFQN, getFallbackMetadata, widget?.semanticViewsReferenced]);

  return { semanticViews, selectedView, viewMetadata, loadingMetadata };
}
