import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '../../store/appStore';

import { 
  FilterPopup, ShelfPopup, SqlPreviewDropdown, AggregationDropdown,
  FieldTooltip, FieldsSection, FormattingSection, FiltersSortsSection,
  ShelvesSection, DataSourceSection, EditorHeader, AGGREGATION_OPTIONS,
  TitleWidgetConfig, FilterWidgetConfig,
} from './components';
import EditorCopilot from './components/EditorCopilot';
import MapConfigSection from './components/MapConfigSection';
import '../../styles/WidgetEditor.css';

import { COLOR_PRESETS, CHART_FORMAT_OPTIONS, getFormatDefaults, getChartConfig } from './constants';
import { parseColumnsToMetadata } from './utils';
import { useFilters, useSorts, useQueryPreview, useDragDrop, useWidgetConfig, useViewMetadata, useEditorSync, useCalcFieldsPersistence } from './hooks';
import { isFieldUsed, getFieldUsageLocations, updateFieldAggregation as updateFieldAggHelper, handleDeleteCalculatedField as deleteCalcFieldHelper } from './utils/widgetEditorHelpers';

const DEBUG = import.meta.env.VITE_DEBUG === 'true';
const log = (...args) => DEBUG && console.log(...args);

const stripEntityPrefixGlobal = (name) => {
  if (!name) return name;
  return name.includes('.') ? name.split('.').pop() : name;
};

const getFieldsByPlacement = (fieldsUsed, placement) => {
  if (!fieldsUsed || !Array.isArray(fieldsUsed) || fieldsUsed.length === 0) return null;
  const fields = fieldsUsed
    .filter(f => f.placement === placement)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(f => stripEntityPrefixGlobal(f.name));
  return fields.length > 0 ? fields : null;
};

