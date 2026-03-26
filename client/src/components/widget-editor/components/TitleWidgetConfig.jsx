import React from 'react';

const TitleWidgetConfig = ({ customConfig, setCustomConfig }) => (
  <div className="editor-section">
    <div className="section-content" style={{ padding: '12px' }}>
      <label className="config-label">Heading Text</label>
      <input
        type="text"
        className="config-input"
        value={customConfig.titleText || ''}
        onChange={e => setCustomConfig(prev => ({ ...prev, titleText: e.target.value }))}
        placeholder="Dashboard Title"
      />
      <label className="config-label" style={{ marginTop: 10 }}>Subtitle</label>
      <input
        type="text"
        className="config-input"
        value={customConfig.subtitle || ''}
        onChange={e => setCustomConfig(prev => ({ ...prev, subtitle: e.target.value }))}
        placeholder="Optional subtitle text"
      />
      <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="config-label">Alignment</label>
          <select
            className="config-select"
            value={customConfig.titleAlign || 'left'}
            onChange={e => setCustomConfig(prev => ({ ...prev, titleAlign: e.target.value }))}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label className="config-label">Font Size</label>
          <input
            type="number"
            className="config-input"
            value={customConfig.titleFontSize || 22}
            onChange={e => setCustomConfig(prev => ({ ...prev, titleFontSize: parseInt(e.target.value) || 22 }))}
            min={12}
            max={48}
          />
        </div>
      </div>
    </div>
  </div>
);

export default TitleWidgetConfig;
