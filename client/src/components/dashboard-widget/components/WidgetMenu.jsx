import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiRefreshCw, FiBarChart2, FiTable, FiDownload, FiLoader,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

const WidgetMenu = ({
  widgetType, data, showData,
  onRefresh, onToggleData, onExport, onGenerateInsights,
  insightsLoading, onCloseMenu, anchorEl,
}) => {
  const hasData = data?.rows?.length > 0;
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, [anchorEl]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          anchorEl && !anchorEl.contains(e.target)) {
        onCloseMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [anchorEl, onCloseMenu]);

  if (!pos) return null;

  const menu = (
    <div className="widget-menu" ref={menuRef} style={{ top: pos.top, right: pos.right }}>
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

  return createPortal(menu, document.body);
};

export default WidgetMenu;
