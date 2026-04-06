import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../store/appStore';

const DEBUG = import.meta.env.VITE_DEBUG === 'true';
const log = (...args) => DEBUG && console.log(...args);

/**
 * Persists calculated fields to the dashboard-level semanticViewsReferenced
 * so they can be shared across widgets using the same semantic view.
 * Also loads dashboard-level calc fields and column aliases on first mount.
 */
export default function useCalcFieldsPersistence({
  customColumns, setCustomColumns,
  columnAliases, setColumnAliases,
  semanticViewId, semanticViews,
  ensureCalcFieldIds,
}) {
  const { currentDashboard } = useAppStore();
  const lastSavedCalcFieldsRef = useRef(null);
  const calcFieldsLoadedRef = useRef(false);

  useEffect(() => {
    if (!currentDashboard || !semanticViewId) return;
    const currentKey = JSON.stringify(customColumns.map(c => ({ name: c.name, expression: c.expression })));
    if (lastSavedCalcFieldsRef.current === currentKey) return;
    if (customColumns.length === 0 && lastSavedCalcFieldsRef.current === null) {
      lastSavedCalcFieldsRef.current = currentKey;
      return;
    }

    const timer = setTimeout(() => {
      const { updateDashboard } = useAppStore.getState();
      const viewObj = semanticViews.find(v => (typeof v === 'string' ? v : v.name) === semanticViewId);
      const fqn = typeof viewObj === 'object' ? (viewObj?.fullyQualifiedName || viewObj?.full_name || semanticViewId) : semanticViewId;
      const dashboardViews = [...(currentDashboard.semanticViewsReferenced || [])];
      const idx = dashboardViews.findIndex(v => (typeof v === 'string' ? v : v.name) === semanticViewId);

      if (idx >= 0) {
        const existing = dashboardViews[idx];
        const merged = [...(existing.calculatedFields || [])];
        customColumns.forEach(cc => {
          const eIdx = merged.findIndex(cf => cf.name === cc.name);
          if (eIdx >= 0) merged[eIdx] = cc; else merged.push(cc);
        });
        dashboardViews[idx] = { ...existing, calculatedFields: merged };
        updateDashboard(currentDashboard.id, { semanticViewsReferenced: dashboardViews });
      } else if (semanticViewId && customColumns.length > 0) {
        dashboardViews.push({ name: semanticViewId, fullyQualifiedName: fqn || semanticViewId, calculatedFields: customColumns });
        updateDashboard(currentDashboard.id, { semanticViewsReferenced: dashboardViews });
      }
      lastSavedCalcFieldsRef.current = currentKey;
    }, 500);

    return () => clearTimeout(timer);
  }, [customColumns, currentDashboard?.id, semanticViewId, semanticViews]);

  useEffect(() => {
    if (!semanticViewId || !currentDashboard?.semanticViewsReferenced) return;
    if (calcFieldsLoadedRef.current) return;
    calcFieldsLoadedRef.current = true;

    const dv = currentDashboard.semanticViewsReferenced.find(v => (typeof v === 'string' ? v : v.name) === semanticViewId);

    if (!customColumns.length && dv && typeof dv === 'object' && dv.calculatedFields?.length > 0) {
      log('Loading dashboard-level calculated fields:', semanticViewId, dv.calculatedFields);
      setCustomColumns(ensureCalcFieldIds(dv.calculatedFields));
    }
    if (dv && typeof dv === 'object' && dv.columnAliases) {
      log('Loading dashboard-level column aliases:', semanticViewId, dv.columnAliases);
      setColumnAliases(dv.columnAliases);
    }
  }, [semanticViewId, currentDashboard?.semanticViewsReferenced]);

  // Reset the loaded ref when semantic view changes
  useEffect(() => { calcFieldsLoadedRef.current = false; }, [semanticViewId]);
}
