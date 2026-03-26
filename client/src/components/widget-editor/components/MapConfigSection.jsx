import React, { useCallback, useRef, useMemo } from 'react';
import { FiMap, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { GEO_LAYERS } from '../../charts/mapCharts/geoData';

const MapConfigSection = ({
  expanded, toggleSection, widgetType, customConfig, setCustomConfig,
  columns, rows,
}) => {
  const fileInputRef = useRef(null);
  const geoConfig = customConfig?.geoConfig || {};

  const updateGeoConfig = useCallback((patch) => {
    setCustomConfig(prev => ({
      ...prev,
      geoConfig: { ...(prev?.geoConfig || {}), ...patch },
    }));
  }, [setCustomConfig]);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        const props = parsed.features?.[0]?.properties
          ? Object.keys(parsed.features[0].properties) : [];
        updateGeoConfig({
          geoLayer: 'custom',
          customGeoJSON: parsed,
          customProperties: props,
          joinProperty: props[0] || '',
        });
      } catch {
        alert('Invalid GeoJSON file');
      }
    };
    reader.readAsText(file);
  }, [updateGeoConfig]);

  const shelfFields = useMemo(() => {
    return [...(columns || []), ...(rows || [])].map(f => {
      const name = typeof f === 'string' ? f : f?.name || f?.value || f?.label;
      return name;
    }).filter(Boolean);
  }, [columns, rows]);

  const renderChoroplethConfig = () => (
    <div className="map-config-content">
      <div className="map-config-row">
        <label className="map-config-label">Geographic Layer</label>
        <select
          className="map-config-select"
          value={geoConfig.geoLayer || 'world'}
          onChange={e => updateGeoConfig({ geoLayer: e.target.value, customGeoJSON: null })}
        >
          {GEO_LAYERS.map(l => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
          <option value="custom">Custom GeoJSON</option>
        </select>
      </div>

      {geoConfig.geoLayer === 'custom' && (
        <>
          <div className="map-config-row">
            <label className="map-config-label">Upload GeoJSON</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.geojson"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button className="map-upload-btn" onClick={() => fileInputRef.current?.click()}>
              {geoConfig.customGeoJSON ? 'Replace File' : 'Choose File'}
            </button>
          </div>
          {geoConfig.customProperties?.length > 0 && (
            <div className="map-config-row">
              <label className="map-config-label">Join Property</label>
              <select
                className="map-config-select"
                value={geoConfig.joinProperty || ''}
                onChange={e => updateGeoConfig({ joinProperty: e.target.value })}
              >
                {geoConfig.customProperties.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {geoConfig.geoLayer !== 'custom' && (
        <div className="map-config-hint">
          {GEO_LAYERS.find(l => l.id === (geoConfig.geoLayer || 'world'))?.matchHint}
        </div>
      )}

      <div className="map-config-row">
        <label className="map-config-label">Geo Field</label>
        <select
          className="map-config-select"
          value={geoConfig.geoField || ''}
          onChange={e => updateGeoConfig({ geoField: e.target.value })}
        >
          <option value="">Auto (first column)</option>
          {shelfFields.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <div className="map-config-hint">
          Data field containing geographic identifiers (country name, state code, etc.)
        </div>
      </div>

    </div>
  );

  const renderHexbinConfig = () => (
    <div className="map-config-content">
      <div className="map-config-row">
        <label className="map-config-label">Latitude Field</label>
        <select
          className="map-config-select"
          value={geoConfig.latField || ''}
          onChange={e => updateGeoConfig({ latField: e.target.value })}
        >
          <option value="">Auto (first column)</option>
          {shelfFields.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="map-config-row">
        <label className="map-config-label">Longitude Field</label>
        <select
          className="map-config-select"
          value={geoConfig.lngField || ''}
          onChange={e => updateGeoConfig({ lngField: e.target.value })}
        >
          <option value="">Auto (second column)</option>
          {shelfFields.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="map-config-row">
        <label className="map-config-label">Hex Radius</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range" min="5" max="40" step="1"
            className="map-config-range"
            value={geoConfig.hexRadius || 15}
            onChange={e => updateGeoConfig({ hexRadius: +e.target.value })}
          />
          <span className="map-config-range-val">{geoConfig.hexRadius || 15}px</span>
        </div>
      </div>

      <div className="map-config-hint">
        Place latitude and longitude fields on the Columns shelf (first = lat, second = lng).
        Optional measure on the Rows shelf for aggregation per hex bin.
      </div>
    </div>
  );

  return (
    <>
      <button className="section-toggle" onClick={() => toggleSection('mapConfig')}>
        <FiMap /> Map Settings
        <span className="toggle-icon">{expanded ? <FiChevronDown /> : <FiChevronRight />}</span>
      </button>

      {expanded && (
        <div className="section-content">
          {widgetType === 'choropleth' && renderChoroplethConfig()}
          {widgetType === 'hexbin' && renderHexbinConfig()}
        </div>
      )}
    </>
  );
};

export default MapConfigSection;
