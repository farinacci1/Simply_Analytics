import React, { useRef, useEffect, useState, useMemo } from 'react';
import { createChoroplethChart } from './choroplethChart';
import { loadGeoLayer, buildMatcher } from './geoData';

const toFieldName = (v) => {
  if (v == null) return null;
  if (typeof v !== 'object') return String(v);
  return v.name ?? v.value ?? v.label ?? null;
};

const ChoroplethChartWrapper = ({ data, config, query }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [geojson, setGeojson] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const hasAnimatedRef = useRef(false);

  const geoConfig = config?.geoConfig || {};
  const layerId = geoConfig.geoLayer || 'world';
  const geoField = toFieldName((query?.columns || query?.xAxis || [])[0]);
  const measureField = toFieldName((query?.measures || query?.rows || [])[0]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setGeoError(null);

    if (geoConfig.customGeoJSON) {
      try {
        const parsed = typeof geoConfig.customGeoJSON === 'string'
          ? JSON.parse(geoConfig.customGeoJSON) : geoConfig.customGeoJSON;
        setGeojson(parsed);
      } catch { setGeoError('Invalid custom GeoJSON'); }
      return;
    }

    loadGeoLayer(layerId)
      .then(geo => { if (!cancelled) setGeojson(geo); })
      .catch(err => { if (!cancelled) setGeoError(err.message); });

    return () => { cancelled = true; };
  }, [layerId, geoConfig.customGeoJSON]);

  const dataMap = useMemo(() => {
    const map = new Map();
    if (!geojson || !geoField || !measureField) return map;
    const rows = data?.rows || [];
    const matcher = buildMatcher(layerId);

    rows.forEach(row => {
      const rawGeo = row[geoField];
      const id = matcher(rawGeo);
      if (id != null) {
        const val = +row[measureField];
        if (!isNaN(val)) map.set(id, (map.get(id) || 0) + val);
      }
    });
    return map;
  }, [geojson, data, geoField, measureField, layerId]);

  useEffect(() => {
    if (!containerRef.current || dimensions.width === 0 || !geojson) return;

    const shouldAnimate = !hasAnimatedRef.current;
    hasAnimatedRef.current = true;

    createChoroplethChart(containerRef.current, geojson, dataMap, {
      width: dimensions.width,
      height: dimensions.height,
      layerId,
      measureField: measureField || 'Value',
      colorScheme: config?.colorScheme || 'blues',
      animate: shouldAnimate,
    });
  }, [dimensions, geojson, dataMap, layerId, measureField, config]);

  if (geoError) {
    return <div style={{ padding: 24, color: '#e88', textAlign: 'center' }}>Failed to load map: {geoError}</div>;
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {!geojson && <div style={{ padding: 24, color: '#888', textAlign: 'center' }}>Loading map data…</div>}
    </div>
  );
};

export default ChoroplethChartWrapper;
