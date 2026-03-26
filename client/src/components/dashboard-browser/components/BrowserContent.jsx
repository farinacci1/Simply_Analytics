import React from 'react';
import {
  FiFolder, FiGrid, FiPlus, FiChevronRight, FiHome,
  FiX, FiClock, FiUser, FiGlobe, FiLock, FiMoreVertical,
} from 'react-icons/fi';

export const Breadcrumb = ({ currentFolderId, folderPath, navigateToFolder }) => (
  <nav className="browser-breadcrumb">
    <button
      className={`breadcrumb-item ${!currentFolderId ? 'active' : ''}`}
      onClick={() => navigateToFolder(null)}
    >
      <FiHome /><span>All Dashboards</span>
    </button>
    {folderPath.map((folder, index) => (
      <span key={folder.id} className="breadcrumb-segment">
        <FiChevronRight className="breadcrumb-separator" />
        <button
          className={`breadcrumb-item ${index === folderPath.length - 1 ? 'active' : ''}`}
          onClick={() => navigateToFolder(folder.id)}
        >
          <span>{folder.name}</span>
        </button>
      </span>
    ))}
  </nav>
);

export const SearchResults = ({ searchResults, isSearching, searchQuery, onClear, navigateToFolder, openDashboard }) => {
  if (!searchResults) return null;
  const searchFolders = searchResults.folders || [];
  const searchDashboards = searchResults.dashboards || [];
  const hasResults = searchFolders.length > 0 || searchDashboards.length > 0;

  return (
    <div className="search-results">
      <div className="search-results-header">
        <h3>Search Results</h3>
        <button className="clear-search" onClick={onClear}><FiX /> Clear</button>
      </div>
      {!hasResults && !isSearching && <p className="no-results">No results found for "{searchQuery}"</p>}
      {searchFolders.length > 0 && (
        <div className="search-section">
          <h4>Folders</h4>
          <div className="items-grid">
            {searchFolders.map(folder => (
              <div key={folder.id} className="item-card folder-card" onClick={() => navigateToFolder(folder.id)}>
                <div className="item-icon" style={{ backgroundColor: folder.color || '#6366f1' }}><FiFolder /></div>
                <div className="item-info">
                  <h4>{folder.name}</h4>
                  <p>{folder.description || 'Folder'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {searchDashboards.length > 0 && (
        <div className="search-section">
          <h4>Dashboards</h4>
          <div className="items-grid">
            {searchDashboards.map(dashboard => (
              <div key={dashboard.id} className="item-card dashboard-card" onClick={() => openDashboard(dashboard.id)}>
                <div className="item-icon dashboard-icon"><FiGrid /></div>
                <div className="item-info">
                  <h4>{dashboard.name}</h4>
                  <p>{dashboard.description || 'Dashboard'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const FolderCard = ({ folder, canManageFolders, navigateToFolder, onContextMenu }) => (
  <div
    className="item-card folder-card"
    onClick={() => navigateToFolder(folder.id)}
    onContextMenu={(e) => {
      e.preventDefault();
      if (canManageFolders) onContextMenu(e, { folder });
    }}
  >
    <div className="item-icon" style={{ backgroundColor: folder.color || '#6366f1' }}><FiFolder /></div>
    <div className="item-info">
      <h4>{folder.name}</h4>
      <div className="item-meta">
        <span><FiFolder /> {folder.subfolder_count || 0}</span>
        <span><FiGrid /> {folder.dashboard_count || 0}</span>
      </div>
    </div>
    {canManageFolders && (
      <button className="item-menu-btn" onClick={(e) => { e.stopPropagation(); onContextMenu(e, { folder }); }}>
        <FiMoreVertical />
      </button>
    )}
  </div>
);

export const DashboardCard = ({ dashboard, canManageFolders, openDashboard, onContextMenu, formatDate }) => (
  <div
    className="item-card dashboard-card"
    onClick={() => openDashboard(dashboard.id)}
    onContextMenu={(e) => {
      e.preventDefault();
      if (canManageFolders) onContextMenu(e, { dashboard });
    }}
  >
    <div className="item-icon dashboard-icon"><FiGrid /></div>
    <div className="item-info">
      <h4>{dashboard.name}</h4>
      <div className="item-meta">
        <span className="meta-item"><FiUser /> {dashboard.owner_name}</span>
        <span className="meta-item"><FiClock /> {formatDate(dashboard.updated_at)}</span>
        <span className={`visibility-badge ${dashboard.visibility}`}>
          {dashboard.visibility === 'public' ? <FiGlobe /> : <FiLock />}
          {dashboard.visibility}
        </span>
      </div>
    </div>
    {canManageFolders && (
      <button className="item-menu-btn" onClick={(e) => { e.stopPropagation(); onContextMenu(e, { dashboard }); }}>
        <FiMoreVertical />
      </button>
    )}
  </div>
);

export const EmptyState = ({ currentFolderId, canCreateDashboards, onCreateDashboard }) => (
  <div className="browser-empty">
    <div className="empty-icon-wrapper"><FiGrid /></div>
    <h2>{currentFolderId ? 'This folder is empty' : 'No dashboards yet'}</h2>
    <p>
      {canCreateDashboards
        ? (currentFolderId
          ? 'Add a dashboard or folder to organize your work'
          : 'Create your first dashboard to start visualizing and analyzing your data.')
        : 'You don\'t have access to any dashboards yet. Contact an admin to get access.'}
    </p>
    {canCreateDashboards && (
      <button className="btn btn-primary" onClick={onCreateDashboard}><FiPlus /> Create Dashboard</button>
    )}
  </div>
);
