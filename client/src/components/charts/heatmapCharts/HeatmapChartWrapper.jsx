import React, { useRef, useEffect, useState } from 'react';
import { createHeatmapChart } from './heatmapChart';

const toFieldName = (v) => {
  if (v == null) return null;
  if (typeof v !== 'object') return String(v);
  return v.name ?? v.value ?? v.label ?? null;
};

const HeatmapChartWrapper = ({ data, config, query }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const hasAnimatedRef = useRef(false);

  const xField = toFieldName((query?.xAxis || query?.columns || [])[0]);
  const yField = toFieldName((query?.rows || [])[0]);
  const valueField = toFieldName((query?.measures || [])[0]);

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
    if (!xField || !yField || !valueField || rows.length === 0) return;

    const shouldAnimate = !hasAnimatedRef.current;
    hasAnimatedRef.current = true;

    createHeatmapChart(containerRef.current, rows, {
      width: dimensions.width, height: dimensions.height,
      xField, yField, valueField,
      colorScheme: config?.colorScheme || 'blues',
      animate: shouldAnimate,
      showLabels: config?.showLabels ?? false,
    });
  }, [dimensions, data, xField, yField, valueField, config]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};

export default HeatmapChartWrapper;
