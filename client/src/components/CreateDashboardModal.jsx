import React, { useState, useEffect } from 'react';
import { FiX, FiDatabase, FiMessageSquare, FiShield, FiLoader, FiCheck, FiAlertCircle, FiLock, FiLink, FiFolder, FiHome, FiPlus, FiSearch, FiServer, FiUser } from 'react-icons/fi';
import { useAppStore } from '../store/appStore';
import { dashboardApi, sfConnectionApi, folderApi, workspaceApi } from '../api/apiClient';
import '../styles/CreateDashboardModal.css';

const CreateDashboardModal = ({ isOpen, onClose, onSuccess, folderId = null }) => {
  const { 
    isAuthenticated, 
    loadDashboards,
    activeWorkspace,
    currentUser,
  } = useAppStore();

  const hasSecureAuth = currentUser?.auth_provider === 'saml' ||
    currentUser?.totp_enabled || currentUser?.passkey_enabled;

  // Connection state
  const [connections, setConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  
  // Resources from selected connection
  const [semanticViews, setSemanticViews] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  // Form state (role/warehouse are derived from the connection, not user-selected)
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [role, setRole] = useState('');
  const [selectedSemanticViews, setSelectedSemanticViews] = useState([]);
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  
  // Dropdown state
  const [semanticViewsDropdownOpen, setSemanticViewsDropdownOpen] = useState(false);
  
  // Folder state
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(folderId);
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const [showInlineCreateFolder, setShowInlineCreateFolder] = useState(false);
  const [inlineFolderName, setInlineFolderName] = useState('');
  const [creatingInlineFolder, setCreatingInlineFolder] = useState(false);
  const [folderSearchQuery, setFolderSearchQuery] = useState('');

  // Load connections and folders when modal opens
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadConnections();
      loadFolders();
      setSelectedConnection(null);
      setWarehouse('');
      setRole('');
      setSelectedSemanticViews([]);
      setSemanticViews([]);
      setSelectedFolderId(folderId);
    }
  }, [isOpen, isAuthenticated, folderId]);

  // When connection changes, resolve role/warehouse/resources from the connection
  useEffect(() => {
    if (!selectedConnection) return;
    loadConnectionResources(selectedConnection);
  }, [selectedConnection]);

  const loadConnections = async () => {
    setLoadingConnections(true);
    try {
      if (activeWorkspace?.id) {
        const wsDetail = await workspaceApi.get(activeWorkspace.id);
        const wcs = wsDetail?.connections || [];
        setConnections(wcs.map(wc => ({
          id: wc.connection_id,
          name: wc.connection_name,
          account: wc.connection_account,
          default_role: wc.role,
          default_warehouse: wc.warehouse,
          _wsConn: wc,
        })));
      } else {
        const response = await sfConnectionApi.getAll();
        setConnections(response.connections || []);
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
      setError('Failed to load connections');
    } finally {
      setLoadingConnections(false);
    }
  };

  const loadFolders = async () => {
    try {
      const response = await folderApi.getContents(null, activeWorkspace?.id);
      setFolders(response.folders || []);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  const handleInlineCreateFolder = async () => {
    if (!inlineFolderName.trim()) return;
    
    setCreatingInlineFolder(true);
    try {
      const newFolder = await folderApi.create({
        name: inlineFolderName.trim(),
        parentId: null,
        workspaceId: activeWorkspace?.id,
      });
      // Add to folder list and select it (API returns folder directly, not wrapped)
      setFolders([...folders, newFolder]);
      setSelectedFolderId(newFolder.id);
      setShowInlineCreateFolder(false);
      setInlineFolderName('');
      setFolderSearchQuery('');
      setFolderDropdownOpen(false);
    } catch (err) {
      console.error('Failed to create folder:', err);
    } finally {
      setCreatingInlineFolder(false);
    }
  };

  // Load role/warehouse/semantic views for the selected connection
  const loadConnectionResources = async (connectionId) => {
    setLoadingResources(true);
    setRole('');
    setWarehouse('');
    setSemanticViews([]);
    setSelectedSemanticViews([]);

    try {
      const parseFqn = (fqn) => {
        const parts = (fqn || '').split('.');
        return {
          name: parts.length > 0 ? parts[parts.length - 1] : fqn,
          database: parts.length >= 3 ? parts[0] : undefined,
          schema: parts.length >= 3 ? parts[1] : undefined,
          fullyQualifiedName: fqn,
        };
      };

      if (activeWorkspace?.id) {
        // Workspace mode: everything from workspace connection config
        const wsDetail = await workspaceApi.get(activeWorkspace.id);
        const wsConn = (wsDetail?.connections || []).find(wc => wc.connection_id === connectionId);
        if (wsConn) {
          setRole(wsConn.role || '');
          setWarehouse(wsConn.warehouse || '');
          setSemanticViews(
            (wsDetail?.semanticViews || [])
              .filter(v => v.workspace_connection_id === wsConn.id)
              .map(v => parseFqn(v.semantic_view_fqn))
          );
        }
      } else {
        // No workspace: role/warehouse from connection defaults, semantic views from Snowflake
        const conn = connections.find(c => c.id === connectionId);
        setRole(conn?.default_role || '');
        setWarehouse(conn?.default_warehouse || '');

        if (conn?.default_role) {
          const resources = await sfConnectionApi.getResources(connectionId, conn.default_role);
          setSemanticViews(resources.semanticViews || []);
        }
      }
    } catch (err) {
      console.error('Failed to load connection resources:', err);
    } finally {
      setLoadingResources(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // REQUIRE authentication - users must be signed in to create dashboards
    if (!isAuthenticated) {
      setSubmitError('You must sign in before creating a dashboard.');
      return;
    }
    
    // Require connection
    if (!selectedConnection) {
      setSubmitError('Please select a Snowflake connection');
      return;
    }
    
    // Require name
    if (!name.trim() || isSubmitting) return;
    
    // Require warehouse and role
    if (!warehouse) {
      setSubmitError('Please select a warehouse');
      return;
    }
    
    if (!role) {
      setSubmitError('Please select a role');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    // Format semantic views to match Dashboard Settings format
    const formattedSemanticViews = selectedSemanticViews.map(view => {
      const db = view.database || view.databaseName || '';
      const schema = view.schema || view.schemaName || '';
      const viewName = view.name || '';
      const fqn = view.full_name || view.fullyQualifiedName || (db && schema && viewName ? `${db}.${schema}.${viewName}` : viewName);
      return {
        name: view.name,
        fullyQualifiedName: fqn,
      };
    });

    // Get Snowflake username from the selected connection
    const selectedConn = connections.find(c => c.id === selectedConnection);
    const snowflakeUsername = selectedConn?.username || '';

    const dashboardData = {
      name: name.trim(),
      description: comment.trim(),
      connectionId: selectedConnection,
      warehouse,
      role,
      semanticViewsReferenced: formattedSemanticViews,
      ownerRole: role,
      createdBy: snowflakeUsername,
      folderId: selectedFolderId || null,
      workspaceId: activeWorkspace.id,
    };

    try {
      // Always call server API and wait for response
      const response = await dashboardApi.create(dashboardData);
      
      // Refresh dashboard list from server
      await loadDashboards();
      
      // Reset form
      setName('');
      setComment('');
      setWarehouse('');
      setSelectedSemanticViews([]);
      setSubmitError(null);
      
      // Notify parent of success
      if (onSuccess) {
        onSuccess(response.dashboard);
      }
      
      // Only close on success
      onClose();
    } catch (err) {
      console.error('Failed to create dashboard:', err);
      setSubmitError(err.message || 'Failed to create dashboard. Please try again.');
      // Modal stays open - user can retry or cancel
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSemanticView = (view) => {
    setSelectedSemanticViews(prev => {
      const exists = prev.find(v => v.fullyQualifiedName === view.fullyQualifiedName);
      if (exists) {
        return prev.filter(v => v.fullyQualifiedName !== view.fullyQualifiedName);
      }
      return [...prev, view];
    });
  };

  const removeSemanticView = (view) => {
    setSelectedSemanticViews(prev => 
      prev.filter(v => v.fullyQualifiedName !== view.fullyQualifiedName)
    );
  };

  // Reset all fields and messages
  const resetForm = () => {
    setName('');
    setComment('');
    setSelectedConnection(null);
    setWarehouse('');
    setRole('');
    setSelectedSemanticViews([]);
    setSemanticViews([]);
    setError(null);
    setSubmitError(null);
    setSemanticViewsDropdownOpen(false);
  };

  // Handle close - reset form and call onClose
  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  if (!isOpen) return null;

  const canSubmit = isAuthenticated && hasSecureAuth && selectedConnection && name.trim() && warehouse && role;

  return (
    <div className="modal-overlay">
      <div className="create-dashboard-modal" onClick={(e) => e.stopPropagation()}>
        {/* Progress bar at top */}
        {isSubmitting && (
          <div className="modal-progress-bar">
            <div className="progress-bar-fill" />
          </div>
        )}

        <div className="modal-header">
          <h2 className="modal-title">Create Dashboard</h2>
          <button className="modal-close" onClick={handleClose} disabled={isSubmitting}>
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={`modal-body ${!hasSecureAuth ? 'mfa-locked' : ''}`}>
            {/* MFA/SSO Required Notice */}
            {!hasSecureAuth && (
              <div className="auth-required-notice">
                <FiShield className="notice-icon" />
                <div className="notice-content">
                  <strong>MFA or SSO required</strong>
                  <p>Set up Multi-Factor Authentication in your settings before creating dashboards.</p>
                </div>
              </div>
            )}

            {/* Authentication Required Notice */}
            {!isAuthenticated && hasSecureAuth && (
              <div className="auth-required-notice">
                <FiLock className="notice-icon" />
                <div className="notice-content">
                  <strong>Sign in required</strong>
                  <p>You must sign in to create dashboards.</p>
                </div>
              </div>
            )}

            {/* Dashboard Name */}
            <div className="form-group">
              <label className="form-label">Dashboard Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Sales Overview"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Comment */}
            <div className="form-group">
              <label className="form-label">
                <FiMessageSquare className="label-icon" />
                Description
              </label>
              <textarea
                className="form-textarea"
                placeholder="Optional description for this dashboard..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
              />
            </div>

            {/* Folder Selection */}
            <div className="form-group">
              <label className="form-label">
                <FiFolder className="label-icon" />
                Folder
              </label>
              <div className="folder-selector">
                <button 
                  type="button"
                  className="folder-selector-btn"
                  onClick={() => setFolderDropdownOpen(!folderDropdownOpen)}
                >
                  {selectedFolderId ? (
                    <>
                      <FiFolder /> {folders.find(f => f.id === selectedFolderId)?.name || 'Selected Folder'}
                    </>
                  ) : (
                    <>
                      <FiHome /> Root (No folder)
                    </>
                  )}
                </button>
                {folderDropdownOpen && (
                  <div className="folder-dropdown">
                    <div className="folder-search-container">
                      <FiSearch className="folder-search-icon" />
                      <input
                        type="text"
                        className="folder-search-input"
                        placeholder="Search folders..."
                        value={folderSearchQuery}
                        onChange={(e) => setFolderSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    </div>
                    <div className="folder-options-list">
                      {(!folderSearchQuery || 'root'.includes(folderSearchQuery.toLowerCase()) || 'no folder'.includes(folderSearchQuery.toLowerCase())) && (
                        <button
                          type="button"
                          className={`folder-option ${!selectedFolderId ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedFolderId(null);
                            setFolderDropdownOpen(false);
                            setFolderSearchQuery('');
                          }}
                        >
                          <FiHome /> Root (No folder)
                        </button>
                      )}
                      {folders
                        .filter(folder => !folderSearchQuery || folder.name.toLowerCase().includes(folderSearchQuery.toLowerCase()))
                        .map(folder => (
                        <button
                          key={folder.id}
                          type="button"
                          className={`folder-option ${selectedFolderId === folder.id ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedFolderId(folder.id);
                            setFolderDropdownOpen(false);
                            setFolderSearchQuery('');
                          }}
                        >
                          <FiFolder style={{ color: folder.color || '#6366f1' }} /> {folder.name}
                        </button>
                      ))}
                    </div>
                    
                    {/* Create new folder inline */}
                    {showInlineCreateFolder ? (
                      <div className="inline-create-folder">
                        <input
                          type="text"
                          placeholder="New folder name..."
                          value={inlineFolderName}
                          onChange={(e) => setInlineFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleInlineCreateFolder();
                            }
                            if (e.key === 'Escape') {
                              setShowInlineCreateFolder(false);
                              setInlineFolderName('');
                            }
                          }}
                          autoFocus
                          disabled={creatingInlineFolder}
                        />
                        <button 
                          type="button"
                          className="inline-create-btn"
                          onClick={handleInlineCreateFolder}
                          disabled={!inlineFolderName.trim() || creatingInlineFolder}
                        >
                          {creatingInlineFolder ? '...' : <FiPlus />}
                        </button>
                        <button 
                          type="button"
                          className="inline-cancel-btn"
                          onClick={() => {
                            setShowInlineCreateFolder(false);
                            setInlineFolderName('');
                          }}
                        >
                          <FiX />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="folder-option create-new-folder"
                        onClick={() => setShowInlineCreateFolder(true)}
                      >
                        <FiPlus /> Create New Folder <span className="folder-hint">(at root)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Connection Selection */}
            <div className="form-group">
              <label className="form-label">
                <FiLink className="label-icon" />
                Snowflake Connection *
              </label>
              {loadingConnections ? (
                <div className="form-loading">
                  <FiLoader className="spinner" /> Loading connections...
                </div>
              ) : connections.length === 0 ? (
                <div className="form-notice connection-notice">
                  <FiAlertCircle className="notice-icon" />
                  <div>
                    <p>No connections assigned to this workspace.</p>
                    <p className="notice-hint">Create a Snowflake connection and assign it to this workspace first.</p>
                  </div>
                </div>
              ) : (
                <select
                  className="form-select"
                  value={selectedConnection || ''}
                  onChange={(e) => setSelectedConnection(e.target.value || null)}
                  disabled={!isAuthenticated || !hasSecureAuth}
                >
                  <option value="">Select a connection...</option>
                  {connections.map((conn) => (
                    <option key={conn.id} value={conn.id}>
                      {conn.name} ({conn.account})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Role & Warehouse (from connection) */}
            {selectedConnection && !loadingResources && (role || warehouse) && (
              <div className="form-inline-meta">
                <span className="meta-chip"><FiShield size={11} /> <span className="meta-label">Role</span> <span className="meta-value">{role}</span></span>
                <span className="meta-sep" />
                <span className="meta-chip"><FiServer size={11} /> <span className="meta-label">Warehouse</span> <span className="meta-value">{warehouse}</span></span>
              </div>
            )}

            {/* Semantic Views Multi-Select */}
            <div className="form-group">
              <label className="form-label">
                <FiDatabase className="label-icon" />
                Semantic Views (optional)
              </label>
              {!selectedConnection ? (
                <div className="form-notice">
                  Select a connection first
                </div>
              ) : loadingResources ? (
                <div className="form-loading">
                  <FiLoader className="spinner" /> Loading semantic views...
                </div>
              ) : semanticViews.length === 0 ? (
                <div className="form-notice">
                  No semantic views assigned to this connection
                </div>
              ) : (
                <div className="semantic-views-selector">
                  {/* Dropdown trigger */}
                  <div className="multi-select-container">
                    <button
                      type="button"
                      className="multi-select-trigger"
                      onClick={() => setSemanticViewsDropdownOpen(!semanticViewsDropdownOpen)}
                    >
                      {selectedSemanticViews.length === 0 
                        ? 'Select semantic views...' 
                        : `${selectedSemanticViews.length} selected`}
                    </button>
                    
                    {/* Dropdown options */}
                    {semanticViewsDropdownOpen && (
                      <div className="multi-select-dropdown">
                        {semanticViews.map((view, idx) => {
                          const isSelected = selectedSemanticViews.some(
                            v => v.fullyQualifiedName === view.fullyQualifiedName
                          );
                          return (
                            <button
                              key={view.fullyQualifiedName || view.name || idx}
                              type="button"
                              className={`multi-select-option ${isSelected ? 'selected' : ''}`}
                              onClick={() => toggleSemanticView(view)}
                            >
                              <span className="option-checkbox">
                                {isSelected && <FiCheck />}
                              </span>
                              <span className="option-label">
                                <span className="option-name">{view.name}</span>
                                <span className="option-path">
                                  {view.database || view.databaseName}.{view.schema || view.schemaName}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Selected semantic views as cards */}
                  {selectedSemanticViews.length > 0 && (
                    <div className="selected-semantic-cards">
                      {selectedSemanticViews.map((view, idx) => (
                        <div key={view.fullyQualifiedName || view.name || idx} className="semantic-view-card">
                          <div className="card-icon">
                            <FiDatabase />
                          </div>
                          <div className="card-content">
                            <span className="card-name">{view.name}</span>
                            <span className="card-path">
                              {view.database || view.databaseName}.{view.schema || view.schemaName}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="card-remove"
                            onClick={() => removeSemanticView(view)}
                          >
                            <FiX />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="form-error">{error}</div>
            )}

            {/* Submit Error */}
            {submitError && (
              <div className="submit-error">
                <FiAlertCircle className="error-icon" />
                <span>{submitError}</span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={!canSubmit || isSubmitting}
              title={!hasSecureAuth ? 'MFA or SSO required' : !isAuthenticated ? 'Sign in to create dashboards' : !selectedConnection ? 'Select a connection' : ''}
            >
              {isSubmitting ? (
                <>
                  <FiLoader className="spinner" />
                  Creating...
                </>
              ) : (
                'Create Dashboard'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDashboardModal;
