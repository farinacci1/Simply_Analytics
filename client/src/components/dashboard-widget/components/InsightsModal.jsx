import React from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

const InsightsModal = ({ widget, insights, insightsLoading, insightsError, onClose, onRegenerate }) => {
  return createPortal(
    <div className="insights-modal-overlay">
      <div className="insights-modal" onClick={e => e.stopPropagation()}>
        <div className="insights-modal-header">
          <div className="insights-title">
            <HiSparkles className="insights-icon" />
            <span>Explain: {widget.title}</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <div className="insights-modal-content">
          {insightsLoading ? (
            <div className="insights-loading">
              <div className="loading-label">
                <HiSparkles /> Generating Insights...
              </div>
              <div className="shimmer-skeleton">
                <div className="shimmer-section">
                  <div className="shimmer-line header" />
                  <div className="shimmer-line full" />
                  <div className="shimmer-line long" />
                  <div className="shimmer-line medium" />
                </div>
                <div className="shimmer-section">
                  <div className="shimmer-line header" />
                  <div className="shimmer-line long" />
                  <div className="shimmer-line full" />
                </div>
                <div className="shimmer-section">
                  <div className="shimmer-line header" />
                  <div className="shimmer-line medium" />
                  <div className="shimmer-line short" />
                </div>
              </div>
            </div>
          ) : insightsError ? (
            <div className="insights-error">
              <span>{insightsError}</span>
            </div>
          ) : insights ? (
            <div className="insights-text">
              {insights.split('\n').map((line, idx) => {
                if (line.match(/^[\s]*[-•]\s/)) return <div key={idx} className="insight-bullet">{line}</div>;
                if (line.match(/^[\s]*\d+\.\s/)) return <div key={idx} className="insight-numbered">{line}</div>;
                if (line.match(/^#+\s/) || line.match(/^[A-Z][A-Z\s]*:$/)) return <h5 key={idx} className="insight-header">{line.replace(/^#+\s/, '')}</h5>;
                if (line.match(/^\*\*.*\*\*$/)) return <strong key={idx} className="insight-bold">{line.replace(/\*\*/g, '')}</strong>;
                if (!line.trim()) return <div key={idx} className="insight-spacer" />;
                return <p key={idx} className="insight-paragraph">{line}</p>;
              })}
            </div>
          ) : (
            <div className="insights-empty">
              <span>No insights generated yet</span>
            </div>
          )}
        </div>
        <div className="insights-modal-footer">
          <span className="insights-note">Powered by Snowflake Cortex</span>
          <button className="btn btn-secondary" onClick={onRegenerate} disabled={insightsLoading}>
            <HiSparkles /> {insightsLoading ? 'Generating...' : 'Generate Again'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default InsightsModal;
