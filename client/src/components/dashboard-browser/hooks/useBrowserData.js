import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { folderApi } from '../../../api/apiClient';
import { useAppStore } from '../../../store/appStore';

// Module-level cache so data survives component unmount/remount
const cache = {};
function getCacheKey(folderId, workspaceId) { return `${workspaceId || '_'}:${folderId || '__root__'}`; }

export const useBrowserData = (isInitialized, isAuthenticated) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeWorkspace = useAppStore(state => state.activeWorkspace);

  const initialFolderId = searchParams.get('folder') || null;
  const cached = cache[getCacheKey(initialFolderId, activeWorkspace?.id)];

  const [currentFolderId, setCurrentFolderId] = useState(initialFolderId);
  const [folderPath, setFolderPath] = useState(cached?.folderPath || []);
  const [folders, setFolders] = useState(cached?.folders || []);
  const [dashboards, setDashboards] = useState(cached?.dashboards || []);
  const [currentFolder, setCurrentFolder] = useState(cached?.currentFolder || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const loadContents = useCallback(async (folderId = null) => {
    const key = getCacheKey(folderId, activeWorkspace?.id);
    const hasCache = !!cache[key];
    if (!hasCache) setLoading(true);
    setError(null);
    try {
      const data = await folderApi.getContents(folderId, activeWorkspace?.id);
      const result = {
        folders: data.folders || [],
        dashboards: data.dashboards || [],
        currentFolder: data.folder || null,
        folderPath: data.path || [],
      };
      cache[key] = result;
      setFolders(result.folders);
      setDashboards(result.dashboards);
      setCurrentFolder(result.currentFolder);
      setFolderPath(result.folderPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;
    const folderId = searchParams.get('folder') || null;
    setCurrentFolderId(folderId);

    const key = getCacheKey(folderId, activeWorkspace?.id);
    const hit = cache[key];
    if (hit) {
      setFolders(hit.folders);
      setDashboards(hit.dashboards);
      setCurrentFolder(hit.currentFolder);
      setFolderPath(hit.folderPath);
      setLoading(false);
    }

    loadContents(folderId);
  }, [searchParams, loadContents, isInitialized, isAuthenticated]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const results = await folderApi.search(searchQuery, activeWorkspace?.id);
          setSearchResults({
            folders: results?.folders || [],
            dashboards: results?.dashboards || [],
          });
        } catch (err) {
          console.error('Search error:', err);
          setSearchResults({ folders: [], dashboards: [] });
        } finally {
          setIsSearching(false);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const navigateToFolder = (folderId) => {
    setSearchQuery('');
    setSearchResults(null);
    if (folderId) {
      setSearchParams({ folder: folderId });
    } else {
      setSearchParams({});
    }
  };

  const openDashboard = (dashboardId) => {
    navigate(`/workspaces/${activeWorkspace?.id}/dashboards?id=${dashboardId}`);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return {
    currentFolderId, folderPath, folders, dashboards, currentFolder,
    loading, error, loadContents,
    searchQuery, setSearchQuery, searchResults, setSearchResults, isSearching,
    navigateToFolder, openDashboard, formatDate,
  };
};
