import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { folderApi } from '../../../api/apiClient';

export const useBrowserData = (isInitialized, isAuthenticated) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const [folders, setFolders] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const loadContents = useCallback(async (folderId = null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await folderApi.getContents(folderId);
      setFolders(data.folders || []);
      setDashboards(data.dashboards || []);
      setCurrentFolder(data.folder || null);
      setFolderPath(data.path || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;
    const folderId = searchParams.get('folder');
    setCurrentFolderId(folderId);
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
          const results = await folderApi.search(searchQuery);
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
    navigate(`/dashboards?id=${dashboardId}`);
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
