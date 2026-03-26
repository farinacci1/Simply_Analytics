import React, { useRef, useEffect, useState, useMemo } from 'react';
import { createHexbinChart } from './hexbinChart';

const toFieldName = (v) => {
  if (v == null) return null;
  if (typeof v !== 'object') return String(v);
  return v.name ?? v.value ?? v.label ?? null;
};

const HexbinChartWrapper = ({ data, config, query }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const hasAnimatedRef = useRef(false);

  const cols = query?.columns || query?.xAxis || [];
  const latField = toFieldName(cols[0]);
  const lngField = toFieldName(cols[1]);
  const valueField = toFieldName((query?.measures || query?.rows || [])[0]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(() => {
    if (!latField || !lngField) return [];
    return (data?.rows || []).map(row => {
      const lat = +row[latField];
      const lng = +row[lngField];
      if (isNaN(lat) || isNaN(lng)) return null;
      return { lat, lng, value: valueField ? +row[valueField] || 0 : 1 };
    }).filter(Boolean);
  }, [data, latField, lngField, valueField]);

  useEffect(() => {
    if (!containerRef.current || dimensions.width === 0 || !points.length) return;

    const shouldAnimate = !hasAnimatedRef.current;
    hasAnimatedRef.current = true;

    const geoConfig = config?.geoConfig || {};
    createHexbinChart(containerRef.current, points, {
      width: dimensions.width,
      height: dimensions.height,
      valueField,
      colorScheme: config?.colorScheme || 'blues',
      animate: shouldAnimate,
      hexRadius: geoConfig.hexRadius || 15,
    });
  }, [dimensions, points, valueField, config]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {!points.length && <div style={{ padding: 24, color: '#888', textAlign: 'center' }}>Add lat/lng fields to Columns</div>}
    </div>
  );
};

export default HexbinChartWrapper;
