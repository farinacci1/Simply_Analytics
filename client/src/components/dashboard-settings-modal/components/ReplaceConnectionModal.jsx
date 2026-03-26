import React from 'react';
import { FiDatabase, FiX, FiAlertCircle, FiRefreshCw, FiCheck } from 'react-icons/fi';

export function ReplaceConnectionModal({
  dashboard,
  showReplaceConnection,
  setShowReplaceConnection,
  loadingConnections,
  availableConnections,
  selectedConnectionId,
  setSelectedConnectionId,
  handleReplaceConnection,
}) {
  if (!showReplaceConnection) return null;

  return (
    <div className="replace-connection-overlay">
      <div className="replace-connection-modal">
        <div className="modal-header">
          <h3>
            <FiDatabase /> Replace Connection
          </h3>
          <button
            className="close-btn"
            onClick={() => {
              setShowReplaceConnection(false);
              setSelectedConnectionId(null);
            }}
          >
            <FiX />
          </button>
        </div>
        <div className="modal-body">
          <p className="replace-warning">
            <FiAlertCircle /> Changing the connection may affect widget queries and data access.
          </p>

          <div className="form-group">
            <label className="form-label">Select Connection</label>
            {loadingConnections ? (
              <div className="loading-connections">
                <FiRefreshCw className="spin" /> Loading connections...
              </div>
            ) : availableConnections.length === 0 ? (
              <p className="no-connections">No connections available. Create a connection in Settings first.</p>
            ) : (
              <div className="connections-list">
                {availableConnections.map((conn) => (
                  <label key={conn.id} className={`connection-option ${selectedConnectionId === conn.id ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="connection"
                      value={conn.id}
                      checked={selectedConnectionId === conn.id}
                      onChange={() => setSelectedConnectionId(conn.id)}
                    />
                    <div className="connection-option-info">
                      <span className="connection-name">{conn.name}</span>
                      <span className="connection-account">{conn.account}</span>
                    </div>
                    {conn.id === dashboard?.connection_id && <span className="current-badge">Current</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={() => {
              setShowReplaceConnection(false);
              setSelectedConnectionId(null);
            }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleReplaceConnection}
            disabled={!selectedConnectionId || selectedConnectionId === dashboard?.connection_id}
          >
            <FiCheck /> Replace Connection
          </button>
        </div>
      </div>
    </div>
  );
}
