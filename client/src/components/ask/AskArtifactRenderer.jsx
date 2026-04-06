import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiTable, FiBarChart2, FiCode, FiMaximize2, FiMinimize2, FiDownload, FiChevronDown, FiImage } from 'react-icons/fi';
import DashboardArtifactRenderer from './AskDashboardRenderer';
import { exportElementToPng, downloadCsv as downloadCsvUtil } from '../../utils/exportUtils';
import { renderChart } from '../charts/ChartRenderer';

const MAX_CHART_ROWS = 200;

const CHART_TYPE_OPTIONS = [
  { group: 'Comparison', items: [
    { value: 'bar', label: 'Bar' },
    { value: 'horizontal-bar', label: 'Horizontal Bar' },
    { value: 'diverging-bar', label: 'Diverging Bar' },
  ]},
  { group: 'Trend', items: [
    { value: 'line', label: 'Line' },
    { value: 'area', label: 'Area' },
  ]},
  { group: 'Part of Whole', items: [
    { value: 'pie', label: 'Pie' },
    { value: 'donut', label: 'Donut' },
    { value: 'treemap', label: 'Treemap' },
    { value: 'funnel', label: 'Funnel' },
  ]},
  { group: 'Distribution', items: [
    { value: 'scatter', label: 'Scatter' },
    { value: 'heatmap', label: 'Heatmap' },
    { value: 'radar', label: 'Radar' },
    { value: 'waterfall', label: 'Waterfall' },
    { value: 'boxplot', label: 'Box Plot' },
    { value: 'histogram', label: 'Histogram' },
  ]},
  { group: 'Flow', items: [
    { value: 'sankey', label: 'Sankey' },
    { value: 'icicle', label: 'Icicle' },
  ]},
  { group: 'Geographic', items: [
    { value: 'choropleth', label: 'Choropleth Map' },
    { value: 'hexbin', label: 'Hexbin Map' },
  ]},
  { group: 'KPI', items: [
    { value: 'metric', label: 'Metric' },
    { value: 'gauge', label: 'Gauge' },
  ]},
  { group: 'Raw', items: [
    { value: 'table', label: 'Table' },
    { value: 'pivot', label: 'Pivot Table' },
  ]},
];

const ALL_CHART_TYPES = CHART_TYPE_OPTIONS.flatMap(g => g.items);

/**
 * Bridge from Ask artifact data shape → ChartRenderer data/config/query shape.
 *
 * Ask artifacts have:  { data: [{...}], columns: ['COL1','COL2'], widget: { fields, type } }
 * ChartRenderer needs: { data: { rows }, config: {...}, query: { xAxis, measures, ... } }
 */
function buildChartProps(flatData, columns, chartType, widget) {
  const rows = flatData || [];
  const cols = columns || (rows.length > 0 ? Object.keys(rows[0]) : []);

  const fields = widget?.fields || [];
  const hasShelves = fields.length > 0 && fields.some(f => f.shelf || f.semanticType);

  let xAxis = [];
  let measures = [];
  const fieldAggregations = {};
  const marks = { ...(widget?.marks || {}) };
  const detailFields = [];
  const tooltipFields = [];
  const labelFields = [];

  if (hasShelves) {
    for (const f of fields) {
      if (f.semanticType === 'measure' || f.shelf === 'rows') {
        measures.push(f.name);
        if (f.aggregation) fieldAggregations[f.name] = f.aggregation;
      } else if (f.markType === 'color' && !marks.color) {
        marks.color = f.name;
      } else if (f.markType === 'cluster' && !marks.cluster) {
        marks.cluster = f.name;
      } else if (f.markType === 'size' && !marks.size) {
        marks.size = f.name;
      } else if (f.markType === 'detail') {
        detailFields.push(f.name);
      } else if (f.markType === 'tooltip') {
        tooltipFields.push(f.name);
      } else if (f.markType === 'label') {
        labelFields.push(f.name);
      } else if (f.shelf === 'marks') {
        if (!marks.color) marks.color = f.name;
      } else {
        xAxis.push(f.name);
      }
    }
  } else {
    const numericCols = cols.filter(c => rows.some(r => typeof r[c] === 'number'));
    const nonNumericCols = cols.filter(c => !numericCols.includes(c));

    if (nonNumericCols.length > 0) {
      xAxis = [nonNumericCols[0]];
      measures = numericCols.length > 0 ? numericCols : cols.slice(1);
    } else if (cols.length >= 2) {
      xAxis = [cols[0]];
      measures = cols.slice(1);
    } else {
      xAxis = cols;
      measures = [];
    }
  }

  if (detailFields.length && !marks.detail) marks.detail = detailFields;
  if (tooltipFields.length && !marks.tooltip) marks.tooltip = tooltipFields;

  const data = { rows, columns: cols.map(c => ({ name: c })) };

  const config = {
    colorScheme: 'tableau10',
    showLegend: measures.length > 1 || !!marks.color,
    showLabels: false,
    showGrid: true,
    animate: true,
    stacked: chartType === 'stacked-bar',
    ...(widget?.config || {}),
  };

  const query = {
    xAxis,
    columns: xAxis,
    measures,
    rows: [],
    marks,
    labelFields,
    tooltipFields,
  };

  return { data, config, query, fieldAggregations };
}

