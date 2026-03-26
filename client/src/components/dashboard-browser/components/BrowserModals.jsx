import React from 'react';
import {
  FiFolder, FiPlus, FiX, FiMove, FiSearch, FiHome, FiUsers,
} from 'react-icons/fi';

export const CreateFolderModal = ({
  folderName, setFolderName, error, setError,
  creating, onCreate, onClose,
}) => (
  <div className="modal-overlay">
    <div className="modal create-folder-modal">
      <div className="modal-header">
        <h2><FiFolder /> New Folder</h2>
        <button className="close-btn" onClick={() => { onClose(); setFolderName(''); setError(''); }}><FiX /></button>
      </div>
      <div className="modal-body">
        <label>Folder Name</label>
        <input
          type="text" value={folderName}
          onChange={(e) => { setFolderName(e.target.value); setError(''); }}
          placeholder="Enter folder name" autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') onCreate(); }}
        />
        {error && <p className="error-text">{error}</p>}
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={() => { onClose(); setFolderName(''); setError(''); }}>Cancel</button>
        <button className="btn btn-primary" onClick={onCreate} disabled={creating || !folderName.trim()}>
          {creating ? 'Creating...' : 'Create Folder'}
        </button>
      </div>
    </div>
  </div>
);

export const MoveDashboardModal = ({
  dashboard, allFolders, loadingFolders,
  selectedMoveFolder, setSelectedMoveFolder,
  movingError, dropdownOpen, setDropdownOpen,
  showInlineCreate, setShowInlineCreate,
  inlineFolderName, setInlineFolderName,
  creatingInlineFolder, folderSearchQuery, setFolderSearchQuery,
  onMove, onInlineCreate, onClose,
}) => (
  <div className="modal-overlay">
    <div className="modal move-dashboard-modal">
      <div className="modal-header">
        <h2><FiMove /> Move Dashboard</h2>
        <button className="close-btn" onClick={onClose}><FiX /></button>
      </div>
      <div className="modal-body">
        <p className="move-dashboard-info">Moving <strong>{dashboard.name}</strong> to:</p>
        {loadingFolders ? (
          <div className="loading-folders">Loading folders...</div>
        ) : (
          <div className="folder-selector">
            <button type="button" className="folder-selector-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
              {selectedMoveFolder && selectedMoveFolder !== 'root' ? (
                <>
                  <FiFolder style={{ color: allFolders.find(f => f.id === selectedMoveFolder)?.color || '#6366f1' }} />
                  {allFolders.find(f => f.id === selectedMoveFolder)?.name || 'Selected Folder'}
                </>
              ) : (
                <><FiHome /> Root (No folder)</>
              )}
            </button>
            {dropdownOpen && (
              <div className="folder-dropdown">
                <div className="folder-search-container">
                  <FiSearch className="folder-search-icon" />
                  <input
                    type="text" className="folder-search-input" placeholder="Search folders..."
                    value={folderSearchQuery} onChange={(e) => setFolderSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()} autoFocus
                  />
                </div>
                <div className="folder-options-list">
                  {(!folderSearchQuery || 'root'.includes(folderSearchQuery.toLowerCase()) || 'no folder'.includes(folderSearchQuery.toLowerCase())) && (
                    <button type="button" className={`folder-option ${!selectedMoveFolder || selectedMoveFolder === 'root' ? 'selected' : ''}`}
                      onClick={() => { setSelectedMoveFolder('root'); setDropdownOpen(false); setFolderSearchQuery(''); }}>
                      <FiHome /> Root (No folder)
                    </button>
                  )}
                  {allFolders
                    .filter(folder => !folderSearchQuery || folder.name.toLowerCase().includes(folderSearchQuery.toLowerCase()))
                    .map(folder => (
                      <button key={folder.id} type="button"
                        className={`folder-option ${selectedMoveFolder === folder.id ? 'selected' : ''}`}
                        onClick={() => { setSelectedMoveFolder(folder.id); setDropdownOpen(false); setFolderSearchQuery(''); }}>
                        <FiFolder style={{ color: folder.color || '#6366f1' }} /> {folder.name}
                      </button>
                    ))}
                </div>
                {showInlineCreate ? (
                  <div className="inline-create-folder">
                    <input type="text" placeholder="New folder name..." value={inlineFolderName}
                      onChange={(e) => setInlineFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onInlineCreate();
                        if (e.key === 'Escape') { setShowInlineCreate(false); setInlineFolderName(''); }
                      }}
                      autoFocus disabled={creatingInlineFolder}
                    />
                    <button type="button" className="inline-create-btn" onClick={onInlineCreate} disabled={!inlineFolderName.trim() || creatingInlineFolder}>
                      {creatingInlineFolder ? '...' : <FiPlus />}
                    </button>
                    <button type="button" className="inline-cancel-btn" onClick={() => { setShowInlineCreate(false); setInlineFolderName(''); }}>
                      <FiX />
                    </button>
                  </div>
                ) : (
                  <button type="button" className="folder-option create-new-folder" onClick={() => setShowInlineCreate(true)}>
                    <FiPlus /> Create New Folder <span className="folder-hint">(at root)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {movingError && <p className="error-text">{movingError}</p>}
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={onMove} disabled={loadingFolders}>Move Dashboard</button>
      </div>
    </div>
  </div>
);

export const FolderAccessModal = ({
  folder, folderGroups, loadingFolderAccess,
  selectedGroupToAdd, setSelectedGroupToAdd,
  availableGroupsForFolder, availableGroupsCount,
  folderAccessError,
  onAdd, onRemove, onClose,
}) => (
  <div className="modal-overlay">
    <div className="modal folder-access-modal">
      <div className="modal-header">
        <h2><FiUsers /> Manage Folder Access</h2>
        <button className="close-btn" onClick={onClose}><FiX /></button>
      </div>
      <div className="modal-body">
        <p className="folder-access-info">Managing access for: <strong>{folder.name}</strong></p>
        {loadingFolderAccess ? (
          <div className="loading-access">Loading access settings...</div>
        ) : (
          <>
            <div className="add-group-section">
              <label>Add Group Access</label>
              <div className="add-group-row">
                <select value={selectedGroupToAdd} onChange={(e) => setSelectedGroupToAdd(e.target.value)} className="group-select">
                  <option value="">Select a group...</option>
                  {availableGroupsForFolder.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                <button className="btn btn-primary btn-small" onClick={onAdd} disabled={!selectedGroupToAdd}>
                  <FiPlus /> Add
                </button>
              </div>
              {availableGroupsForFolder.length === 0 && availableGroupsCount > 0 && (
                <p className="no-groups-hint">All groups have been added to this folder</p>
              )}
              {availableGroupsCount === 0 && (
                <p className="no-groups-hint">No groups available. Create groups in User Management.</p>
              )}
            </div>
            <div className="current-groups-section">
              <label>Groups with Access</label>
              {folderGroups.length === 0 ? (
                <p className="no-groups-message">No groups have access to this folder yet.</p>
              ) : (
                <ul className="groups-list">
                  {folderGroups.map(group => (
                    <li key={group.id} className="group-item">
                      <div className="group-info">
                        <FiUsers className="group-icon" />
                        <span className="group-name">{group.name}</span>
                        {group.granted_by_name && <span className="granted-by">Added by {group.granted_by_name}</span>}
                      </div>
                      <button className="remove-group-btn" onClick={() => onRemove(group.id)} title="Remove access"><FiX /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {folderAccessError && <p className="error-text">{folderAccessError}</p>}
          </>
        )}
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>
);
