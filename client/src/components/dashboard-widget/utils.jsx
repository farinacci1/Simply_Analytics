import React from 'react';
import {
  FiBarChart2, FiTrendingUp, FiPieChart, FiTable, FiHash,
  FiGrid, FiActivity, FiAlignLeft, FiMinusCircle, FiDisc,
  FiSun, FiColumns, FiLayers, FiMap, FiMapPin,
  FiThermometer, FiCompass, FiType, FiFilter,
} from 'react-icons/fi';
import { TbChartHistogram } from 'react-icons/tb';

/**
 * Compute widget card colors based on the canvas background color.
 * Returns CSS custom property values for widget bg, header, border, and text.
 */
export const computeWidgetColors = (canvasColor) => {
  if (!canvasColor) return null;

  const hex = canvasColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  if (luminance < 0.5) {
    const widgetBg = `rgba(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)}, 0.85)`;
    const headerBg = `rgba(${Math.min(255, r + 25)}, ${Math.min(255, g + 25)}, ${Math.min(255, b + 25)}, 0.95)`;
    const borderColor = `rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)}, 0.5)`;
    return { widgetBg, headerBg, borderColor, textColor: '#ffffff' };
  } else {
    const widgetBg = `rgba(${Math.max(0, r - 60)}, ${Math.max(0, g - 60)}, ${Math.max(0, b - 60)}, 0.9)`;
    const headerBg = `rgba(${Math.max(0, r - 80)}, ${Math.max(0, g - 80)}, ${Math.max(0, b - 80)}, 0.95)`;
    const borderColor = `rgba(${Math.max(0, r - 100)}, ${Math.max(0, g - 100)}, ${Math.max(0, b - 100)}, 0.5)`;
    return { widgetBg, headerBg, borderColor, textColor: '#ffffff' };
  }
};

/**
 * Export widget data rows to a CSV file and trigger download.
 */
export const exportToCSV = (data, title) => {
  if (!data?.rows?.length) {
    console.warn('No data to export');
    return;
  }

  const { rows, columns } = data;
  const columnNames = columns.map(c => c.name);

  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columnNames.map(escapeCSV).join(',');
  const dataRows = rows.map(row =>
    columnNames.map(col => escapeCSV(row[col])).join(',')
  );

  const csvContent = [header, ...dataRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${title || 'widget-data'}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Map a widget type string to the corresponding react-icon element.
 */
export const getWidgetIcon = (widgetType) => {
  switch (widgetType) {
    case 'bar': return <FiBarChart2 />;
    case 'horizontal-bar': return <FiAlignLeft />;
    case 'stacked-bar': return <FiColumns />;
    case 'diverging-bar': return <FiMinusCircle />;
    case 'line': return <FiTrendingUp />;
    case 'multiline': return <FiActivity />;
    case 'area': return <FiTrendingUp />;
    case 'pie': return <FiPieChart />;
    case 'donut': return <FiDisc />;
    case 'radial': return <FiSun />;
    case 'treemap': return <FiGrid />;
    case 'icicle': return <FiLayers />;
    case 'sankey': return <FiActivity />;
    case 'table': return <FiTable />;
    case 'pivot': case 'crosstab': return <FiGrid />;
    case 'metric': return <FiHash />;
    case 'choropleth': return <FiMap />;
    case 'hexbin': return <FiMapPin />;
    case 'heatmap': return <FiGrid />;
    case 'gauge': return <FiThermometer />;
    case 'radar': return <FiCompass />;
    case 'histogram': return <TbChartHistogram />;
    case 'title': return <FiType />;
    case 'filter': return <FiFilter />;
    default: return <FiBarChart2 />;
  }
};