function ArtifactRenderer({ artifact, connectionId }) {
  if (!artifact) return null;

  if (artifact.type === 'dashboard' && artifact.dashboard) {
    return <DashboardArtifactRenderer artifact={artifact} connectionId={connectionId} />;
  }

  if (artifact.type === 'widget' && artifact.widget) {
    return <WidgetRenderer artifact={artifact} />;
  }

  return <LegacyRenderer artifact={artifact} />;
}

function LegacyRenderer({ artifact }) {
  const [view, setView] = useState('chart');
  const [expanded, setExpanded] = useState(false);
  const { type, data, sql, columns, totalRows } = artifact;
  const [chartType, setChartType] = useState(type || 'bar');

  if (!data || data.length === 0) {
    return <EmptyState />;
  }

  const isTableType = chartType === 'table' || chartType === 'pivot';
  const showChart = !isTableType && columns?.length >= 2;

  const handleTypeChange = (newType) => {
    setChartType(newType);
    if (newType === 'table' || newType === 'pivot') {
      setView('table');
    } else if (view === 'table') {
      setView('chart');
    }
  };

  return (
    <ArtifactShell
      title={null}
      type={chartType}
      data={data}
      sql={sql}
      columns={columns}
      totalRows={totalRows}
      showChart={showChart}
      view={view}
      setView={setView}
      expanded={expanded}
      setExpanded={setExpanded}
      onChangeType={handleTypeChange}
    />
  );
}

function WidgetRenderer({ artifact }) {
  const [view, setView] = useState('chart');
  const [expanded, setExpanded] = useState(false);
  const { data, sql, columns, totalRows } = artifact;
  const widget = artifact.widget;
  const [chartType, setChartType] = useState(widget?.type || 'table');

  if (!data || data.length === 0) {
    return (
      <div className="ask-artifact-empty">
        <div className="ask-artifact-empty-title">{widget?.title || 'Widget'}</div>
        No data returned
      </div>
    );
  }

  const isTableType = chartType === 'table' || chartType === 'pivot';
  const showChart = !isTableType && columns?.length >= 1;

  const handleTypeChange = (newType) => {
    setChartType(newType);
    if (newType === 'table' || newType === 'pivot') {
      setView('table');
    } else if (view === 'table') {
      setView('chart');
    }
  };

  return (
    <ArtifactShell
      title={widget?.title}
      type={chartType}
      data={data}
      sql={sql}
      columns={columns}
      totalRows={totalRows}
      showChart={showChart}
      view={view}
      setView={setView}
      expanded={expanded}
      setExpanded={setExpanded}
      widget={widget}
      onChangeType={handleTypeChange}
    />
  );
}

