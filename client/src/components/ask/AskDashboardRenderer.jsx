import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiMaximize2, FiMinimize2, FiImage } from 'react-icons/fi';
import { exportElementToPng } from '../../utils/exportUtils';
import { renderChart } from '../charts/ChartRenderer';

const MAX_CHART_ROWS = 200;

function buildWidgetChartProps(widget, wData) {
  const allRows = wData?.data || [];
  const columns = wData?.columns || [];

  const fields = widget.fields || [];
  const hasShelves = fields.length > 0 && fields.some(f => f.shelf || f.semanticType);

  let xAxis = [];
  let measures = [];
  const fieldAggregations = {};
  const marks = { ...(widget?.marks || {}) };

  if (hasShelves) {
    for (const f of fields) {
      if (f.semanticType === 'measure' || f.shelf === 'rows') {
        measures.push(f.name);
        if (f.aggregation) fieldAggregations[f.name] = f.aggregation;
      } else if (f.markType === 'color' && !marks.color) {
        marks.color = f.name;
      } else if (f.markType === 'size' && !marks.size) {
        marks.size = f.name;
      } else if (f.shelf === 'marks' && !marks.color) {
        marks.color = f.name;
      } else {
        xAxis.push(f.name);
      }
    }
  } else {
    const numericCols = columns.filter(c => allRows.some(r => typeof r[c] === 'number'));
    const nonNumericCols = columns.filter(c => !numericCols.includes(c));

    if (nonNumericCols.length > 0) {
      xAxis = [nonNumericCols[0]];
      measures = numericCols.length > 0 ? numericCols : columns.slice(1);
    } else if (columns.length >= 2) {
      xAxis = [columns[0]];
      measures = columns.slice(1);
    } else {
      xAxis = columns;
      measures = [];
    }
  }

  const rows = allRows.length > MAX_CHART_ROWS ? allRows.slice(0, MAX_CHART_ROWS) : allRows;

  return {
    data: { rows, columns: columns.map(c => ({ name: c })) },
    config: {
      colorScheme: 'tableau10',
      showLegend: measures.length > 1 || !!marks.color,
      showLabels: false,
      showGrid: true,
      animate: true,
      ...(widget.config || {}),
    },
    query: {
      xAxis,
      columns: xAxis,
      measures,
      rows: [],
      marks,
      labelFields: [],
      tooltipFields: [],
    },
    fieldAggregations,
  };
}

function getWidgetSpan(widget) {
  const type = widget.type || 'bar';
  if (type === 'metric' || type === 'gauge') return 'small';
  if (type === 'table' || type === 'pivot') return 'full';
  return 'half';
}

