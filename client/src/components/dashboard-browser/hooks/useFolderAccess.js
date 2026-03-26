import { useState } from 'react';
import { folderApi, groupApi } from '../../../api/apiClient';

export const useFolderAccess = () => {
  const [managingAccessFolder, setManagingAccessFolder] = useState(null);
  const [folderGroups, setFolderGroups] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [loadingFolderAccess, setLoadingFolderAccess] = useState(false);
  const [selectedGroupToAdd, setSelectedGroupToAdd] = useState('');
  const [folderAccessError, setFolderAccessError] = useState('');

  const openFolderAccessModal = async (folder) => {
    setManagingAccessFolder(folder);
    setLoadingFolderAccess(true);
    setFolderAccessError('');
    setSelectedGroupToAdd('');
    try {
      const accessData = await folderApi.getAccess(folder.id);
      setFolderGroups(accessData.groups || []);
      const allGroups = await groupApi.getAll();
      setAvailableGroups(allGroups.groups || []);
    } catch (err) {
      console.error('Failed to load folder access:', err);
      setFolderAccessError('Failed to load access settings');
    } finally {
      setLoadingFolderAccess(false);
    }
  };

  const handleAddFolderAccess = async () => {
    if (!selectedGroupToAdd || !managingAccessFolder) return;
    try {
      await folderApi.grantAccess(managingAccessFolder.id, selectedGroupToAdd);
      const accessData = await folderApi.getAccess(managingAccessFolder.id);
      setFolderGroups(accessData.groups || []);
      setSelectedGroupToAdd('');
    } catch (err) {
      console.error('Failed to add group access:', err);
      setFolderAccessError(err.message || 'Failed to add group access');
    }
  };

  const handleRemoveFolderAccess = async (groupId) => {
    if (!managingAccessFolder) return;
    try {
      await folderApi.revokeAccess(managingAccessFolder.id, groupId);
      setFolderGroups(prev => prev.filter(g => g.id !== groupId));
    } catch (err) {
      console.error('Failed to remove group access:', err);
      setFolderAccessError(err.message || 'Failed to remove group access');
    }
  };

  const closeFolderAccessModal = () => {
    setManagingAccessFolder(null);
    setFolderGroups([]);
    setFolderAccessError('');
    setSelectedGroupToAdd('');
  };

  const getAvailableGroupsForFolder = () => {
    const addedGroupIds = folderGroups.map(g => g.id);
    return availableGroups.filter(g => !addedGroupIds.includes(g.id));
  };

  return {
    managingAccessFolder, folderGroups, availableGroups,
    loadingFolderAccess, selectedGroupToAdd, setSelectedGroupToAdd,
    folderAccessError,
    openFolderAccessModal, handleAddFolderAccess, handleRemoveFolderAccess,
    closeFolderAccessModal, getAvailableGroupsForFolder,
  };
};