function ArtifactShell({ title, type, data, sql, columns, totalRows, showChart, view, setView, expanded, setExpanded, widget, onChangeType }) {
  const captureRef = useRef(null);
  const expandedRef = useRef(null);

  const chartData = useMemo(
    () => data?.length > MAX_CHART_ROWS ? data.slice(0, MAX_CHART_ROWS) : data,
    [data],
  );

  const chartProps = useMemo(
    () => buildChartProps(chartData, columns, type, widget),
    [chartData, columns, type, widget],
  );

  const tableProps = useMemo(
    () => buildChartProps(data, columns, 'table', widget),
    [data, columns, widget],
  );

  const renderContent = (isExpanded) => {
    if (view === 'sql') return <SqlView sql={sql} />;

    const isTable = view === 'table';
    const effectiveType = isTable ? 'table' : type;
    const props = isTable ? tableProps : chartProps;
    const chartKey = `ask-${widget?.id || 'legacy'}-${effectiveType}${isExpanded ? '-exp' : ''}`;

    const height = isExpanded ? '100%' : (isTable ? 320 : 420);
    const minH = isExpanded ? 0 : (isTable ? 0 : 420);

    return (
      <div style={{ width: '100%', height, minHeight: minH, maxHeight: isTable && !isExpanded ? 320 : undefined, overflow: isTable ? 'auto' : undefined }}>
        {renderChart(effectiveType, props.data, props.config, props.query, chartKey)}
      </div>
    );
  };

  return (
    <>
      <div className="ask-artifact-card">
        <ToolbarRow title={title} type={type} showChart={showChart} view={view} setView={setView}
          data={data} columns={columns} totalRows={totalRows} expanded={expanded} setExpanded={setExpanded} sql={sql} onChangeType={onChangeType} captureRef={expanded ? expandedRef : captureRef} />
        {!expanded && (
          <div ref={captureRef}>
            {renderContent(false)}
          </div>
        )}
        {expanded && <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Viewing in expanded mode</div>}
      </div>
      {expanded && createPortal(
        <>
          <div className="ask-artifact-expanded-overlay" onClick={() => setExpanded(false)} />
          <div className="ask-artifact-expanded">
            <ToolbarRow title={title} type={type} showChart={showChart} view={view} setView={setView}
              data={data} columns={columns} totalRows={totalRows} expanded={expanded} setExpanded={setExpanded} sql={sql} onChangeType={onChangeType} captureRef={expandedRef} />
            <div ref={expandedRef} style={{ flex: 1, minHeight: 0 }}>
              {renderContent(true)}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function ToolbarRow({ title, type, showChart, view, setView, data, columns, totalRows, expanded, setExpanded, sql, onChangeType, captureRef }) {
  const handleExportPng = () => {
    const el = captureRef?.current;
    if (el) exportElementToPng(el, `${(title || type || 'widget').replace(/[^a-zA-Z0-9 ]/g, '')}.png`);
  };

  return (
    <div className="ask-toolbar">
      <div className="ask-toolbar-left">
        {title && <span className="ask-toolbar-title">{title}</span>}
        {showChart && (
          <button
            onClick={() => setView('chart')}
            className={`ask-toolbar-tab ${view === 'chart' ? 'active' : ''}`}
          >
            <FiBarChart2 /> Chart
          </button>
        )}
        <button
          onClick={() => setView('table')}
          className={`ask-toolbar-tab ${view === 'table' ? 'active' : ''}`}
        >
          <FiTable /> Data
        </button>
        {sql && (
          <button
            onClick={() => setView('sql')}
            className={`ask-toolbar-tab ${view === 'sql' ? 'active' : ''}`}
          >
            <FiCode /> SQL
          </button>
        )}
        {onChangeType && <ChartTypePicker currentType={type} onChange={onChangeType} />}
      </div>

      <div className="ask-toolbar-right">
        <span className="ask-toolbar-meta">
          {totalRows != null ? `${totalRows.toLocaleString()} rows` : `${data.length} rows`}
        </span>
        <button onClick={() => downloadCsvUtil(data, columns, `${(title || 'data').replace(/[^a-zA-Z0-9 ]/g, '')}.csv`)} className="ask-toolbar-icon-btn" title="Download CSV">
          <FiDownload />
        </button>
        <button onClick={handleExportPng} className="ask-toolbar-icon-btn" title="Export as PNG">
          <FiImage />
        </button>
        <button onClick={() => setExpanded(!expanded)} className="ask-toolbar-icon-btn" title={expanded ? 'Minimize' : 'Expand'}>
          {expanded ? <FiMinimize2 /> : <FiMaximize2 />}
        </button>
      </div>
    </div>
  );
}

function ChartTypePicker({ currentType, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentLabel = ALL_CHART_TYPES.find(o => o.value === currentType)?.label || currentType;

  return (
    <div className="ask-type-picker" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="ask-type-picker-btn"
        title="Change chart type"
      >
        {currentLabel} <FiChevronDown className={open ? 'open' : ''} />
      </button>
      {open && (
        <div className="ask-type-dropdown">
          {CHART_TYPE_OPTIONS.map((group, gi) => (
            <div key={group.group}>
              {gi > 0 && <div className="ask-type-group-sep" />}
              <div className="ask-type-group-label">{group.group}</div>
              {group.items.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`ask-type-option ${opt.value === currentType ? 'active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="ask-artifact-empty">
      No data returned
    </div>
  );
}

function SqlView({ sql }) {
  return (
    <div className="ask-sql-wrap">
      <pre className="ask-sql-pre">{sql}</pre>
    </div>
  );
}

export default React.memo(ArtifactRenderer);