function DashboardGrid({ widgets, widgetData, isExpanded }) {
  const metrics = [];
  const charts = [];

  for (const w of widgets) {
    const span = getWidgetSpan(w);
    if (span === 'small') metrics.push(w);
    else charts.push(w);
  }

  const minChartH = isExpanded ? 340 : 280;

  return (
    <div className="ask-dash-layout">
      {metrics.length > 0 && (
        <div className="ask-dash-metrics-row">
          {metrics.map(w => (
            <DashboardWidget key={w.id} widget={w} data={widgetData?.[w.id]} compact />
          ))}
        </div>
      )}
      <div className="ask-dash-charts-grid">
        {charts.map((w, idx) => {
          const span = getWidgetSpan(w);
          const isLast = idx === charts.length - 1;
          const halfCount = charts.filter(c => getWidgetSpan(c) !== 'full').length;
          const makeFull = span === 'full' || (isLast && halfCount % 2 === 1 && span === 'half');
          const isTable = w.type === 'table' || w.type === 'pivot';
          return (
            <div
              key={w.id}
              className={`ask-dash-chart-cell ${makeFull ? 'full-width' : ''}`}
              style={{
                minHeight: isTable ? undefined : minChartH,
                maxHeight: isTable ? 320 : undefined,
              }}
            >
              <DashboardWidget widget={w} data={widgetData?.[w.id]} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardArtifactRenderer({ artifact }) {
  const { dashboard, widgetData } = artifact;
  const [activeTab, setActiveTab] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const captureRef = useRef(null);
  const expandedRef = useRef(null);

  if (!dashboard?.tabs?.length) return null;

  const tabs = dashboard.tabs;
  const currentTab = tabs[activeTab] || tabs[0];
  const widgets = currentTab.widgets || [];
  const dashTitle = dashboard.title || currentTab.label || currentTab.title || 'Dashboard';

  return (
    <>
      <div className="ask-dash-card">
        <DashboardToolbar
          title={dashTitle}
          widgetCount={widgets.length}
          expanded={false}
          setExpanded={setExpanded}
          captureRef={captureRef}
        />
        <div ref={captureRef}>
          {tabs.length > 1 && (
            <TabBar tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
          )}
          <DashboardGrid widgets={widgets} widgetData={widgetData} isExpanded={false} />
        </div>
      </div>

      {expanded && createPortal(
        <>
          <div className="ask-dash-expanded-overlay" onClick={() => setExpanded(false)} />
          <div className="ask-dash-expanded">
            <DashboardToolbar
              title={dashTitle}
              widgetCount={widgets.length}
              expanded={true}
              setExpanded={setExpanded}
              captureRef={expandedRef}
            />
            <div ref={expandedRef} style={{ flex: 1, overflow: 'auto' }}>
              {tabs.length > 1 && (
                <TabBar tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
              )}
              <DashboardGrid widgets={widgets} widgetData={widgetData} isExpanded={true} />
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function TabBar({ tabs, activeTab, setActiveTab }) {
  return (
    <div className="ask-dash-tabs">
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(i)}
          className={`ask-dash-tab ${i === activeTab ? 'active' : ''}`}
        >
          {tab.label || tab.title || `Sheet ${i + 1}`}
        </button>
      ))}
    </div>
  );
}

function DashboardToolbar({ title, widgetCount, expanded, setExpanded, captureRef }) {
  const handleExportPng = () => {
    const el = captureRef?.current;
    if (el) exportElementToPng(el, `${title.replace(/[^a-zA-Z0-9 ]/g, '')}.png`);
  };

  return (
    <div className="ask-dash-toolbar">
      <div className="ask-dash-toolbar-left">
        <span className="ask-dash-toolbar-title">{title}</span>
        <span className="ask-dash-toolbar-count">{widgetCount} widget{widgetCount !== 1 ? 's' : ''}</span>
      </div>
      <div className="ask-dash-toolbar-right">
        <button onClick={handleExportPng} className="ask-dash-expand-btn" title="Export as PNG">
          <FiImage />
        </button>
        <button onClick={() => setExpanded(!expanded)} className="ask-dash-expand-btn" title={expanded ? 'Minimize' : 'Expand'}>
          {expanded ? <FiMinimize2 /> : <FiMaximize2 />}
        </button>
      </div>
    </div>
  );
}

const DashboardWidget = React.memo(function DashboardWidget({ widget, data, compact }) {
  const chartType = widget.type || 'bar';
  const rows = data?.data || [];
  const error = data?.error;

  const chartProps = useMemo(
    () => buildWidgetChartProps(widget, data),
    [widget, data],
  );

  if (compact && (chartType === 'metric' || chartType === 'gauge')) {
    const value = rows[0] ? Object.values(rows[0])[0] : '—';
    const formatted = typeof value === 'number'
      ? value >= 10000
        ? value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })
        : value.toLocaleString('en-US', { maximumFractionDigits: 2 })
      : value;

    return (
      <div className="ask-dash-metric-card">
        <div className="ask-dash-metric-value">{formatted}</div>
        <div className="ask-dash-metric-label">{widget.title || 'Metric'}</div>
      </div>
    );
  }

  const isTable = chartType === 'table' || chartType === 'pivot';

  return (
    <>
      <div className="ask-dash-widget-header">
        <h4 className="ask-dash-widget-title">{widget.title || 'Untitled'}</h4>
      </div>
      <div className="ask-dash-widget-body" style={isTable ? { overflow: 'auto' } : undefined}>
        {error ? (
          <div className="ask-dash-widget-center ask-dash-widget-error">{error}</div>
        ) : rows.length === 0 ? (
          <div className="ask-dash-widget-center ask-dash-widget-nodata">No data</div>
        ) : (
          <div style={{
            position: isTable ? 'relative' : 'absolute',
            inset: isTable ? undefined : '4px',
            width: isTable ? '100%' : undefined,
            overflow: isTable ? 'auto' : 'hidden',
          }}>
            {renderChart(chartType, chartProps.data, chartProps.config, chartProps.query, `dash-${widget.id}`)}
          </div>
        )}
      </div>
    </>
  );
});
