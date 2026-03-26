import React from 'react';
import {
  FiRefreshCw, FiBarChart2, FiTable, FiDownload, FiLoader,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

const WidgetMenu = ({
  widgetType, data, showData,
  onRefresh, onToggleData, onExport, onGenerateInsights,
  insightsLoading, onCloseMenu,
}) => {
  const hasData = data?.rows?.length > 0;

  return (
    <div className="widget-menu">
      <button onClick={() => { onRefresh(); onCloseMenu(); }}>
        <FiRefreshCw /> Refresh
      </button>
      {widgetType !== 'table' && widgetType !== 'pivot' && (
        <button
          onClick={() => { onToggleData(); onCloseMenu(); }}
          disabled={!hasData}
          title={showData ? 'Show chart' : 'Show underlying data'}
          className={showData ? 'active' : ''}
        >
          {showData ? <FiBarChart2 /> : <FiTable />} {showData ? 'Show Chart' : 'View Data'}
        </button>
      )}
      <button
        onClick={() => { onExport(); onCloseMenu(); }}
        disabled={!hasData}
        title={!hasData ? 'No data to export' : 'Export data to CSV'}
      >
        <FiDownload /> Export CSV
      </button>
      <button
        onClick={onGenerateInsights}
        disabled={!hasData || insightsLoading}
        title={!hasData ? 'No data to explain' : 'Explain this data with AI'}
        className="insights-btn"
      >
        {insightsLoading ? <FiLoader className="spin" /> : <HiSparkles />} Explain
      </button>
    </div>
  );
};

export default WidgetMenu;
