import { useMemo } from 'react';

const DEBUG = import.meta.env.VITE_DEBUG === 'true';

const stripPrefix = (name) => {
  if (!name) return name;
  return name.includes('.') ? name.split('.').pop() : name;
};

/**
 * Parse the widget's field definitions and derive all the dimension/measure/mark
 * arrays needed for querying and chart rendering.
 *
 * Supports the unified `widget.fields` array (new format) and the
 * legacy `fieldsUsed` / `queryDimensions` / `queryMeasures` formats.
 */
export default function useWidgetFields(widget) {
  return useMemo(() => {
    if (DEBUG) {
      console.log('[useWidgetFields] Parsing widget config:', {
        hasUnifiedFields: !!widget.fields?.length,
        queryDimensions: widget.queryDimensions,
        queryMeasures: widget.queryMeasures,
      });
    }

    const marks = widget.marks || {};
    const visualMarkTypes = new Set(['color', 'cluster', 'detail', 'tooltip']);

    // ---------- UNIFIED FIELDS (new format) ----------
    if (widget.fields?.length > 0) {
      const isChartDimension = f => {
        if (f.semanticType !== 'dimension' && f.semanticType !== 'fact') return false;
        if (f.shelf === 'columns') return true;
        if (f.markType && visualMarkTypes.has(f.markType)) return true;
        return false;
      };

      const dims = widget.fields
        .filter(f => f.semanticType === 'dimension' || f.semanticType === 'fact')
        .map(f => stripPrefix(f.name));

      const columnsShelfNames = new Set(
        widget.fields.filter(f => f.shelf === 'columns').map(f => stripPrefix(f.name))
      );

      const meas = widget.fields
        .filter(f => f.semanticType === 'measure' && !columnsShelfNames.has(stripPrefix(f.name)))
        .map(f => stripPrefix(f.name));

      const aggFields = widget.fields
        .filter(f => f.aggregation)
        .map(f => ({ name: stripPrefix(f.name), aggregation: f.aggregation }));

      const aggDimOnRows = new Set(
        widget.fields
          .filter(f =>
            (f.semanticType === 'dimension' || f.semanticType === 'fact') &&
            f.shelf === 'rows' && f.aggregation
          )
          .map(f => stripPrefix(f.name))
      );

      const chartMeas = [...meas, ...aggDimOnRows];

      const colDims = widget.fields.filter(f => f.shelf === 'columns').map(f => stripPrefix(f.name));
      const rowDims = widget.fields.filter(f => f.shelf === 'rows' && isChartDimension(f)).map(f => stripPrefix(f.name));

      const colorField = stripPrefix(widget.fields.find(f => f.markType === 'color')?.name) || stripPrefix(marks.color) || null;
      const clusterField = stripPrefix(widget.fields.find(f => f.markType === 'cluster')?.name) || stripPrefix(marks.cluster) || null;

      const detailFields = widget.fields.filter(f => f.markType === 'detail').map(f => stripPrefix(f.name));
      if (detailFields.length === 0 && marks.detail) {
        (Array.isArray(marks.detail) ? marks.detail : [marks.detail]).forEach(d => {
          if (d && !detailFields.includes(stripPrefix(d))) detailFields.push(stripPrefix(d));
        });
      }

      const tooltipFields = widget.fields.filter(f => f.markType === 'tooltip').map(f => stripPrefix(f.name));
      if (tooltipFields.length === 0 && marks.tooltip) {
        (Array.isArray(marks.tooltip) ? marks.tooltip : [marks.tooltip]).forEach(t => {
          if (t && !tooltipFields.includes(stripPrefix(t))) tooltipFields.push(stripPrefix(t));
        });
      }

      const labelFields = widget.fields
        .filter(f =>
          (f.markType === 'label') ||
          ((f.semanticType === 'dimension' || f.semanticType === 'fact') &&
            f.shelf === 'rows' && !f.aggregation &&
            (!f.markType || !visualMarkTypes.has(f.markType)))
        )
        .map(f => stripPrefix(f.name));

      return {
        dimensions: dims, measures: meas, chartMeasures: chartMeas,
        aggregatedFields: aggFields,
        columnDimensions: colDims.filter(f => !meas.includes(f)),
        rowDimensions: rowDims.filter(f => !meas.includes(f)),
        colorField, clusterField, detailFields, tooltipFields, labelFields,
        liveWidgetType: null, liveSemanticViewId: null, queryConfig: null,
      };
    }

    // ---------- LEGACY FORMAT ----------
    const fieldsUsed = widget.fieldsUsed || [];
    const aggFields = fieldsUsed.filter(f => f.aggregation).map(f => ({ name: stripPrefix(f.name), aggregation: f.aggregation }));

    const colFields = fieldsUsed.filter(f => f.placement === 'column').sort((a, b) => (a.order || 0) - (b.order || 0));
    const rowFields = fieldsUsed.filter(f => f.placement === 'row').sort((a, b) => (a.order || 0) - (b.order || 0));

    const colorMarkField = stripPrefix(marks.color) || null;
    const clusterMarkField = stripPrefix(marks.cluster) || null;
    const detailMarkFields = (marks.detail || []).map(stripPrefix);
    const tooltipMarkFields = (marks.tooltip || []).map(stripPrefix);
    const labelMarkFields = marks.label ? [stripPrefix(marks.label)] : [];

    const colDims = colFields.map(f => stripPrefix(f.name));
    const rowDims = rowFields.map(f => stripPrefix(f.name));

    let dims, meas;

    if (widget.queryDimensions && widget.queryMeasures) {
      dims = widget.queryDimensions.map(stripPrefix);
      meas = widget.queryMeasures.map(stripPrefix);
      if (colorMarkField && !dims.includes(colorMarkField) && !meas.includes(colorMarkField)) dims.push(colorMarkField);
      detailMarkFields.forEach(f => { if (!dims.includes(f) && !meas.includes(f)) dims.push(f); });
      tooltipMarkFields.forEach(f => { if (!dims.includes(f) && !meas.includes(f)) dims.push(f); });
    } else {
      dims = [];
      meas = [];
      const measureFieldNames = new Set(fieldsUsed.filter(f => f.placement === 'value').map(f => f.name));
      const isKnownMeasure = (name) => measureFieldNames.has(name) || fieldsUsed.find(f => f.name === name)?.type === 'measure';

      colFields.forEach(f => {
        if (isKnownMeasure(f.name)) { if (!meas.includes(f.name)) meas.push(f.name); }
        else { if (!dims.includes(f.name)) dims.push(f.name); }
      });
      rowFields.forEach(f => {
        if (isKnownMeasure(f.name)) { if (!meas.includes(f.name)) meas.push(f.name); }
        else { if (!dims.includes(f.name)) dims.push(f.name); }
      });
      measureFieldNames.forEach(name => { if (!meas.includes(name)) meas.push(name); });
      if (colorMarkField) {
        if (isKnownMeasure(colorMarkField)) { if (!meas.includes(colorMarkField)) meas.push(colorMarkField); }
        else { if (!dims.includes(colorMarkField)) dims.push(colorMarkField); }
      }
      detailMarkFields.forEach(f => { if (!dims.includes(f) && !meas.includes(f)) dims.push(f); });
      tooltipMarkFields.forEach(f => { if (!dims.includes(f) && !meas.includes(f)) dims.push(f); });
    }

    return {
      dimensions: dims, measures: meas, chartMeasures: meas,
      aggregatedFields: aggFields,
      columnDimensions: colDims.filter(f => !meas.includes(f)),
      rowDimensions: rowDims.filter(f => !meas.includes(f)),
      colorField: colorMarkField, clusterField: clusterMarkField,
      detailFields: detailMarkFields, tooltipFields: tooltipMarkFields,
      labelFields: labelMarkFields,
      liveWidgetType: null, liveSemanticViewId: null, queryConfig: null,
    };
  }, [widget.fieldsUsed, widget.marks, widget.queryDimensions, widget.queryMeasures, widget.fields]);
}
