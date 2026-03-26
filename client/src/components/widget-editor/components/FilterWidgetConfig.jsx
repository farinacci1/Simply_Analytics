import React from 'react';
import DataSourceSection from './DataSourceSection';

const FilterWidgetConfig = ({
  semanticViewId, setSemanticViewId, semanticViews,
  widgetType, setWidgetType,
  onViewChange, viewMetadata,
  customConfig, setCustomConfig,
}) => (
  <>
    <DataSourceSection
      semanticViewId={semanticViewId}
      setSemanticViewId={setSemanticViewId}
      semanticViews={semanticViews}
      widgetType={widgetType}
      setWidgetType={setWidgetType}
      onViewChange={onViewChange}
    />
    <div className="editor-section">
      <div className="section-content" style={{ padding: '12px' }}>
        <label className="config-label">Filter Label</label>
        <input
          type="text"
          className="config-input"
          value={customConfig.filterLabel || ''}
          onChange={e => setCustomConfig(prev => ({ ...prev, filterLabel: e.target.value }))}
          placeholder="e.g. Date Range, Region"
        />
        <label className="config-label" style={{ marginTop: 10 }}>Filter Field</label>
        <select
          className="config-select"
          value={customConfig.filterField || ''}
          onChange={e => setCustomConfig(prev => ({ ...prev, filterField: e.target.value }))}
        >
          <option value="">Select field...</option>
          {(viewMetadata?.dimensions || []).map(d => (
            <option key={d.name} value={d.name}>{d.name}</option>
          ))}
          {(viewMetadata?.measures || []).map(m => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
        </select>
        <label className="config-label" style={{ marginTop: 10 }}>Filter Type</label>
        <select
          className="config-select"
          value={customConfig.filterType || 'dropdown'}
          onChange={e => setCustomConfig(prev => ({ ...prev, filterType: e.target.value }))}
        >
          <option value="dropdown">Dropdown (Multi-select)</option>
          <option value="date-range">Date Range</option>
        </select>
      </div>
    </div>
  </>
);

export default FilterWidgetConfig;
