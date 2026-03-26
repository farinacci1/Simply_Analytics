import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppStore } from '../../../store/appStore';
import { semanticApi, isNetworkPolicyError } from '../../../api/apiClient';
import { getCacheKey, getCachedResult, setCachedResult } from '../../../utils/widgetCache';

const DEBUG = import.meta.env.VITE_DEBUG === 'true';
const log = (...args) => DEBUG && console.log(...args);

/**
 * Manages data loading, caching, error handling, and auto-insight generation
 * for a dashboard widget.
 */
export default function useWidgetData({
  widget, effectiveWidgetType, semanticViewFQN,
  dimensions, measures, aggregatedFields, columnDimensions,
  mergedFilters, sortsApplied, customColumns,
}) {
  const {
    currentDashboard, dashboardConnectionError, setDashboardConnectionError, widgetRefreshKey,
  } = useAppStore();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [error, setError] = useState(null);

  // Auto-insight
  const [autoInsightSummary, setAutoInsightSummary] = useState(null);
  const autoInsightRequestedRef = useRef(false);

  const loadingRef = useRef(false);
  const loadRequestId = useRef(0);
  const networkPolicyErrorRef = useRef(false);
  const prevRefreshKeyRef = useRef(0);
  const attemptedRefreshKeyRef = useRef(0);

  // Stable dependency keys
  const dimensionsKey = useMemo(() => JSON.stringify(dimensions), [dimensions]);
  const measuresKey = useMemo(() => JSON.stringify(measures), [measures]);
  const filtersKey = useMemo(() => JSON.stringify(mergedFilters), [mergedFilters]);
  const sortsKey = useMemo(() => JSON.stringify(sortsApplied), [sortsApplied]);
  const aggregationsKey = useMemo(() => JSON.stringify(aggregatedFields), [aggregatedFields]);

  // Only include custom columns actually used by the widget's fields
  const usedCustomColumns = useMemo(() => {
    const allFieldNames = new Set([...dimensions, ...measures, ...columnDimensions].map(n => n.toUpperCase()));
    const calcByName = new Map(customColumns.map(cc => [cc.name.toUpperCase(), cc]));
    const used = new Set();
    customColumns.forEach(cc => { if (allFieldNames.has(cc.name.toUpperCase())) used.add(cc.name.toUpperCase()); });
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const name of used) {
        const cc = calcByName.get(name);
        if (!cc?.expression) continue;
        for (const m of cc.expression.matchAll(/\[([^\]]+)\]/g)) {
          const upper = m[1].toUpperCase();
          if (calcByName.has(upper) && !used.has(upper)) { used.add(upper); expanded = true; }
        }
      }
    }
    return customColumns.filter(cc => used.has(cc.name.toUpperCase()));
  }, [customColumns, dimensions, measures, columnDimensions]);

  const customColumnsKey = useMemo(() =>
    JSON.stringify(usedCustomColumns.map(c => ({ name: c.name, expression: c.expression }))),
    [usedCustomColumns]
  );

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && dashboardConnectionError) { setLoading(false); setHasAttemptedLoad(true); return; }
    if (!forceRefresh && networkPolicyErrorRef.current) { setLoading(false); setHasAttemptedLoad(true); return; }
    if (!semanticViewFQN || (dimensions.length === 0 && measures.length === 0)) {
      log('loadData skipped:', { semanticViewFQN, dimensions, measures });
      setLoading(false); setHasAttemptedLoad(true); return;
    }

    console.log('[DashboardWidget] loadData - connection info:', {
      widgetId: widget.id, semanticViewFQN,
      connectionId: currentDashboard?.connection_id,
      role: currentDashboard?.role,
      warehouse: currentDashboard?.warehouse,
    });

    if (forceRefresh) networkPolicyErrorRef.current = false;
    if (loadingRef.current && !forceRefresh) { log('loadData skipped - already loading'); return; }

    const cacheKey = getCacheKey(semanticViewFQN, dimensions, measures, mergedFilters, sortsApplied, usedCustomColumns, aggregatedFields);
    if (!forceRefresh) {
      const cached = getCachedResult(cacheKey);
      if (cached) { setData(cached); setLoading(false); setHasAttemptedLoad(true); return; }
    }

    loadingRef.current = true;
    const thisRequestId = ++loadRequestId.current;
    setLoading(true);
    setError(null);

    try {
      let result;
      console.log('\n=== FRONTEND QUERY REQUEST ===');
      console.log('semanticViewFQN:', semanticViewFQN);
      console.log('dimensions:', JSON.stringify(dimensions));
      console.log('measures:', JSON.stringify(measures));
      console.log('filters:', JSON.stringify(mergedFilters));
      console.log('sorts:', JSON.stringify(sortsApplied));
      console.log('usedCustomColumns:', JSON.stringify(usedCustomColumns));
      console.log('==============================\n');

      if (usedCustomColumns.length > 0) {
        const customColumnNamesUpper = new Set(usedCustomColumns.map(cc => cc.name.toUpperCase()));
        result = await semanticApi.queryWithCustomColumns({
          semanticView: semanticViewFQN,
          dimensions: dimensions.filter(d => !customColumnNamesUpper.has(d.toUpperCase())),
          measures: measures.filter(m => !customColumnNamesUpper.has(m.toUpperCase())),
          aggregatedFields: aggregatedFields || [],
          filters: mergedFilters, orderBy: sortsApplied,
          customColumns: usedCustomColumns, limit: 1000000,
          connectionId: currentDashboard?.connection_id,
          role: currentDashboard?.role, warehouse: currentDashboard?.warehouse,
          forceRefresh,
        });
      } else {
        result = await semanticApi.query({
          semanticView: semanticViewFQN,
          dimensions, measures, aggregatedFields: aggregatedFields || [],
          filters: mergedFilters, orderBy: sortsApplied, limit: 1000000,
          connectionId: currentDashboard?.connection_id,
          role: currentDashboard?.role, warehouse: currentDashboard?.warehouse,
          forceRefresh,
        });
      }

      const transformedRows = (result.data || []).map(row => {
        const transformed = {};
        Object.keys(row).forEach(key => {
          const matchingDim = dimensions.find(d => d.toUpperCase() === key.toUpperCase());
          const matchingMeasure = measures.find(m => m.toUpperCase() === key.toUpperCase());
          transformed[matchingDim || matchingMeasure || key] = row[key];
        });
        return transformed;
      });

      const columns = [...dimensions, ...measures].map(name => ({ name }));
      const chartData = { rows: transformedRows, columns };

      if (thisRequestId === loadRequestId.current) {
        setData(chartData);
        setCachedResult(cacheKey, chartData);

        if (!autoInsightRequestedRef.current && chartData.rows.length > 2 &&
            !['table', 'metric', 'pivot'].includes(effectiveWidgetType)) {
          autoInsightRequestedRef.current = true;
          semanticApi.cortexInsights({
            data: chartData.rows.slice(0, 20),
            query: `Quick insight for widget: ${widget.title}. Respond with ONE sentence only — the single most interesting finding.`,
            semanticView: semanticViewFQN,
            connectionId: currentDashboard?.connection_id,
            role: currentDashboard?.role, warehouse: currentDashboard?.warehouse,
          }).then(res => {
            let text = res?.insights;
            if (text && typeof text === 'string') {
              try { const p = JSON.parse(text); text = p.choices?.[0]?.messages || p.choices?.[0]?.message?.content || text; } catch {}
            }
            if (text && text.length < 200) setAutoInsightSummary(text);
          }).catch(() => {});
        }
      }
    } catch (err) {
      const errorMessage = err.message || 'Unknown error';
      const isConnectionError = isNetworkPolicyError(err) ||
        errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT') || errorMessage.includes('network') ||
        errorMessage.includes('Failed to fetch') || errorMessage.includes('Unable to connect');

      if (isConnectionError) {
        networkPolicyErrorRef.current = true;
        if (setDashboardConnectionError && !dashboardConnectionError) setDashboardConnectionError(errorMessage);
      } else {
        console.error('Widget data load error:', err);
      }
      setError(errorMessage);
    } finally {
      if (thisRequestId === loadRequestId.current) {
        loadingRef.current = false;
        setLoading(false);
        setHasAttemptedLoad(true);
      }
    }
  }, [
    semanticViewFQN, dimensions, measures, aggregatedFields, mergedFilters,
    sortsApplied, usedCustomColumns, widget.id, widget.title, effectiveWidgetType,
    currentDashboard, dashboardConnectionError, setDashboardConnectionError,
  ]);

  // Main data-loading effect
  useEffect(() => {
    if (effectiveWidgetType === 'title' || effectiveWidgetType === 'filter') {
      setLoading(false); setHasAttemptedLoad(true); return;
    }
    if (widget?.config?.refreshEnabled === false) return;
    if (dashboardConnectionError) { setLoading(false); setHasAttemptedLoad(true); return; }

    const hasDimensions = dimensions.length > 0;
    const hasMeasures = measures.length > 0 || aggregatedFields.length > 0;

    const isNewRefreshKey = widgetRefreshKey > prevRefreshKeyRef.current;
    const alreadyAttempted = widgetRefreshKey === attemptedRefreshKeyRef.current;
    const shouldForceRefresh = isNewRefreshKey && !alreadyAttempted;
    if (shouldForceRefresh) { networkPolicyErrorRef.current = false; attemptedRefreshKeyRef.current = widgetRefreshKey; }
    if (networkPolicyErrorRef.current && !shouldForceRefresh) { prevRefreshKeyRef.current = widgetRefreshKey; return; }

    if (semanticViewFQN && (hasDimensions || hasMeasures)) {
      prevRefreshKeyRef.current = widgetRefreshKey;
      loadData(shouldForceRefresh);
    } else {
      setLoading(false); setHasAttemptedLoad(true);
    }
  }, [semanticViewFQN, dimensionsKey, measuresKey, aggregationsKey, filtersKey, sortsKey, customColumnsKey, widgetRefreshKey, widget?.config?.refreshEnabled, dashboardConnectionError, loadData]);

  // Propagate network-policy errors to the dashboard level
  useEffect(() => {
    if (error && isNetworkPolicyError({ message: error }) && setDashboardConnectionError && !dashboardConnectionError) {
      setDashboardConnectionError(error);
    }
  }, [error, setDashboardConnectionError, dashboardConnectionError]);

  return { data, loading, hasAttemptedLoad, error, loadData, autoInsightSummary };
}
