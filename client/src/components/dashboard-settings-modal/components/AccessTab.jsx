import React from 'react';
import {
  FiDatabase,
  FiMoreVertical,
  FiRefreshCw,
  FiWifi,
  FiCheck,
  FiAlertCircle,
  FiServer,
  FiUser,
  FiEye,
  FiLock,
  FiUserCheck,
  FiChevronDown,
  FiX,
} from 'react-icons/fi';

export function AccessTab({
  dashboard,
  connectionMenuRef,
  connectionMenuBtnRef,
  showConnectionMenu,
  setShowConnectionMenu,
  connectionMenuPos,
  setConnectionMenuPos,
  testConnection,
  testingConnection,
  connectionTestResult,
  isOwner,
  loadAvailableConnections,
  selectedConnectionId,
  setSelectedConnectionId,
  setShowReplaceConnection,
  warehouse,
  role,
  isPublished,
  setIsPublished,
  adminRoles,
  transferOwnerTo,
  setTransferOwnerTo,
  showTransferConfirm,
  setShowTransferConfirm,
  handleTransferOwnership,
  connectionInherited,
}) {
  return (
    <div className="settings-section">
      {/* Connection Settings */}
      <div className="settings-subsection">
        <h3 className="subsection-title">
          <FiDatabase /> Connection
        </h3>

        {/* Connection Name with Menu */}
        <div className="form-group">
          <label className="form-label">Connection</label>
          <div className="connection-row">
            <div className="immutable-value">
              <FiDatabase className="immutable-icon" />
              <span>{dashboard?.connection_name || 'Not configured'}</span>
            </div>

            {/* Connection Menu */}
            <div className="connection-menu-container" ref={connectionMenuRef}>
              <button
                type="button"
                ref={connectionMenuBtnRef}
                className="btn btn-icon btn-secondary connection-menu-btn"
                onClick={() => {
                  if (!showConnectionMenu && connectionMenuBtnRef.current) {
                    const rect = connectionMenuBtnRef.current.getBoundingClientRect();
                    setConnectionMenuPos({
                      top: rect.bottom + 4,
                      left: rect.right - 180,
                    });
                  }
                  setShowConnectionMenu(!showConnectionMenu);
                }}
                title="Connection options"
              >
                <FiMoreVertical />
              </button>

              {showConnectionMenu && (
                <div className="connection-menu-dropdown" style={{ top: connectionMenuPos.top, left: connectionMenuPos.left }}>
                  <button
                    className="connection-menu-item"
                    onClick={() => {
                      setShowConnectionMenu(false);
                      testConnection();
                    }}
                    disabled={testingConnection || !dashboard?.connection_id}
                  >
                    {testingConnection ? (
                      <>
                        <FiRefreshCw className="spin" /> Testing...
                      </>
                    ) : (
                      <>
                        <FiWifi /> Test Connection
                      </>
                    )}
                  </button>
                  {isOwner && (
                    <button
                      className="connection-menu-item"
                      onClick={() => {
                        setShowConnectionMenu(false);
                        loadAvailableConnections();
                        setSelectedConnectionId(dashboard?.connection_id || null);
                        setShowReplaceConnection(true);
                      }}
                    >
                      <FiRefreshCw /> Replace Connection
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Connection Test Result */}
          {connectionTestResult && (
            <div className={`connection-test-result ${connectionTestResult.success ? 'success' : 'error'}`}>
              {connectionTestResult.success ? <FiCheck /> : <FiAlertCircle />}
              <span>{connectionTestResult.message}</span>
            </div>
          )}
        </div>

        {/* Warehouse & Role — inline display */}
        {connectionInherited && (warehouse || role) && (
          <div className="connection-details-inline">
            {warehouse && (
              <div className="connection-detail-item">
                <FiServer className="connection-detail-icon" />
                <span className="connection-detail-label">Warehouse</span>
                <span className="connection-detail-value">{warehouse}</span>
              </div>
            )}
            {warehouse && role && <span className="connection-detail-separator" />}
            {role && (
              <div className="connection-detail-item">
                <FiUser className="connection-detail-icon" />
                <span className="connection-detail-label">Role</span>
                <span className="connection-detail-value">{role}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Publication Status */}
      <div className="settings-subsection">
        <h3 className="subsection-title">
          <FiEye /> Visibility
        </h3>
        <div className="published-toggle">
          <button type="button" className={`toggle-option ${!isPublished ? 'active' : ''}`} onClick={() => setIsPublished(false)}>
            <FiLock size={14} />
            Private
          </button>
          <button type="button" className={`toggle-option ${isPublished ? 'active' : ''}`} onClick={() => setIsPublished(true)}>
            <FiEye size={14} />
            Published
          </button>
        </div>
        <p className="form-hint">
          {isPublished
            ? 'This dashboard is published and visible to all workspace members.'
            : 'Private — only you can see this dashboard.'}
        </p>
      </div>

      {/* Transfer Ownership - Owner Only */}
      {isOwner && adminRoles.length > 0 && (
        <div className="transfer-ownership-section">
          <h4>
            <FiUserCheck /> Transfer Ownership
          </h4>
          <p className="section-description warning">Transfer dashboard ownership to another admin. This action cannot be undone.</p>

          {!showTransferConfirm ? (
            <div className="transfer-form">
              <div className="select-wrapper">
                <select className="form-input" value={transferOwnerTo} onChange={(e) => setTransferOwnerTo(e.target.value)}>
                  <option value="">Select admin role...</option>
                  {adminRoles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="select-icon" />
              </div>
              <button className="btn btn-danger" onClick={() => setShowTransferConfirm(true)} disabled={!transferOwnerTo}>
                Transfer Ownership
              </button>
            </div>
          ) : (
            <div className="transfer-confirm">
              <p className="confirm-message">
                Are you sure you want to transfer ownership to <strong>{transferOwnerTo}</strong>? You will lose owner privileges.
              </p>
              <div className="confirm-actions">
                <button className="btn btn-danger" onClick={handleTransferOwnership}>
                  Confirm Transfer
                </button>
                <button className="btn btn-secondary" onClick={() => setShowTransferConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
