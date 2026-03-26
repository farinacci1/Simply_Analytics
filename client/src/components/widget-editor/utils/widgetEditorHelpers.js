import { useAppStore } from '../../../store/appStore';

const DEBUG = import.meta.env.VITE_DEBUG === 'true';
const log = (...args) => DEBUG && console.log(...args);

export const isFieldUsed = (fieldName, columns, rows, markFields) => {
  const inColumns = columns.some(c => (typeof c === 'object' ? c.name : c) === fieldName);
  const inRows = rows.some(r => (typeof r === 'object' ? r.name : r) === fieldName);
  return inColumns || inRows || markFields.some(mf => mf.field === fieldName);
};

export const getFieldUsageLocations = (fieldName, columns, rows, markFields) => {
  const locations = [];
  if (columns.some(c => (typeof c === 'object' ? c.name : c) === fieldName)) locations.push('Columns');
  if (rows.some(r => (typeof r === 'object' ? r.name : r) === fieldName)) locations.push('Rows');
  if (markFields.some(mf => mf.field === fieldName)) locations.push('Marks');
  return locations;
};

export const updateFieldAggregation = (shelf, idx, aggregation, { columns, rows, values, setColumns, setRows, setValues, setFieldAggregations, setAggDropdown }) => {
  const updateField = (fields) => fields.map((field, i) => {
    if (i !== idx) return field;
    const fieldObj = typeof field === 'string' ? { name: field, fieldType: 'dimension' } : { ...field };
    if (aggregation) fieldObj.aggregation = aggregation; else delete fieldObj.aggregation;
    return fieldObj;
  });

  if (shelf === 'columns') setColumns(updateField);
  if (shelf === 'rows') setRows(updateField);
  if (shelf === 'values') setValues(updateField);

  const targetFields = shelf === 'columns' ? columns : shelf === 'rows' ? rows : values;
  const targetField = targetFields[idx];
  const fieldName = typeof targetField === 'object' && targetField !== null ? targetField.name : targetField;
  if (fieldName) {
    setFieldAggregations(prev => ({ ...prev, [fieldName]: aggregation || null }));
  }
  setAggDropdown({ open: false, shelf: null, idx: null, x: 0, y: 0 });
};

export const handleDeleteCalculatedField = (col, {
  columns, rows, markFields,
  setCustomColumns, setCalcFieldDeleteError,
  currentDashboard, semanticViewId,
}) => {
  setCalcFieldDeleteError(null);

  if (isFieldUsed(col.name, columns, rows, markFields)) {
    const locations = getFieldUsageLocations(col.name, columns, rows, markFields);
    setCalcFieldDeleteError({
      fieldName: col.name,
      message: `Cannot delete "${col.displayName || col.name}" - it is currently in use in: ${locations.join(', ')}. Remove it from the chart first.`,
    });
    setTimeout(() => {
      setCalcFieldDeleteError(prev => prev?.fieldName === col.name ? null : prev);
    }, 5000);
    return;
  }

  setCustomColumns(prev => prev.filter(c => c.name !== col.name));

  if (currentDashboard && semanticViewId) {
    const dashboardViews = [...(currentDashboard.semanticViewsReferenced || [])];
    const viewIndex = dashboardViews.findIndex(v => (typeof v === 'string' ? v : v.name) === semanticViewId);

    if (viewIndex >= 0 && typeof dashboardViews[viewIndex] === 'object') {
      const updatedView = {
        ...dashboardViews[viewIndex],
        calculatedFields: (dashboardViews[viewIndex].calculatedFields || []).filter(cf => cf.name !== col.name),
      };
      const updatedViews = [...dashboardViews];
      updatedViews[viewIndex] = updatedView;
      const { updateDashboard } = useAppStore.getState();
      updateDashboard(currentDashboard.id, { semanticViewsReferenced: updatedViews });
      log('Removed calculated field from dashboard:', col.name);
    }
  }
};
