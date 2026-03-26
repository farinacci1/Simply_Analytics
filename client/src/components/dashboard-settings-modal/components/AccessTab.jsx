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
  FiEdit,
  FiLock,
  FiUsers,
  FiTrash2,
  FiSearch,
  FiPlus,
  FiChevronDown,
  FiUserCheck,
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
  setWarehouse,
  availableWarehouses,
  loadingResources,
  role,
  setRole,
  availableRoles,
  isPublished,
  setIsPublished,
  visibility,
  setVisibility,
  accessList,
  removeAccessRole,
  groupSearchRef,
  groupSearchQuery,
  setGroupSearchQuery,
  newRole,
  setNewRole,
  showGroupDropdown,
  setShowGroupDropdown,
  filteredGroupsForAccess,
  selectGroupForAccess,
  addAccessRole,
  adminRoles,
  transferOwnerTo,
  setTransferOwnerTo,
  showTransferConfirm,
  setShowTransferConfirm,
  handleTransferOwnership,
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
                      left: rect.right - 180, // dropdown width
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

        {/* Warehouse Selection */}
        <div className="form-group">
          <label className="form-label">
            <FiServer className="label-icon" />
            Warehouse
          </label>
          <div className="select-wrapper">
            <select className="form-input" value={warehouse} onChange={(e) => setWarehouse(e.target.value)} disabled={loadingResources}>
              {warehouse && <option value={warehouse}>{warehouse}</option>}
              {availableWarehouses
                .filter((wh) => (wh.name || wh) !== warehouse)
                .map((wh) => (
                  <option key={wh.name || wh} value={wh.name || wh}>
                    {wh.name || wh}
                  </option>
                ))}
            </select>
            <FiChevronDown className="select-icon" />
            {loadingResources && <FiRefreshCw className="loading-icon spin" />}
          </div>
        </div>

        {/* Role Selection */}
        <div className="form-group">
          <label className="form-label">
            <FiUser className="label-icon" />
            Role
          </label>
          <div className="select-wrapper">
            <select className="form-input" value={role} onChange={(e) => setRole(e.target.value)} disabled={loadingResources}>
              {role && <option value={role}>{role}</option>}
              {availableRoles
                .filter((r) => (r.name || r) !== role)
                .map((r) => (
                  <option key={r.name || r} value={r.name || r}>
                    {r.name || r}
                  </option>
                ))}
            </select>
            <FiChevronDown className="select-icon" />
            {loadingResources && <FiRefreshCw className="loading-icon spin" />}
          </div>
        </div>
      </div>

      {/* Publication Status */}
      <div className="settings-subsection">
        <h3 className="subsection-title">
          <FiEye /> Publication Status
        </h3>
        <div className="published-toggle">
          <button type="button" className={`toggle-option ${!isPublished ? 'active' : ''}`} onClick={() => setIsPublished(false)}>
            <FiEdit size={14} />
            Draft
          </button>
          <button type="button" className={`toggle-option ${isPublished ? 'active' : ''}`} onClick={() => setIsPublished(true)}>
            <FiEye size={14} />
            Published
          </button>
        </div>
        <p className="form-hint">
          {isPublished
            ? 'This dashboard is published and visible to permitted users.'
            : 'Draft mode — only you can see this dashboard while editing.'}
        </p>
      </div>

      {/* Access Type: Private/Public */}
      <div className="settings-subsection">
        <h3 className="subsection-title">
          <FiLock /> Access Type
        </h3>
        <div className="published-toggle">
          <button
            type="button"
            className={`toggle-option ${visibility === 'private' ? 'active' : ''}`}
            onClick={() => setVisibility('private')}
          >
            <FiLock size={14} />
            Private
          </button>
          <button type="button" className={`toggle-option ${visibility === 'public' ? 'active' : ''}`} onClick={() => setVisibility('public')}>
            <FiUsers size={14} />
            Public
          </button>
        </div>
        <p className="form-hint">
          {visibility === 'public'
            ? 'All users in the organization can view this dashboard when published.'
            : 'Only user groups added below can access this dashboard.'}
        </p>
      </div>

      {/* Access Control - Group Based (only for private dashboards) */}
      {visibility === 'private' && (
        <div className="settings-subsection">
          <h3 className="subsection-title">
            <FiUsers /> Group Access
          </h3>
          <p className="section-description">
            Add groups that can access this private dashboard. Users' permissions are determined by their app role (Admin, Editor, Viewer).
          </p>

          <div className="access-list">
            {/* Owner - always shown first */}
            <div className="access-item owner">
              <div className="access-role">
                <FiLock className="role-icon owner" />
                <span>{dashboard?.ownerUsername || dashboard?.owner_username || 'Owner'}</span>
                <span className="role-badge owner">Owner</span>
              </div>
              <div className="access-permission">
                <span className="permission-text">Full Control</span>
              </div>
            </div>

            {/* Groups with access */}
            {accessList.map((access) => (
              <div key={access.groupId || access.role} className="access-item">
                <div className="access-role">
                  <FiUsers className="role-icon" />
                  <span>{access.groupName || access.role}</span>
                </div>
                <div className="access-permission">
                  <span className="permission-text group-access">Has Access</span>
                  <button className="remove-access-btn" onClick={() => removeAccessRole(access.groupId || access.role)} title="Remove access">
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add group access */}
          <div className="add-access">
            <h4>Add Group Access</h4>
            <div className="add-access-form">
              <div className="group-search-wrapper" ref={groupSearchRef} style={{ flex: 1 }}>
                <div className="search-input-container">
                  <FiSearch className="search-icon" />
                  <input
                    type="text"
                    className="form-input search-input"
                    placeholder="Search groups..."
                    value={groupSearchQuery}
                    onChange={(e) => {
                      setGroupSearchQuery(e.target.value);
                      setNewRole(''); // Clear selection when typing
                      setShowGroupDropdown(true);
                    }}
                    onFocus={() => setShowGroupDropdown(true)}
                  />
                  {groupSearchQuery && (
                    <button
                      className="clear-search-btn"
                      onClick={() => {
                        setGroupSearchQuery('');
                        setNewRole('');
                      }}
                    >
                      <FiX />
                    </button>
                  )}
                </div>
                {showGroupDropdown && (
                  <div className="group-search-dropdown">
                    {filteredGroupsForAccess.length === 0 ? (
                      <div className="no-results">
                        {groupSearchQuery ? 'No groups match your search' : 'All groups already have access'}
                      </div>
                    ) : (
                      filteredGroupsForAccess.map((group) => (
                        <button
                          key={group.id}
                          className={`group-option ${newRole === group.id ? 'selected' : ''}`}
                          onClick={() => selectGroupForAccess(group)}
                        >
                          <FiUsers className="group-icon" />
                          <span className="group-name">{group.name}</span>
                          <span className="member-count">{group.memberCount || 0} members</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button className="btn btn-secondary add-btn" onClick={addAccessRole} disabled={!newRole}>
                <FiPlus /> Add Group
              </button>
            </div>
            <p className="form-hint">Search for a group to grant access. User permissions are based on their app role.</p>
          </div>
        </div>
      )}

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
