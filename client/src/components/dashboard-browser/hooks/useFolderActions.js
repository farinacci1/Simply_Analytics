import { useState } from 'react';
import { useAppStore } from '../../../store/appStore';
import { folderApi, dashboardApi } from '../../../api/apiClient';

export const useFolderActions = (currentFolderId, loadContents) => {
  const { activeWorkspace } = useAppStore();
  // Create folder
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderError, setNewFolderError] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Delete folder
  const [deletingFolder, setDeletingFolder] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  // Delete dashboard
  const [deletingDashboard, setDeletingDashboard] = useState(null);
  const [deleteDashboardError, setDeleteDashboardError] = useState('');

  // Move dashboard
  const [movingDashboard, setMovingDashboard] = useState(null);
  const [allFolders, setAllFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedMoveFolder, setSelectedMoveFolder] = useState(null);
  const [movingError, setMovingError] = useState('');

  // Move folder dropdown
  const [moveFolderDropdownOpen, setMoveFolderDropdownOpen] = useState(false);
  const [showInlineCreateFolder, setShowInlineCreateFolder] = useState(false);
  const [inlineFolderName, setInlineFolderName] = useState('');
  const [creatingInlineFolder, setCreatingInlineFolder] = useState(false);
  const [folderSearchQuery, setFolderSearchQuery] = useState('');

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setNewFolderError('Folder name is required');
      return;
    }
    setCreatingFolder(true);
    setNewFolderError('');
    try {
      await folderApi.create({ name: newFolderName.trim(), parentId: currentFolderId, workspaceId: activeWorkspace?.id });
      setNewFolderName('');
      setShowCreateFolder(false);
      loadContents(currentFolderId);
    } catch (err) {
      setNewFolderError(err.message);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!deletingFolder) return;
    try {
      await folderApi.delete(deletingFolder.id);
      setDeletingFolder(null);
      setDeleteError('');
      loadContents(currentFolderId);
    } catch (err) {
      setDeleteError(err.message);
    }
  };

  const handleDeleteDashboard = async () => {
    if (!deletingDashboard) return;
    try {
      await dashboardApi.delete(deletingDashboard.id);
      setDeletingDashboard(null);
      setDeleteDashboardError('');
      loadContents(currentFolderId);
    } catch (err) {
      setDeleteDashboardError(err.message);
    }
  };

  const openMoveDashboardModal = async (dashboard) => {
    setMovingDashboard(dashboard);
    setSelectedMoveFolder(dashboard.folder_id || 'root');
    setMovingError('');
    setMoveFolderDropdownOpen(false);
    setShowInlineCreateFolder(false);
    setInlineFolderName('');
    setFolderSearchQuery('');
    setLoadingFolders(true);
    try {
      const allFoldersData = await folderApi.getContents(null, activeWorkspace?.id);
      setAllFolders(allFoldersData.folders || []);
    } catch (err) {
      console.error('Failed to load folders:', err);
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleMoveDashboard = async () => {
    if (!movingDashboard) return;
    const targetFolderId = selectedMoveFolder === 'root' ? null : selectedMoveFolder;
    try {
      await folderApi.moveDashboard(movingDashboard.id, targetFolderId);
      setMovingDashboard(null);
      setMovingError('');
      setShowInlineCreateFolder(false);
      setInlineFolderName('');
      loadContents(currentFolderId);
    } catch (err) {
      setMovingError(err.message);
    }
  };

  const handleInlineCreateFolder = async () => {
    if (!inlineFolderName.trim()) return;
    setCreatingInlineFolder(true);
    try {
      const newFolder = await folderApi.create({ name: inlineFolderName.trim(), parentId: null, workspaceId: activeWorkspace?.id });
      setAllFolders(prev => [...prev, newFolder]);
      setSelectedMoveFolder(newFolder.id);
      setShowInlineCreateFolder(false);
      setInlineFolderName('');
      setFolderSearchQuery('');
      setMoveFolderDropdownOpen(false);
    } catch (err) {
      setMovingError(err.message);
    } finally {
      setCreatingInlineFolder(false);
    }
  };

  const closeMoveDashboardModal = () => {
    setMovingDashboard(null);
    setMovingError('');
    setMoveFolderDropdownOpen(false);
    setShowInlineCreateFolder(false);
    setInlineFolderName('');
    setFolderSearchQuery('');
  };

  return {
    // Create folder
    showCreateFolder, setShowCreateFolder,
    newFolderName, setNewFolderName, newFolderError, setNewFolderError,
    creatingFolder, handleCreateFolder,
    // Delete folder
    deletingFolder, setDeletingFolder, deleteError, setDeleteError, handleDeleteFolder,
    // Delete dashboard
    deletingDashboard, setDeletingDashboard, deleteDashboardError, setDeleteDashboardError, handleDeleteDashboard,
    // Move dashboard
    movingDashboard, allFolders, loadingFolders,
    selectedMoveFolder, setSelectedMoveFolder,
    movingError, moveFolderDropdownOpen, setMoveFolderDropdownOpen,
    showInlineCreateFolder, setShowInlineCreateFolder,
    inlineFolderName, setInlineFolderName,
    creatingInlineFolder, folderSearchQuery, setFolderSearchQuery,
    openMoveDashboardModal, handleMoveDashboard, handleInlineCreateFolder, closeMoveDashboardModal,
  };
};
