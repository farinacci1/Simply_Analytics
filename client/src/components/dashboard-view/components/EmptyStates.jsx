import React from 'react';
import { FiPlus, FiAlertTriangle, FiWifiOff, FiRefreshCw } from 'react-icons/fi';

export function ConnectingState() {
  return (
    <div className="dashboard-connecting-state">
      <div className="dashboard-loading-bar" />
      <div className="dashboard-connecting-label">Connecting to Snowflake...</div>
    </div>
  );
}

export function ConnectionErrorState({ error, onReconnect, isReconnecting }) {
  return (
    <div className="connection-error-state">
      <div className="connection-error-content">
        <FiWifiOff className="connection-error-icon" />
        <h3>Connection Error</h3>
        <p className="connection-error-message">{error}</p>
        <button className="btn btn-primary" onClick={onReconnect} disabled={isReconnecting}>
          {isReconnecting ? (
            <><FiRefreshCw className="spin" /> Reconnecting...</>
          ) : (
            <><FiRefreshCw /> Reconnect</>
          )}
        </button>
      </div>
    </div>
  );
}

export function EmptyCanvasState({ onAddWidget }) {
  return (
    <div className="empty-canvas">
      <div className="empty-canvas-content">
        <div className="empty-illustration">
          <svg width="160" height="120" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="40" width="50" height="38" rx="6" fill="#0ea5e9" fillOpacity="0.15" stroke="#0ea5e9" strokeWidth="1.5"/>
            <rect x="16" y="48" width="38" height="4" rx="2" fill="#0ea5e9"/>
            <rect x="16" y="56" width="24" height="3" rx="1.5" fill="#0ea5e9" fillOpacity="0.6"/>
            <rect x="16" y="64" width="38" height="10" rx="2" fill="#0ea5e9" fillOpacity="0.3"/>
            <rect x="45" y="12" width="55" height="48" rx="6" fill="#0ea5e9" fillOpacity="0.2" stroke="#0ea5e9" strokeWidth="1.5"/>
            <rect x="52" y="20" width="42" height="5" rx="2" fill="#0ea5e9"/>
            <rect x="52" y="29" width="26" height="3" rx="1.5" fill="#0ea5e9" fillOpacity="0.7"/>
            <rect x="54" y="40" width="8" height="16" rx="2" fill="#0ea5e9" fillOpacity="0.7"/>
            <rect x="65" y="34" width="8" height="22" rx="2" fill="#0ea5e9"/>
            <rect x="76" y="42" width="8" height="14" rx="2" fill="#0ea5e9" fillOpacity="0.6"/>
            <rect x="87" y="37" width="8" height="19" rx="2" fill="#0ea5e9" fillOpacity="0.8"/>
            <rect x="90" y="50" width="50" height="40" rx="6" fill="#0ea5e9" fillOpacity="0.15" stroke="#0ea5e9" strokeWidth="1.5"/>
            <rect x="96" y="58" width="38" height="4" rx="2" fill="#0ea5e9"/>
            <circle cx="115" cy="78" r="10" fill="none" stroke="#0ea5e9" strokeOpacity="0.4" strokeWidth="4" strokeDasharray="31 31" strokeDashoffset="8"/>
            <circle cx="115" cy="78" r="10" fill="none" stroke="#0ea5e9" strokeWidth="4" strokeDasharray="20 42"/>
            <circle cx="80" cy="95" r="16" fill="#0ea5e9" fillOpacity="0.2" stroke="#0ea5e9" strokeWidth="2"/>
            <path d="M80 88 L80 102 M73 95 L87 95" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="5" cy="25" r="3" fill="#0ea5e9" fillOpacity="0.5"/>
            <circle cx="155" cy="35" r="3" fill="#0ea5e9" fillOpacity="0.4"/>
            <circle cx="25" cy="95" r="2" fill="#0ea5e9" fillOpacity="0.5"/>
            <circle cx="145" cy="100" r="2.5" fill="#0ea5e9" fillOpacity="0.4"/>
          </svg>
        </div>
        <h3>Start Building Your Dashboard</h3>
        <p>Add widgets to visualize your Snowflake data</p>
        <button className="btn btn-primary btn-glow" onClick={onAddWidget}>
          <FiPlus /> Add Your First Widget
        </button>
        <span className="keyboard-hint">or press <kbd>A</kbd></span>
      </div>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="dashboard-loading-config">
      <div className="dashboard-loading-bar" />
      <div className="dashboard-loading-toolbar">
        <div className="dashboard-skeleton-back" />
        <div className="dashboard-skeleton-title" />
      </div>
      <div className="dashboard-shimmer-pane">
        <div className="dashboard-shimmer-sweep" />
      </div>
    </div>
  );
}

