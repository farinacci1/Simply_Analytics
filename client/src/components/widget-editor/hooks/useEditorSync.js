import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '../../../store/appStore';

const DEBUG = import.meta.env.VITE_DEBUG === 'true';

/**
 * Handles auto-save via onAutoSave callback (for embedded mode) and debounced
 * sync of the widget definition to the global store via updateWidget.
 */
export default function useEditorSync({
  widget, isNew, onAutoSave,
  title, widgetType, columns, rows, values, filters, sorts,
  customColumns, customConfig, semanticViewId, semanticViews,
  getColorConfig, markFields, fieldMarkTypes, fieldAggregations,
  columnAliases, colorPreset, customScheme, refreshEnabled,
  widgetConfig, configDimensions, configMeasures, semanticViewFQN,
  viewMetadata, internalUpdateRef, isStabilizingRef, mountTimeRef,
  fieldConfigs,
}) {
  const { currentDashboard, updateWidget } = useAppStore();

  // ── Auto-save (onAutoSave callback) ──
  const autoSaveTimerRef = useRef(null);
  const autoSaveMountTimeRef = useRef(Date.now());
  const prevFiltersRef = useRef(filters);
  const prevSortsRef = useRef(sorts);

  const buildAutoSaveUpdates = useCallback(() => {
    const fieldsUsed = [];
    columns.forEach((field, index) => {
      const name = typeof field === 'object' && field !== null ? field.name : field;
      const agg = typeof field === 'object' && field !== null ? field.aggregation : null;
      fieldsUsed.push({ name, order: index, placement: 'column', ...(agg && { aggregation: agg }) });
    });
    rows.forEach((field, index) => {
      const name = typeof field === 'object' && field !== null ? field.name : field;
      const agg = typeof field === 'object' && field !== null ? field.aggregation : null;
      fieldsUsed.push({ name, order: index, placement: 'row', ...(agg && { aggregation: agg }) });
    });
    values.forEach((field, index) => {
      const name = typeof field === 'object' && field !== null ? field.name : field;
      fieldsUsed.push({ name, order: index, placement: 'value' });
    });

    const viewObj = semanticViews.find(v => (typeof v === 'string' ? v : v.name) === semanticViewId);
    const fqn = typeof viewObj === 'object' ? (viewObj?.fullyQualifiedName || viewObj?.full_name || semanticViewId) : semanticViewId;
    const semanticViewsReferenced = semanticViewId ? [{ name: semanticViewId, fullyQualifiedName: fqn || semanticViewId, calculatedFields: customColumns }] : [];

    return {
      title: title.trim(), type: widgetType,
      config: { ...customConfig, ...getColorConfig() },
      fieldsUsed, filtersApplied: filters, sortsApplied: sorts,
      semanticViewsReferenced, customColumns,
      query: { dimensions: columns.map(f => typeof f === 'object' ? f.name : f), measures: values.map(f => typeof f === 'object' ? f.name : f), filters, orderBy: sorts, limit: 1000000 },
    };
  }, [title, widgetType, columns, rows, values, filters, sorts, customColumns, customConfig, semanticViewId, getColorConfig, semanticViews]);

  useEffect(() => {
    if (!onAutoSave || !title.trim()) return;
    if (Date.now() - autoSaveMountTimeRef.current < 800) return;

    const filtersChanged = filters !== prevFiltersRef.current;
    const sortsChanged = sorts !== prevSortsRef.current;
    prevFiltersRef.current = filters;
    prevSortsRef.current = sorts;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const delay = (filtersChanged || sortsChanged) ? 0 : 1000;

    autoSaveTimerRef.current = setTimeout(() => {
      internalUpdateRef.current = true;
      onAutoSave(buildAutoSaveUpdates());
    }, delay);

    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [title, widgetType, columns, rows, values, filters, sorts, customColumns, customConfig, semanticViewId, onAutoSave, getColorConfig, semanticViews, buildAutoSaveUpdates, internalUpdateRef]);

  // ── Debounced sync to global config via updateWidget ──
  const lastSyncedRef = useRef(null);
  const syncTimeoutRef = useRef(null);
  const pendingSyncRef = useRef(null);

  const fieldsKey = useMemo(() =>
    JSON.stringify(widgetConfig?.fields?.map(f => ({ name: f.name, shelf: f.shelf, markType: f.markType, aggregation: f.aggregation })) || []),
    [widgetConfig?.fields]
  );
  const marksKey = useMemo(() =>
    JSON.stringify((markFields || []).filter(mf => mf.field).map(mf => ({ type: mf.type, field: mf.field }))),
    [markFields]
  );
  const customConfigKey = useMemo(() => JSON.stringify(customConfig), [customConfig]);

  useEffect(() => {
    if (!widget?.id || isNew || !currentDashboard?.id || !updateWidget) return;
    if (!viewMetadata && semanticViewId) return;

    const syncKey = `${widgetType}|${semanticViewFQN}|${fieldsKey}|${configDimensions?.join(',')}|${configMeasures?.join(',')}|${colorPreset}|${marksKey}|${customConfigKey}`;

    if (isStabilizingRef.current) {
      if (Date.now() - mountTimeRef.current < 800) { lastSyncedRef.current = syncKey; return; }
      isStabilizingRef.current = false;
      lastSyncedRef.current = syncKey;
      return;
    }
    if (lastSyncedRef.current === syncKey) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    const doSync = () => {
      if (lastSyncedRef.current === syncKey) return;
      lastSyncedRef.current = syncKey;
      pendingSyncRef.current = null;

      const updatedWidget = {
        title, type: widgetType, semanticView: semanticViewFQN,
        fields: widgetConfig?.fields || [], filters: widgetConfig?.filters || [],
        sorts: widgetConfig?.sorts || [], filtersApplied: widgetConfig?.filters || [],
        sortsApplied: widgetConfig?.sorts || [], customColumns: widgetConfig?.customColumns || [],
        queryDimensions: configDimensions, queryMeasures: configMeasures,
        semanticViewsReferenced: semanticViewId ? [{ name: semanticViewId, fullyQualifiedName: semanticViewFQN || semanticViewId }] : [],
        marks: Object.fromEntries((markFields || []).filter(mf => mf.field && mf.type && mf.type !== 'label').map(mf => [mf.type, mf.field])),
        markFields,
        config: { colorPresetIndex: colorPreset, customScheme, ...customConfig, ...getColorConfig(), refreshEnabled, columnAliases, fieldAggregations },
      };
      internalUpdateRef.current = true;
      updateWidget(currentDashboard.id, widget.id, updatedWidget);
    };

    pendingSyncRef.current = doSync;
    syncTimeoutRef.current = setTimeout(doSync, 300);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (pendingSyncRef.current) pendingSyncRef.current();
    };
  }, [widget?.id, isNew, currentDashboard?.id, widgetType, semanticViewFQN, fieldsKey, configDimensions, configMeasures, semanticViewId, colorPreset, marksKey, customConfigKey, updateWidget, viewMetadata, title, markFields, customScheme, customConfig, getColorConfig, refreshEnabled, columnAliases, fieldAggregations, widgetConfig, internalUpdateRef, isStabilizingRef, mountTimeRef]);

  // ── Lightweight title-only sync ──
  const lastSyncedTitleRef = useRef(title);
  useEffect(() => {
    if (!widget?.id || isNew || !currentDashboard?.id || !updateWidget) return;
    if (title === lastSyncedTitleRef.current) return;
    lastSyncedTitleRef.current = title;
    updateWidget(currentDashboard.id, widget.id, { title });
  }, [widget?.id, isNew, currentDashboard?.id, title, updateWidget]);

  return { buildAutoSaveUpdates };
}
