import { useState, useEffect } from 'react';
import { groupApi } from '../../../api/apiClient';

export const useGroupManagement = (toast) => {
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupMembersLoading, setGroupMembersLoading] = useState(false);

  // Modal states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Form state
  const [groupFormData, setGroupFormData] = useState({ name: '', description: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // Delete / remove
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');

  useEffect(() => { loadGroups(); }, []);

  const loadGroups = async () => {
    try {
      setGroupsLoading(true);
      const response = await groupApi.getAll();
      setGroups(response.groups || []);
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setGroupsLoading(false);
    }
  };

  const loadGroupMembers = async (groupId) => {
    try {
      setGroupMembersLoading(true);
      const response = await groupApi.getMembers(groupId);
      setGroupMembers(response.members || []);
    } catch (err) {
      console.error('Failed to load group members:', err);
    } finally {
      setGroupMembersLoading(false);
    }
  };

  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    loadGroupMembers(group.id);
  };

  const isGroupNameTaken = (name, excludeId = null) => {
    if (!name || !name.trim()) return false;
    return groups.some(g => 
      g.name.toLowerCase() === name.trim().toLowerCase() && g.id !== excludeId
    );
  };

  const closeCreateGroupModal = () => {
    setShowCreateGroupModal(false);
    setGroupFormData({ name: '', description: '' });
    setFormError(null);
  };

  const closeEditGroupModal = () => {
    setShowEditGroupModal(false);
    setGroupFormData({ name: '', description: '' });
    setFormError(null);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      await groupApi.create(groupFormData);
      await loadGroups();
      closeCreateGroupModal();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!selectedGroup) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await groupApi.update(selectedGroup.id, groupFormData);
      await loadGroups();
      closeEditGroupModal();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    try {
      await groupApi.delete(groupToDelete.id);
      await loadGroups();
      if (selectedGroup?.id === groupToDelete.id) {
        setSelectedGroup(null);
        setGroupMembers([]);
      }
      toast.success(`Group "${groupToDelete.name}" deleted`);
      setGroupToDelete(null);
    } catch (err) {
      toast.error(err.message);
      setGroupToDelete(null);
    }
  };

  const handleAddMember = async () => {
    if (!selectedGroup || !selectedUserToAdd) return;
    try {
      await groupApi.addMember(selectedGroup.id, selectedUserToAdd);
      await loadGroupMembers(selectedGroup.id);
      await loadGroups();
      setShowAddMemberModal(false);
      setSelectedUserToAdd('');
      toast.success('Member added to group');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRemoveMember = (userId) => {
    if (!selectedGroup) return;
    setMemberToRemove(userId);
  };

  const confirmRemoveMember = async () => {
    if (!selectedGroup || !memberToRemove) return;
    try {
      await groupApi.removeMember(selectedGroup.id, memberToRemove);
      await loadGroupMembers(selectedGroup.id);
      await loadGroups();
      toast.success('Member removed from group');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setMemberToRemove(null);
    }
  };

  const openEditGroupModal = (group) => {
    setSelectedGroup(group);
    setGroupFormData({ name: group.name, description: group.description || '' });
    setShowEditGroupModal(true);
  };

  return {
    groups, groupsLoading, selectedGroup, groupMembers, groupMembersLoading,
    groupFormData, setGroupFormData, formLoading, formError,
    showCreateGroupModal, setShowCreateGroupModal,
    showEditGroupModal,
    showAddMemberModal, setShowAddMemberModal,
    groupToDelete, setGroupToDelete,
    memberToRemove, setMemberToRemove,
    selectedUserToAdd, setSelectedUserToAdd,
    isGroupNameTaken,
    handleSelectGroup, handleCreateGroup, handleUpdateGroup, handleDeleteGroup,
    handleAddMember, handleRemoveMember, confirmRemoveMember,
    openEditGroupModal, closeCreateGroupModal, closeEditGroupModal,
  };
};