export function ErrorState({ error, onGoToSettings, onBackToDashboards }) {
  return (
    <div className="empty-state error-state">
      <FiAlertTriangle className="empty-state-icon error-icon" />
      <h3 className="empty-state-title">
        {error.code === 'MFA_REQUIRED'
          ? 'Multi-Factor Authentication Required'
          : error.code === 'ACCESS_DENIED'
            ? 'Access Denied'
            : 'Error Loading Dashboard'}
      </h3>
      <p className="empty-state-text">{error.message}</p>
      <div className="error-actions">
        {error.code === 'MFA_REQUIRED' && (
          <button className="error-dismiss-btn primary" onClick={onGoToSettings}>Go to Settings</button>
        )}
        <button className="error-dismiss-btn" onClick={onBackToDashboards}>Back to Dashboards</button>
      </div>
    </div>
  );
}

export function SelectDashboardState() {
  return (
    <div className="empty-state">
      <div className="empty-illustration select-dashboard">
        <svg width="180" height="140" viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--accent-primary)' }}>
          <rect x="30" y="50" width="120" height="80" rx="10" fill="currentColor" fillOpacity="0.12"/>
          <rect x="25" y="45" width="120" height="80" rx="10" fill="currentColor" fillOpacity="0.18"/>
          <rect x="20" y="40" width="120" height="80" rx="10" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2"/>
          <path d="M20 50 L20 50 C20 44.477 24.477 40 30 40 L55 40 L65 50 L130 50" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2" fill="none"/>
          <rect x="30" y="58" width="40" height="5" rx="2.5" fill="currentColor" fillOpacity="0.5"/>
          <rect x="30" y="68" width="25" height="3" rx="1.5" fill="currentColor" fillOpacity="0.35"/>
          <rect x="30" y="80" width="45" height="30" rx="4" fill="currentColor" fillOpacity="0.15"/>
          <rect x="35" y="95" width="6" height="12" rx="1" fill="currentColor" fillOpacity="0.4"/>
          <rect x="44" y="90" width="6" height="17" rx="1" fill="currentColor" fillOpacity="0.5"/>
          <rect x="53" y="93" width="6" height="14" rx="1" fill="currentColor" fillOpacity="0.45"/>
          <rect x="62" y="88" width="6" height="19" rx="1" fill="currentColor" fillOpacity="0.55"/>
          <rect x="85" y="80" width="45" height="30" rx="4" fill="currentColor" fillOpacity="0.15"/>
          <rect x="90" y="85" width="35" height="3" rx="1.5" fill="currentColor" fillOpacity="0.4"/>
          <rect x="90" y="92" width="35" height="3" rx="1.5" fill="currentColor" fillOpacity="0.3"/>
          <rect x="90" y="99" width="35" height="3" rx="1.5" fill="currentColor" fillOpacity="0.3"/>
          <path d="M145 75 L145 100 L152 94 L160 105 L165 102 L157 91 L165 87 L145 75Z" fill="currentColor" fillOpacity="0.8" className="cursor-float"/>
          <circle cx="155" cy="35" r="3" fill="currentColor" fillOpacity="0.4" className="sparkle-1"/>
          <circle cx="165" cy="55" r="2" fill="currentColor" fillOpacity="0.35" className="sparkle-2"/>
          <circle cx="10" cy="70" r="2.5" fill="currentColor" fillOpacity="0.3" className="sparkle-3"/>
        </svg>
      </div>
      <h3 className="empty-state-title">Select a Dashboard</h3>
      <p className="empty-state-text">Choose a dashboard from the list or create a new one to start building</p>
    </div>
  );
}