const WidgetEditor = ({ widget, dashboardId, onClose, onSave, onAutoSave, isNew = false, onConfigChange, onFormulaEditingChange }) => {
  const { currentDashboard, updateWidget } = useAppStore();
  
  const originalWidgetRef = useRef(widget ? JSON.parse(JSON.stringify(widget)) : null);

  const [title, setTitle] = useState(widget?.title || '');
  const [widgetType, setWidgetType] = useState(widget?.type || 'table');
  const [semanticViewId, setSemanticViewId] = useState(() => {
    if (widget?.semanticViewsReferenced?.[0]?.name) return widget.semanticViewsReferenced[0].name;
    return widget?.semanticViewId || '';
  });

  const stripEntityPrefix = (name) => {
    if (!name) return name;
    return name.includes('.') ? name.split('.').pop() : name;
  };

  const getFieldsFromUnified = (fields, shelf) => {
    if (!fields || !Array.isArray(fields)) return null;
    const shelfFields = fields.filter(f => f.shelf === shelf);
    return shelfFields.length > 0 ? shelfFields.map(f => stripEntityPrefix(f.name)) : null;
  };

  // Stabilization refs
  const mountTimeRef = useRef(Date.now());
  const isStabilizingRef = useRef(true);

  const lastExternalFieldsRef = useRef(widget?.fields ? JSON.stringify(widget.fields) : '');
  const internalUpdateRef = useRef(false);

  // ── Shelf state ──
  const [columns, _setColumnsRaw] = useState(() => {
    if (widget?.fields?.length > 0) return getFieldsFromUnified(widget.fields, 'columns') || [];
    const fromFieldsUsed = getFieldsByPlacement(widget?.fieldsUsed, 'column');
    if (fromFieldsUsed?.length > 0) return fromFieldsUsed;
    if (widget?.queryDimensions?.length > 0) return [...widget.queryDimensions];
    if (widget?.query?.dimensions?.length > 0) return [...widget.query.dimensions];
    return [];
  });

  const [rows, _setRowsRaw] = useState(() => {
    if (widget?.fields?.length > 0) return getFieldsFromUnified(widget.fields, 'rows') || [];
    const fromFieldsUsed = getFieldsByPlacement(widget?.fieldsUsed, 'row');
    if (fromFieldsUsed?.length > 0) return fromFieldsUsed;
    if (widget?.queryMeasures?.length > 0) return [...widget.queryMeasures];
    const fromValues = getFieldsByPlacement(widget?.fieldsUsed, 'value');
    if (fromValues?.length > 0) return fromValues;
    return [];
  });

  const [values, setValues] = useState([]);

  const setColumns = useCallback((updater) => { isStabilizingRef.current = false; _setColumnsRaw(updater); }, []);
  const setRows = useCallback((updater) => { isStabilizingRef.current = false; _setRowsRaw(updater); }, []);

  // ── Color config ──
  const [colorPreset, setColorPreset] = useState(widget?.config?.colorPresetIndex ?? 0);
  const [customScheme, setCustomScheme] = useState(widget?.config?.customScheme || null);

  const getColorConfig = useCallback(() => {
    if (colorPreset === -1 && customScheme) {
      return { colors: customScheme.colors, colorScheme: null, colorSchemeType: customScheme.type || 'categorical', colorPresetIndex: -1, customScheme };
    }
    const preset = COLOR_PRESETS[colorPreset] || COLOR_PRESETS[0];
    return { colors: preset.colors, colorScheme: preset.schemeKey, colorSchemeType: preset.type, colorPresetIndex: colorPreset, customScheme: null };
  }, [colorPreset, customScheme]);

  // ── Custom config, loading, UI state ──
  const [customConfig, setCustomConfig] = useState(() => ({ ...getFormatDefaults(widget?.type || 'table'), ...widget?.config }));
  const [prevWidgetType, setPrevWidgetType] = useState(widget?.type || 'table');
  const [loading, setLoading] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [shelfPopup, setShelfPopup] = useState({ open: null, search: '', x: 0, y: 0, openUp: false });
  const [pendingColumns, setPendingColumns] = useState([]);
  const [pendingRows, setPendingRows] = useState([]);
  const [aggDropdown, setAggDropdown] = useState({ open: false, shelf: null, idx: null, x: 0, y: 0 });
  const [fieldTooltip, setFieldTooltip] = useState({ visible: false, name: '', type: '', x: 0, y: 0 });

  // ── Semantic view metadata (extracted hook) ──
  const { semanticViews, selectedView, viewMetadata, loadingMetadata } = useViewMetadata({
    widget, semanticViewId, setSemanticViewId,
  });

  const allDimensions = useMemo(() => [
    ...(viewMetadata?.facts || []),
    ...(viewMetadata?.dimensions || []),
  ].map(dim => ({ ...dim, isDatePart: false })), [viewMetadata]);

  const normalizeFieldName = useCallback((name) => name?.toUpperCase?.() || '', []);

  const ensureCalcFieldIds = (fields) => (fields || []).map(f => f.id ? f : { ...f, id: crypto.randomUUID() });
  const [customColumns, setCustomColumns] = useState(() => ensureCalcFieldIds(widget?.customColumns));

  // ── FQN resolver ──
  const getFullyQualifiedName = useCallback(() => {
    if (!semanticViewId) return null;
    const viewObj = semanticViews.find(v => (typeof v === 'string' ? v : v.name) === semanticViewId);
    if (typeof viewObj === 'object' && viewObj) {
      if (viewObj.fullyQualifiedName) return viewObj.fullyQualifiedName;
      if (viewObj.full_name) return viewObj.full_name;
      if (viewObj.database && viewObj.schema && viewObj.name) return `${viewObj.database}.${viewObj.schema}.${viewObj.name}`;
      if (viewObj.databaseName && viewObj.schemaName && viewObj.name) return `${viewObj.databaseName}.${viewObj.schemaName}.${viewObj.name}`;
    }
    if (widget?.semanticViewsReferenced?.[0]?.fullyQualifiedName) return widget.semanticViewsReferenced[0].fullyQualifiedName;
    if (currentDashboard?.semanticViewsReferenced) {
      const dv = currentDashboard.semanticViewsReferenced.find(v => (typeof v === 'string' ? v : v.name) === semanticViewId);
      if (typeof dv === 'object' && dv?.fullyQualifiedName) return dv.fullyQualifiedName;
    }
    const viewName = typeof viewObj === 'string' ? viewObj : (viewObj?.name || semanticViewId);
    const db = currentDashboard?.connection?.database;
    const schema = currentDashboard?.connection?.schema || 'PUBLIC';
    if (db && viewName) return `${db}.${schema}.${viewName}`;
    return null;
  }, [semanticViewId, semanticViews, currentDashboard, widget?.semanticViewsReferenced]);

  const getFullyQualifiedNameRef = useRef(getFullyQualifiedName);
  getFullyQualifiedNameRef.current = getFullyQualifiedName;

  // ── Filters & Sorts hooks ──
  const {
    filters, setFilters, filterPopup, setFilterPopup, filterSearch,
    filterPopupRef, showFilterPanel, setShowFilterPanel,
    exprAutocomplete, setExprAutocomplete, customExprRef,
    openFilterPopup, closeFilterPopup, handleFilterListScroll,
    handleFilterSearchChange, handleCustomExpressionChange,
    handleExprKeyDown, insertExprAutocomplete, applyAdvancedFilter,
    toggleFilterValue, isValueSelected, removeFilter, getFilterForField,
  } = useFilters({
    initialFilters: widget?.filtersApplied || [],
    allDimensions, measures: viewMetadata?.measures,
    customColumns, getFullyQualifiedNameRef, currentDashboard,
  });

  const {
    sorts, setSorts, showSortPanel, setShowSortPanel,
    addSort, removeSort, updateSortDirection, toggleSortDirection,
    moveSortUp, moveSortDown, getSortForField,
  } = useSorts(widget?.sortsApplied || []);

  // ── SQL preview ──
  const [sqlPreviewDropdown, setSqlPreviewDropdown] = useState({ open: false, x: 0, y: 0 });
  const [copiedSql, setCopiedSql] = useState(false);
  useEffect(() => { if (!sqlPreviewDropdown.open) setCopiedSql(false); }, [sqlPreviewDropdown.open]);

  const [refreshEnabled, setRefreshEnabled] = useState(widget?.config?.refreshEnabled !== false);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const [forceNextRefresh, setForceNextRefresh] = useState(false);
  const [showChartPicker, setShowChartPicker] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [fieldSearch, setFieldSearch] = useState('');
  const [editingPill, setEditingPill] = useState(null);
  const editingPillInputRef = useRef(null);

  const filteredDimensions = useMemo(() => {
    if (!fieldSearch.trim()) return allDimensions;
    const s = fieldSearch.toLowerCase();
    return allDimensions.filter(d => d.name.toLowerCase().includes(s) || d.parentEntity?.toLowerCase().includes(s) || d.displayName?.toLowerCase().includes(s));
  }, [allDimensions, fieldSearch]);

  const filteredMeasures = useMemo(() => {
    if (!fieldSearch.trim()) return viewMetadata?.measures || [];
    const s = fieldSearch.toLowerCase();
    return (viewMetadata?.measures || []).filter(m => m.name.toLowerCase().includes(s) || m.parentEntity?.toLowerCase().includes(s) || m.displayName?.toLowerCase().includes(s));
  }, [viewMetadata?.measures, fieldSearch]);

  // ── Calculated fields ──
  const [showFormulaBar, setShowFormulaBar] = useState(false);
  const [editingCalculatedField, setEditingCalculatedField] = useState(null);
  const [calcFieldDeleteError, setCalcFieldDeleteError] = useState(null);

  useEffect(() => { onFormulaEditingChange?.(showFormulaBar); }, [showFormulaBar, onFormulaEditingChange]);

  const filteredCalcFields = useMemo(() => {
    if (!fieldSearch.trim()) return customColumns;
    const s = fieldSearch.toLowerCase();
    return customColumns.filter(c => c.name.toLowerCase().includes(s) || c.displayName?.toLowerCase().includes(s));
  }, [customColumns, fieldSearch]);

  // Note: useCalcFieldsPersistence is called after columnAliases is declared (below)

  // ── Field type checking ──
  const isMeasureField = useCallback((field) => {
    const name = typeof field === 'object' && field !== null ? field.name : field;
    const normalized = normalizeFieldName(name);
    if ((viewMetadata?.measures || []).some(m => normalizeFieldName(m.name) === normalized)) return true;
    const calcField = customColumns.find(c => normalizeFieldName(c.name) === normalized);
    if (calcField) {
      const expr = (calcField.expression || '').toUpperCase();
      return /SUM\(|AVG\(|COUNT\(|MIN\(|MAX\(|MEDIAN\(|STDDEV\(|VARIANCE\(/.test(expr);
    }
    return false;
  }, [viewMetadata, normalizeFieldName, customColumns]);

  const isDimensionField = useCallback((field) => {
    const name = typeof field === 'object' && field !== null ? field.name : field;
    const normalized = normalizeFieldName(name);
    if (allDimensions.some(d => normalizeFieldName(d.name) === normalized)) return true;
    const calcField = customColumns.find(c => normalizeFieldName(c.name) === normalized);
    if (calcField) {
      const expr = (calcField.expression || '').toUpperCase();
      return !/SUM\(|AVG\(|COUNT\(|MIN\(|MAX\(|MEDIAN\(|STDDEV\(|VARIANCE\(/.test(expr);
    }
    return false;
  }, [allDimensions, normalizeFieldName, customColumns]);

  // ── Mark fields state ──
  const [markFields, setMarkFields] = useState(() => {
    if (widget?.markFields?.length) return widget.markFields;
    const existingMarks = widget?.marks || {};
    const fields = [];
    const addedFields = new Set();
    if (existingMarks.color) { fields.push({ field: existingMarks.color, type: 'color' }); addedFields.add(existingMarks.color); }
    if (existingMarks.size) { fields.push({ field: existingMarks.size, type: 'size' }); addedFields.add(existingMarks.size); }
    if (existingMarks.label) { fields.push({ field: existingMarks.label, type: 'label' }); addedFields.add(existingMarks.label); }
    (existingMarks.detail || []).forEach(f => { if (!addedFields.has(f)) { fields.push({ field: f, type: 'detail' }); addedFields.add(f); } });
    (existingMarks.tooltip || []).forEach(f => { if (!addedFields.has(f)) { fields.push({ field: f, type: 'tooltip' }); addedFields.add(f); } });
    (getFieldsByPlacement(widget?.fieldsUsed, 'value') || []).forEach(f => { if (!addedFields.has(f)) { fields.push({ field: f, type: null }); addedFields.add(f); } });
    return fields;
  });

  // ── Field aggregations, mark types, field configs ──
  const [fieldAggregations, _setFieldAggregationsRaw] = useState(() => {
    const aggs = {};
    if (widget?.fields?.length > 0) {
      widget.fields.forEach(f => { if (f.aggregation && f.name) aggs[f.name] = f.aggregation; });
      if (Object.keys(aggs).length > 0) return aggs;
    }
    if (widget?.config?.fieldAggregations) Object.assign(aggs, widget.config.fieldAggregations);
    widget?.fieldsUsed?.forEach(f => { if (f.aggregation && f.name) aggs[f.name] = f.aggregation; });
    return aggs;
  });
  const setFieldAggregations = useCallback((updater) => { isStabilizingRef.current = false; _setFieldAggregationsRaw(updater); }, []);

  const [fieldMarkTypes, setFieldMarkTypes] = useState(() => {
    const mt = {};
    if (widget?.fields?.length > 0) {
      widget.fields.forEach(f => { if (f.markType && f.name) mt[f.name] = f.markType; });
      if (Object.keys(mt).length > 0) return mt;
    }
    return widget?.config?.fieldMarkTypes || {};
  });

  useEffect(() => {
    setMarkFields(prev => {
      const updated = prev.map(mf => {
        const newType = fieldMarkTypes[mf.field] ?? mf.type;
        return newType !== mf.type ? { ...mf, type: newType } : mf;
      });
      return updated.some((mf, i) => mf !== prev[i]) ? updated : prev;
    });
  }, [fieldMarkTypes]);

  const [fieldConfigs, setFieldConfigs] = useState(() => widget?.config?.fieldConfigs || {});

  // ── External sync (AI assistant updates) ──
  useEffect(() => {
    const currentFieldsJson = widget?.fields ? JSON.stringify(widget.fields) : '';
    if (currentFieldsJson === lastExternalFieldsRef.current) return;
    if (internalUpdateRef.current) {
      internalUpdateRef.current = false;
      lastExternalFieldsRef.current = currentFieldsJson;
      return;
    }
    lastExternalFieldsRef.current = currentFieldsJson;
    if (!widget?.fields?.length) return;

    log('[WidgetEditor] External widget change detected — re-syncing local state');
    _setColumnsRaw(widget.fields.filter(f => f.shelf === 'columns').map(f => stripEntityPrefix(f.name)));
    _setRowsRaw(widget.fields.filter(f => f.shelf === 'rows').map(f => stripEntityPrefix(f.name)));
    const newMF = widget.fields.filter(f => f.shelf === 'marks').map(f => ({ field: stripEntityPrefix(f.name), type: f.markType || null }));
    if (newMF.length > 0) setMarkFields(newMF);
    const newAggs = {}; widget.fields.forEach(f => { if (f.aggregation && f.name) newAggs[f.name] = f.aggregation; });
    _setFieldAggregationsRaw(newAggs);
    const newMT = {}; widget.fields.forEach(f => { if (f.markType && f.name) newMT[f.name] = f.markType; });
    setFieldMarkTypes(newMT);
    const newAliases = {}; widget.fields.forEach(f => { if (f.alias && f.name) newAliases[f.name] = f.alias; });
    if (Object.keys(newAliases).length > 0) setColumnAliases(newAliases);
    if (widget.title && widget.title !== title) setTitle(widget.title);
    if (widget.type && widget.type !== widgetType) setWidgetType(widget.type);
  }, [widget?.fields, widget?.title, widget?.type]);

  // ── Sort/filter pill handlers ──
  const handlePillToggleSort = useCallback((fieldName, currentDirection) => {
    if (!currentDirection) addSort(fieldName);
    else if (currentDirection === 'ASC') updateSortDirection(fieldName, 'DESC');
    else removeSort(fieldName);
  }, [addSort, updateSortDirection, removeSort]);

  const handlePillAddFilter = useCallback((fieldName, event) => {
    openFilterPopup({ name: fieldName }, event);
  }, [openFilterPopup]);

  // ── Derived marks (legacy format) ──
  const marks = useMemo(() => {
    const result = { color: null, cluster: null, size: null, label: null, detail: [], tooltip: [] };
    markFields.forEach(mf => {
      if (mf.type === 'color') result.color = mf.field;
      else if (mf.type === 'cluster') result.cluster = mf.field;
      else if (mf.type === 'size') result.size = mf.field;
      else if (mf.type === 'label') result.label = mf.field;
      else if (mf.type === 'detail') result.detail.push(mf.field);
      else if (mf.type === 'tooltip') result.tooltip.push(mf.field);
    });
    return result;
  }, [markFields]);

  // ── DnD hook ──
  const {
    draggedField, dragSource, dragOverZone, dragOverIndex, dragOverShelf,
    setDragOverZone, setDragOverIndex,
    handleFieldDragStart, handleFieldDragEnd, handleShelfDragOver, handleShelfDragLeave, handleShelfDrop,
    removeFromShelf, handlePillDragStart, handlePillDragEnd, handleDragOver, handleDragLeave, handleDrop, removeFromZone,
  } = useDragDrop({ columns, rows, values, setColumns, setRows, setValues, setMarkFields, customColumns, sorts, setSorts });

  // ── Format options ──
  const [fontSize, setFontSize] = useState(widget?.config?.fontSize || getFormatDefaults(widget?.type || 'table').fontSize);
  const [textColor, setTextColor] = useState(widget?.config?.textColor || getFormatDefaults(widget?.type || 'table').textColor);
  const [labelColor, setLabelColor] = useState(widget?.config?.labelColor || getFormatDefaults(widget?.type || 'table').labelColor);
  const [numberFormat, setNumberFormat] = useState(widget?.config?.numberFormat || 'auto');
  const [decimalPlaces, setDecimalPlaces] = useState(widget?.config?.decimalPlaces ?? 2);

  // ── Column aliases ──
  const [columnAliases, setColumnAliases] = useState(() => {
    const aliases = {};
    if (widget?.fields?.length > 0) {
      widget.fields.forEach(f => { if (f.alias && f.name) aliases[f.name] = f.alias; });
      if (Object.keys(aliases).length > 0) return aliases;
    }
    const viewId = widget?.semanticViewsReferenced?.[0]?.name || widget?.semanticViewId;
    if (viewId && currentDashboard?.semanticViewsReferenced) {
      const dv = currentDashboard.semanticViewsReferenced.find(v => (typeof v === 'string' ? v : v.name) === viewId);
      if (dv && typeof dv === 'object' && dv.columnAliases) return dv.columnAliases;
    }
    return widget?.config?.columnAliases || {};
  });

  // Persist calc fields to dashboard-level (extracted hook)
  useCalcFieldsPersistence({
    customColumns, setCustomColumns,
    columnAliases, setColumnAliases,
    semanticViewId, semanticViews, ensureCalcFieldIds,
  });

  const chartPickerRef = useRef(null);
  const chartConfig = getChartConfig(widgetType);

  // ── Unified widget config (SSOT) ──
  const {
    config: widgetConfig, fields: configFields,
    dimensions: configDimensions, measures: configMeasures,
    semanticViewFQN, isValid: configIsValid,
    getFieldMetadata, getSemanticType,
  } = useWidgetConfig({
    semanticViewId, semanticViews, viewMetadata,
    columns, rows, values, markFields, fieldMarkTypes, fieldAggregations,
    columnAliases, filters, sorts, customColumns,
    connectionId: currentDashboard?.connection_id,
    role: currentDashboard?.role,
    warehouse: currentDashboard?.warehouse,
  });

  // ── Live SQL preview ──
  const { liveQueryPreview, dimensions: previewDimensions, measures: previewMeasures, previewLoading } = useQueryPreview({ config: widgetConfig });

  // ── Auto-save and global sync (extracted hook) ──
  useEditorSync({
    widget, isNew, onAutoSave,
    title, widgetType, columns, rows, values, filters, sorts,
    customColumns, customConfig, semanticViewId, semanticViews,
    getColorConfig, markFields, fieldMarkTypes, fieldAggregations,
    columnAliases, colorPreset, customScheme, refreshEnabled,
    widgetConfig, configDimensions, configMeasures, semanticViewFQN,
    viewMetadata, internalUpdateRef, isStabilizingRef, mountTimeRef,
    fieldConfigs,
  });

  // ── Chart picker close ──
  useEffect(() => {
    if (!showChartPicker) return;
    const handler = (e) => { if (chartPickerRef.current && !chartPickerRef.current.contains(e.target)) { setShowChartPicker(false); setExpandedCategory(null); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showChartPicker]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { if (showFormulaBar) return; onClose(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSave(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, showFormulaBar]);

  // ── Chart type migration ──
  useEffect(() => {
    if (widgetType !== prevWidgetType) {
      const prevOptions = CHART_FORMAT_OPTIONS[prevWidgetType] || {};
      const newOptions = CHART_FORMAT_OPTIONS[widgetType] || {};
      const newDefaults = getFormatDefaults(widgetType);
      const migratedConfig = { ...newDefaults };
      ['showGrid', 'showLabels', 'showLegend', 'showDots', 'animate', 'labelColor', 'showTotals'].forEach(key => {
        if (prevOptions[key] && newOptions[key] && customConfig[key] !== undefined) migratedConfig[key] = customConfig[key];
      });
      migratedConfig.colorPreset = colorPreset;
      migratedConfig.fontSize = fontSize;
      setCustomConfig(migratedConfig);
      if (migratedConfig.labelColor !== labelColor) setLabelColor(migratedConfig.labelColor);
      setPrevWidgetType(widgetType);
    }
  }, [widgetType, prevWidgetType, customConfig, colorPreset, fontSize, labelColor]);

  // ── Smart defaults for new widgets ──
  const smartDefaultsAppliedRef = useRef(false);
  useEffect(() => {
    if (!isNew || smartDefaultsAppliedRef.current || !viewMetadata) return;
    if (columns.length > 0 || rows.length > 0) return;
    const dims = viewMetadata?.dimensions || [];
    const measures = viewMetadata?.measures || [];
    if (dims.length > 0 || measures.length > 0) {
      const newCols = [], newRows = [];
      if (dims.length > 0) newCols.push({ name: dims[0].name, fieldType: 'dimension', aggregation: 'NONE' });
      if (measures.length > 0) newRows.push({ name: measures[0].name, fieldType: 'measure', aggregation: 'NONE' });
      if (newCols.length > 0) setColumns(newCols);
      if (newRows.length > 0) setRows(newRows);
      if (newCols.length > 0 && newRows.length > 0) setWidgetType('bar');
      else if (newRows.length > 0) setWidgetType('kpi');
      else setWidgetType('table');
      smartDefaultsAppliedRef.current = true;
    }
  }, [isNew, viewMetadata, columns.length, rows.length]);

  // ── Field helpers (using extracted utils) ──
  const handleUpdateFieldAggregation = (shelf, idx, aggregation) => {
    updateFieldAggHelper(shelf, idx, aggregation, {
      columns, rows, values, setColumns, setRows, setValues, setFieldAggregations, setAggDropdown,
    });
  };

  const getFieldAggregation = (field) => {
    if (typeof field === 'object' && field !== null) return field.aggregation || null;
    return null;
  };

  const getAggregationLabel = (aggregation) => {
    if (!aggregation) return null;
    const opt = AGGREGATION_OPTIONS.find(o => o.value === aggregation);
    return opt ? opt.label : aggregation;
  };

  const onDeleteCalculatedField = (col) => {
    deleteCalcFieldHelper(col, {
      columns, rows, markFields,
      setCustomColumns, setCalcFieldDeleteError,
      currentDashboard, semanticViewId,
    });
  };

  // ── handleSave ──
  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { setTitleError('Title is required'); return; }
    setTitleError('');

    const fullyQualifiedName = widgetConfig.semanticView;
    const semanticViewsReferenced = semanticViewId ? [{
      name: semanticViewId,
      fullyQualifiedName: fullyQualifiedName || semanticViewId,
      calculatedFields: customColumns,
    }] : [];

    if ((customColumns.length > 0 || Object.keys(columnAliases).length > 0) && currentDashboard && semanticViewId) {
      const dashboardViews = [...(currentDashboard.semanticViewsReferenced || [])];
      const existingIdx = dashboardViews.findIndex(v => (typeof v === 'string' ? v : v.name) === semanticViewId);
      let updatedViews;
      if (existingIdx >= 0) {
        const existing = dashboardViews[existingIdx];
        const mergedCalc = [...(existing.calculatedFields || [])];
        customColumns.forEach(cc => { const i = mergedCalc.findIndex(cf => cf.name === cc.name); if (i >= 0) mergedCalc[i] = cc; else mergedCalc.push(cc); });
        const mergedAliases = { ...(existing.columnAliases || {}), ...columnAliases };
        Object.keys(mergedAliases).forEach(k => { if (!mergedAliases[k]) delete mergedAliases[k]; });
        updatedViews = [...dashboardViews];
        updatedViews[existingIdx] = { ...existing, calculatedFields: mergedCalc, columnAliases: mergedAliases };
      } else {
        updatedViews = [...dashboardViews, { name: semanticViewId, fullyQualifiedName: fullyQualifiedName || semanticViewId, calculatedFields: customColumns, columnAliases }];
      }
      const { updateDashboard } = useAppStore.getState();
      updateDashboard(currentDashboard.id, { semanticViewsReferenced: updatedViews });
    }

    onSave({
      title: trimmedTitle, type: widgetType,
      semanticView: fullyQualifiedName,
      fields: widgetConfig.fields, filters: widgetConfig.filters,
      sorts: widgetConfig.sorts, customColumns: widgetConfig.customColumns,
      queryDimensions: configDimensions, queryMeasures: configMeasures,
      semanticViewsReferenced,
      marks, markFields,
      config: {
        ...customConfig, ...getColorConfig(),
        fontSize, textColor, labelColor, columnAliases,
        numberFormat, decimalPlaces, fieldAggregations, fieldMarkTypes, fieldConfigs,
      },
    });
  };

  // ── Collapsible sections ──
  const [expandedSections, setExpandedSections] = useState({
    fields: false, shelves: true, filters: false, format: false, mapConfig: true, copilot: false,
  });
  const toggleSection = (section) => setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));

  const onViewChange = useCallback(() => {
    setColumns([]); setRows([]); setValues([]); setMarkFields([]); setFilters([]); setSorts([]);
  }, [setColumns, setRows, setFilters, setSorts]);

  // ── Render ──
  return (
    <div className="widget-editor-embedded">
      <EditorHeader
        title={title} setTitle={setTitle} titleError={titleError} setTitleError={setTitleError}
        refreshEnabled={refreshEnabled} setRefreshEnabled={setRefreshEnabled}
        pendingRefresh={pendingRefresh} setPendingRefresh={setPendingRefresh}
        setForceNextRefresh={setForceNextRefresh}
        sqlPreviewDropdown={sqlPreviewDropdown} setSqlPreviewDropdown={setSqlPreviewDropdown}
        onClose={onClose}
      />

      {(loadingMetadata || loading) && (
        <div className="embedded-loading-bar top"><div className="loading-bar-progress" /></div>
      )}

      <div className="embedded-editor-body sidebar-mode">
        <div className="embedded-config-panel">
          {widgetType === 'title' && (
            <TitleWidgetConfig customConfig={customConfig} setCustomConfig={setCustomConfig} />
          )}

          {widgetType === 'filter' && (
            <FilterWidgetConfig
              semanticViewId={semanticViewId} setSemanticViewId={setSemanticViewId}
              semanticViews={semanticViews} widgetType={widgetType} setWidgetType={setWidgetType}
              onViewChange={onViewChange} viewMetadata={viewMetadata}
              customConfig={customConfig} setCustomConfig={setCustomConfig}
            />
          )}

          {widgetType !== 'title' && widgetType !== 'filter' && (
            <>
              <DataSourceSection
                semanticViewId={semanticViewId} setSemanticViewId={setSemanticViewId}
                semanticViews={semanticViews} widgetType={widgetType} setWidgetType={setWidgetType}
                onViewChange={onViewChange}
              />
              <FieldsSection
                expanded={expandedSections.fields} toggleSection={toggleSection}
                viewMetadata={viewMetadata} allDimensions={allDimensions}
                customColumns={customColumns} setCustomColumns={setCustomColumns}
                loadingMetadata={loadingMetadata} setFieldTooltip={setFieldTooltip}
                showFormulaBar={showFormulaBar} setShowFormulaBar={setShowFormulaBar}
                editingCalculatedField={editingCalculatedField} setEditingCalculatedField={setEditingCalculatedField}
                calcFieldDeleteError={calcFieldDeleteError} setCalcFieldDeleteError={setCalcFieldDeleteError}
                handleDeleteCalculatedField={onDeleteCalculatedField}
              />
              <ShelvesSection
                expanded={expandedSections.shelves} toggleSection={toggleSection}
                columns={columns} setColumns={setColumns} rows={rows} setRows={setRows}
                columnAliases={columnAliases} setColumnAliases={setColumnAliases}
                fieldAggregations={fieldAggregations} setFieldAggregations={setFieldAggregations}
                fieldMarkTypes={fieldMarkTypes} setFieldMarkTypes={setFieldMarkTypes}
                sorts={sorts} onToggleSort={handlePillToggleSort} onAddFilter={handlePillAddFilter}
                removeFromShelf={removeFromShelf} shelfPopup={shelfPopup} setShelfPopup={setShelfPopup}
                setPendingColumns={setPendingColumns} setPendingRows={setPendingRows}
                dragOverZone={dragOverZone} setDragOverZone={setDragOverZone}
                dragOverIndex={dragOverIndex} setDragOverIndex={setDragOverIndex}
                handleDrop={handleDrop} handlePillDragStart={handlePillDragStart} handlePillDragEnd={handlePillDragEnd}
              />
              <FiltersSortsSection
                expanded={expandedSections.filters} toggleSection={toggleSection}
                filters={filters} showFilterPanel={showFilterPanel} setShowFilterPanel={setShowFilterPanel}
                openFilterPopup={openFilterPopup} removeFilter={removeFilter} getFilterForField={getFilterForField}
                sorts={sorts} showSortPanel={showSortPanel} setShowSortPanel={setShowSortPanel}
                addSort={addSort} removeSort={removeSort} updateSortDirection={updateSortDirection}
                moveSortUp={moveSortUp} moveSortDown={moveSortDown}
                allDimensions={allDimensions} measures={viewMetadata?.measures}
                customColumns={customColumns} columns={columns} rows={rows}
              />
              <FormattingSection
                expanded={expandedSections.format} toggleSection={toggleSection}
                widgetType={widgetType} colorPreset={colorPreset} setColorPreset={setColorPreset}
                customScheme={customScheme} setCustomScheme={setCustomScheme}
                numberFormat={numberFormat} setNumberFormat={setNumberFormat}
                decimalPlaces={decimalPlaces} setDecimalPlaces={setDecimalPlaces}
                customConfig={customConfig} setCustomConfig={setCustomConfig}
                allFields={[...columns, ...rows]}
                fieldConfigs={fieldConfigs} setFieldConfigs={setFieldConfigs}
              />
              {(widgetType === 'choropleth' || widgetType === 'hexbin') && (
                <MapConfigSection
                  expanded={expandedSections.mapConfig} toggleSection={toggleSection}
                  widgetType={widgetType} customConfig={customConfig} setCustomConfig={setCustomConfig}
                  columns={columns} rows={rows}
                />
              )}
              <EditorCopilot
                expanded={expandedSections.copilot} toggleSection={toggleSection}
                widget={widget} widgetType={widgetType} semanticViewId={semanticViewId}
                columns={columns} rows={rows} filters={filters} sorts={sorts}
                customColumns={customColumns} viewMetadata={viewMetadata}
                fieldMarkTypes={fieldMarkTypes} setWidgetType={setWidgetType}
                setColumns={setColumns} setRows={setRows} setTitle={setTitle}
                setFilters={setFilters} setSorts={setSorts}
                setFieldMarkTypes={setFieldMarkTypes} setCustomColumns={setCustomColumns}
              />
            </>
          )}
        </div>
      </div>

      <SqlPreviewDropdown
        sqlPreviewDropdown={sqlPreviewDropdown} setSqlPreviewDropdown={setSqlPreviewDropdown}
        liveQueryPreview={liveQueryPreview} copiedSql={copiedSql} setCopiedSql={setCopiedSql}
        widgetConfig={widgetConfig}
      />
      <FieldTooltip fieldTooltip={fieldTooltip} />
      <ShelfPopup
        shelfPopup={shelfPopup} setShelfPopup={setShelfPopup} setFieldTooltip={setFieldTooltip}
        allDimensions={allDimensions} measures={viewMetadata?.measures}
        customColumns={customColumns} columns={columns} rows={rows}
        pendingColumns={pendingColumns} setPendingColumns={setPendingColumns}
        pendingRows={pendingRows} setPendingRows={setPendingRows}
        setColumns={setColumns} setRows={setRows}
      />
      <AggregationDropdown
        aggDropdown={aggDropdown} setAggDropdown={setAggDropdown}
        columns={columns} rows={rows}
        getFieldAggregation={getFieldAggregation} updateFieldAggregation={handleUpdateFieldAggregation}
      />
      <FilterPopup
        filterPopup={filterPopup} setFilterPopup={setFilterPopup}
        filterPopupRef={filterPopupRef} closeFilterPopup={closeFilterPopup}
        filterSearch={filterSearch} handleFilterSearchChange={handleFilterSearchChange}
        handleFilterListScroll={handleFilterListScroll} isValueSelected={isValueSelected}
        toggleFilterValue={toggleFilterValue} filters={filters} removeFilter={removeFilter}
        applyAdvancedFilter={applyAdvancedFilter} customExprRef={customExprRef}
        handleCustomExpressionChange={handleCustomExpressionChange}
        handleExprKeyDown={handleExprKeyDown} exprAutocomplete={exprAutocomplete}
        setExprAutocomplete={setExprAutocomplete} insertExprAutocomplete={insertExprAutocomplete}
      />
    </div>
  );
};

export default WidgetEditor;
