import React, { useState, useEffect, useCallback } from 'react';
import {
  FiUsers, FiUserPlus, FiEdit2, FiTrash2, FiShield,
  FiSearch, FiLoader, FiPlus, FiUserMinus, FiLayers, FiX,
} from 'react-icons/fi';
import { useAppStore } from '../store/appStore';
import { useToast } from '../components/Toast';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { workspaceApi } from '../api/modules/workspaceApi.js';
import '../styles/UsersManagement.css';

import { ROLE_LABELS, ROLE_COLORS } from '../components/users-management/constants';
import UserRow from '../components/users-management/components/UserRow';
import { useUserManagement } from '../components/users-management/hooks/useUserManagement';
import {
  CreateUserModal, EditUserModal, TransferOwnershipModal,
  LockConfirmModal, UnlockAccountModal, MfaBypassModal,
  ResetMfaConfirmModal, TransferDashboardsModal,
} from '../components/users-management/components/UserModals';

const UsersManagement = () => {
  const { currentUser, currentRole, workspaces, loadWorkspaces } = useAppStore();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('users');

  const um = useUserManagement(currentUser?.username, currentRole, toast);

  const canManageUsers = ['owner', 'admin'].includes(currentRole);
  const canCreateUsers = ['owner', 'admin'].includes(currentRole);
  const canManageWorkspaces = ['owner', 'admin'].includes(currentRole);

  // Workspace members management state
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [wsMembers, setWsMembers] = useState([]);
  const [wsMembersLoading, setWsMembersLoading] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');

  useEffect(() => { loadWorkspaces(); }, []);

  const handleSelectWorkspace = useCallback(async (ws) => {
    setSelectedWorkspace(ws);
    setWsMembersLoading(true);
    try {
      const data = await workspaceApi.getMembers(ws.id);
      setWsMembers(data.members || []);
    } catch (err) {
      toast.error('Failed to load members: ' + err.message);
    } finally {
      setWsMembersLoading(false);
    }
  }, [toast]);

  const handleAddMember = useCallback(async () => {
    if (!selectedUserToAdd || !selectedWorkspace) return;
    try {
      const data = await workspaceApi.addMember(selectedWorkspace.id, selectedUserToAdd);
      setWsMembers(data.members || []);
      setShowAddMemberModal(false);
      setSelectedUserToAdd('');
      toast.success('Member added');
    } catch (err) {
      toast.error(err.message);
    }
  }, [selectedUserToAdd, selectedWorkspace, toast]);

  const handleRemoveMember = useCallback(async (userId) => {
    if (!selectedWorkspace) return;
    try {
      await workspaceApi.removeMember(selectedWorkspace.id, userId);
      setWsMembers(prev => prev.filter(m => m.id !== userId));
      toast.success('Member removed');
    } catch (err) {
      toast.error(err.message);
    }
  }, [selectedWorkspace, toast]);

  const availableUsersForWorkspace = um.users.filter(user =>
    !wsMembers.some(member => member.id === user.id)
  );

  if (!canManageUsers) {
    return (
      <div className="users-management">
        <div className="access-denied">
          <FiShield size={48} />
          <h2>Access Denied</h2>
          <p>Only administrators can access user management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="users-management">
      <div className="users-header">
        <div className="header-left">
          <FiUsers className="header-icon" />
          <div>
            <h1>User Management</h1>
            <p>{um.users.length} users, {workspaces.length} workspaces</p>
          </div>
        </div>
      </div>

      <div className="management-tabs">
        <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          <FiUsers /> Users
        </button>
        <button className={`tab-btn ${activeTab === 'workspaces' ? 'active' : ''}`} onClick={() => setActiveTab('workspaces')}>
          <FiLayers /> Workspaces
        </button>
      </div>

      {um.error && <div className="error-banner"><FiX />{um.error}</div>}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="tab-content">
          <div className="content-header">
            <div className="search-box">
              <FiSearch />
              <input type="text" placeholder="Search users..." value={um.searchQuery} onChange={(e) => um.setSearchQuery(e.target.value)} />
            </div>
            {canCreateUsers && (
              <button className="btn-primary" onClick={() => um.setShowCreateModal(true)}>
                <FiUserPlus /> Add User
              </button>
            )}
          </div>

          {um.loading ? (
            <div className="loading-state"><FiLoader className="spinner" /><p>Loading users...</p></div>
          ) : um.filteredUsers.length === 0 ? (
            <div className="empty-users-state"><FiUsers size={40} /><p>No users found</p></div>
          ) : (
            <div className="users-table-wrapper">
              <table className="users-table">
                <thead>
                  <tr>
                    <th className="col-name"><span className="sortable">NAME</span></th>
                    <th className="col-role">ROLE</th>
                    <th className="col-status">STATUS</th>
                    <th className="col-active">LAST ACTIVE</th>
                    <th className="col-settings"></th>
                  </tr>
                </thead>
                <tbody>
                  {um.filteredUsers.map(user => (
                    <UserRow
                      key={user.id}
                      user={user}
                      currentUser={currentUser?.username}
                      currentRole={currentRole}
                      canManageUsers={canManageUsers}
                      canDelete={um.canDeleteUser(user)}
                      onUpdateRole={um.handleUpdateRole}
                      onEdit={um.openEditModal}
                      onDelete={() => um.setUserToDelete(user)}
                      onTransferOwnership={um.openTransferOwnershipModal}
                      onLockAccount={um.handleLockAccount}
                      onUnlockAccount={um.openUnlockModal}
                      onMfaBypass={um.openMfaBypassModal}
                      onResetMfa={um.handleResetMfa}
                      assignableRoles={um.getAssignableRoles()}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Workspace Members Tab */}
      {activeTab === 'workspaces' && (
        <div className="tab-content groups-tab">
          {!canManageWorkspaces ? (
            <div className="access-notice"><FiShield /><p>Only admins can manage workspace members.</p></div>
          ) : (
            <div className="groups-layout">
              <div className="groups-list-panel">
                <div className="panel-header">
                  <h3>Workspaces</h3>
                </div>

                {workspaces.length === 0 ? (
                  <div className="empty-groups">
                    <FiLayers size={32} /><p>No workspaces yet</p>
                  </div>
                ) : (
                  <div className="groups-list">
                    {workspaces.map(ws => (
                      <div key={ws.id} className={`group-item ${selectedWorkspace?.id === ws.id ? 'selected' : ''}`} onClick={() => handleSelectWorkspace(ws)}>
                        <div className="group-info">
                          <div className="group-icon"><FiLayers /></div>
                          <div>
                            <div className="group-name">{ws.name}</div>
                            <div className="group-meta">{ws.member_count || 0} members</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="group-members-panel">
                {!selectedWorkspace ? (
                  <div className="no-selection"><FiUsers size={40} /><p>Select a workspace to manage members</p></div>
                ) : (
                  <>
                    <div className="panel-header">
                      <div>
                        <h3>{selectedWorkspace.name}</h3>
                        {selectedWorkspace.description && <p className="group-description">{selectedWorkspace.description}</p>}
                      </div>
                      <button className="btn-primary btn-sm" onClick={() => setShowAddMemberModal(true)}>
                        <FiUserPlus /> Add Member
                      </button>
                    </div>

                    {wsMembersLoading ? (
                      <div className="loading-state"><FiLoader className="spinner" /></div>
                    ) : wsMembers.length === 0 ? (
                      <div className="empty-members">
                        <FiUsers size={32} /><p>No members in this workspace</p>
                        <button className="btn-primary btn-sm" onClick={() => setShowAddMemberModal(true)}>Add First Member</button>
                      </div>
                    ) : (
                      <div className="members-list">
                        {wsMembers.map(member => (
                          <div key={member.id} className="member-item">
                            <div className="member-info">
                              <div className="user-avatar">{(member.display_name || member.username || '?')[0].toUpperCase()}</div>
                              <div>
                                <div className="member-name">{member.display_name || member.username}</div>
                                <div className="member-email">{member.email}</div>
                              </div>
                            </div>
                            <span className="role-badge" style={{ backgroundColor: ROLE_COLORS[member.role] }}>{ROLE_LABELS[member.role]}</span>
                            <button className="remove-member-btn" onClick={() => handleRemoveMember(member.id)} title="Remove from workspace"><FiUserMinus /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Modals */}
      {um.showCreateModal && (
        <CreateUserModal
          formData={um.formData} setFormData={um.setFormData}
          formError={um.formError} formLoading={um.formLoading}
          onSubmit={um.handleCreateUser} onClose={() => um.setShowCreateModal(false)}
          assignableRoles={um.getAssignableRoles()}
          passwordPolicy={um.passwordPolicy}
        />
      )}

      {um.showEditModal && um.selectedUser && (
        <EditUserModal
          formData={um.formData} setFormData={um.setFormData}
          formError={um.formError} formLoading={um.formLoading}
          selectedUser={um.selectedUser} currentUser={currentUser?.username}
          onSubmit={um.handleEditUser} onClose={() => um.setShowEditModal(false)}
          passwordPolicy={um.passwordPolicy}
        />
      )}

      {um.showTransferOwnershipModal && um.transferTargetUser && (
        <TransferOwnershipModal
          targetUser={um.transferTargetUser}
          confirmText={um.transferConfirmText} setConfirmText={um.setTransferConfirmText}
          error={um.transferError} loading={um.transferLoading}
          onTransfer={um.handleTransferOwnership} onClose={um.closeTransferOwnershipModal}
        />
      )}

      {um.showLockConfirm && um.userToLock && (
        <LockConfirmModal
          user={um.userToLock}
          onConfirm={um.confirmLockAccount}
          onClose={() => { um.setShowLockConfirm(false); um.setUserToLock(null); }}
        />
      )}

      {um.showUnlockModal && um.selectedUser && (
        <UnlockAccountModal
          user={um.selectedUser}
          unlockDuration={um.unlockDuration} setUnlockDuration={um.setUnlockDuration}
          loading={um.securityActionLoading}
          onUnlock={um.handleUnlockAccount} onClose={() => um.setShowUnlockModal(false)}
        />
      )}

      {um.showMfaBypassModal && um.selectedUser && (
        <MfaBypassModal
          user={um.selectedUser}
          mfaBypassHours={um.mfaBypassHours} setMfaBypassHours={um.setMfaBypassHours}
          loading={um.securityActionLoading}
          onBypass={um.handleMfaBypass} onClose={() => um.setShowMfaBypassModal(false)}
        />
      )}

      {um.showResetMfaConfirm && um.userToResetMfa && (
        <ResetMfaConfirmModal
          user={um.userToResetMfa}
          onConfirm={um.confirmResetMfa}
          onClose={() => { um.setShowResetMfaConfirm(false); um.setUserToResetMfa(null); }}
        />
      )}

      {um.showTransferDashboardsModal && um.userToDelete && (
        <TransferDashboardsModal
          userToDelete={um.userToDelete} userDashboards={um.userDashboards} users={um.users}
          dashboardTransferTarget={um.dashboardTransferTarget} setDashboardTransferTarget={um.setDashboardTransferTarget}
          loading={um.securityActionLoading}
          onTransfer={um.handleTransferDashboards}
          onClose={() => { um.setShowTransferDashboardsModal(false); um.setUserDashboards([]); um.setDashboardTransferTarget(''); um.setUserToDelete(null); }}
        />
      )}

      {/* Workspace Add Member Modal */}
      {showAddMemberModal && selectedWorkspace && (
        <div className="modal-overlay" onClick={() => setShowAddMemberModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Member to {selectedWorkspace.name}</h2>
              <button className="modal-close" onClick={() => setShowAddMemberModal(false)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Select User</label>
                <select value={selectedUserToAdd} onChange={e => setSelectedUserToAdd(e.target.value)}>
                  <option value="">-- Select a user --</option>
                  {availableUsersForWorkspace.map(u => (
                    <option key={u.id} value={u.id}>{u.display_name || u.username} ({u.email})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowAddMemberModal(false)}>Cancel</button>
              <button className="modal-btn primary" onClick={handleAddMember} disabled={!selectedUserToAdd}>Add Member</button>
            </div>
          </div>
        </div>
      )}

      {um.userToDelete && !um.showTransferDashboardsModal && (
        <ConfirmDeleteModal
          itemName={um.userToDelete.display_name || um.userToDelete.username} itemType="user"
          onConfirm={um.handleDeleteUser} onCancel={() => { um.setUserToDelete(null); um.setDeleteError(null); }}
          error={um.deleteError}
        />
      )}
    </div>
  );
};

export default UsersManagement;
