import React, { useRef, useEffect, useState } from 'react';
import { createRadarChart } from './radarChart';

const toFieldName = (v) => {
  if (v == null) return null;
  if (typeof v !== 'object') return String(v);
  return v.name ?? v.value ?? v.label ?? null;
};

const RadarChartWrapper = ({ data, config, query }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const hasAnimatedRef = useRef(false);

  const axisField = toFieldName((query?.xAxis || query?.columns || [])[0]);
  const seriesField = toFieldName((query?.xAxis || query?.columns || [])[1]) || null;
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

  useEffect(() => {
    if (!containerRef.current || dimensions.width === 0 || dimensions.height === 0) return;
    const rows = data?.rows || [];
    if (!axisField || !valueField || rows.length === 0) return;

    const shouldAnimate = !hasAnimatedRef.current;
    hasAnimatedRef.current = true;

    createRadarChart(containerRef.current, rows, {
      width: dimensions.width, height: dimensions.height,
      axisField, seriesField, valueField,
      colorScheme: config?.colorScheme || 'blues',
      colors: config?.colors,
      animate: shouldAnimate,
    });
  }, [dimensions, data, axisField, seriesField, valueField, config]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};

export default RadarChartWrapper;
