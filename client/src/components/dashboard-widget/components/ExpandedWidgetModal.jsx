import React from 'react';
import { createPortal } from 'react-dom';
import { FiBarChart2, FiTable, FiX } from 'react-icons/fi';
import { renderChart as sharedRenderChart } from '../../charts/ChartRenderer';
import ChartErrorBoundary from './ChartErrorBoundary';
import { getWidgetIcon } from '../utils.jsx';

const ExpandedContent = ({ widget, data, config, widgetType, chartQuery, showData }) => {
  const dataRows = Array.isArray(data) ? data : data?.rows;
  if (!dataRows?.length) {
    return <div className="widget-empty"><span>No data available</span></div>;
  }

  const type = widgetType || widget.type || 'bar';
  const query = chartQuery || {};

  if (showData && type !== 'table' && type !== 'pivot') {
    return sharedRenderChart('table', data, config, query, `expanded-${widget.id}-data`);
  }

  return sharedRenderChart(type, data, config, query, `expanded-${widget.id}`);
};

const ExpandedWidgetModal = ({
  widget, data, config, widgetType, chartQuery,
  showData, setShowData, expandKey, onClose,
}) => {
  return createPortal(
    <div className="widget-expanded-overlay" onClick={onClose}>
      <div className="widget-expanded-modal" onClick={(e) => e.stopPropagation()}>
        <div className="widget-expanded-header">
          <div className="widget-expanded-title">
            {getWidgetIcon(widgetType)}
            <span>{widget.title}</span>
            {showData && widgetType !== 'table' && widgetType !== 'pivot' && (
              <span className="widget-data-badge" title="Viewing underlying data">
                <FiTable />
              </span>
            )}
          </div>
          <div className="widget-expanded-actions">
            {widgetType !== 'table' && widgetType !== 'pivot' && (
              <button
                className={`expanded-action-btn ${showData ? 'active' : ''}`}
                onClick={() => setShowData(!showData)}
                title={showData ? 'Show chart' : 'View underlying data'}
              >
                {showData ? <FiBarChart2 /> : <FiTable />}
              </button>
            )}
            <button className="widget-expanded-close" onClick={onClose}>
              <FiX />
            </button>
          </div>
        </div>
        <div className="widget-expanded-content">
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'stretch', justifyContent: 'stretch',
            position: 'relative', overflow: 'hidden',
          }}>
            <ChartErrorBoundary resetKey={`${widgetType}-${data?.rows?.length}-expanded`}>
              <ExpandedContent
                key={`expanded-${widget.id}-${expandKey}`}
                widget={widget}
                data={data}
                config={config}
                widgetType={widgetType}
                chartQuery={chartQuery}
                showData={showData}
              />
            </ChartErrorBoundary>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ExpandedWidgetModal;
