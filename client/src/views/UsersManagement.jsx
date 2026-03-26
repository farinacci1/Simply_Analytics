import React from 'react';
import {
  FiUsers, FiUserPlus, FiEdit2, FiTrash2, FiShield,
  FiSearch, FiLoader, FiPlus, FiUserMinus, FiFolder, FiX,
} from 'react-icons/fi';
import { useAppStore } from '../store/appStore';
import { useToast } from '../components/Toast';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import '../styles/UsersManagement.css';

import { ROLE_LABELS, ROLE_COLORS } from '../components/users-management/constants';
import UserRow from '../components/users-management/components/UserRow';
import { useUserManagement } from '../components/users-management/hooks/useUserManagement';
import { useGroupManagement } from '../components/users-management/hooks/useGroupManagement';
import {
  CreateUserModal, EditUserModal, TransferOwnershipModal,
  LockConfirmModal, UnlockAccountModal, MfaBypassModal,
  ResetMfaConfirmModal, TransferDashboardsModal,
} from '../components/users-management/components/UserModals';
import {
  CreateGroupModal, EditGroupModal, AddMemberModal, RemoveMemberConfirmModal,
} from '../components/users-management/components/GroupModals';

const UsersManagement = () => {
  const { currentUser, currentRole } = useAppStore();
  const toast = useToast();
  const [activeTab, setActiveTab] = React.useState('users');

  const um = useUserManagement(currentUser, currentRole, toast);
  const gm = useGroupManagement(toast);

  const canManageUsers = ['owner', 'admin'].includes(currentRole);
  const canCreateUsers = ['owner', 'admin'].includes(currentRole);
  const canManageGroups = ['owner', 'admin'].includes(currentRole);

  const availableUsersForGroup = um.users.filter(user =>
    !gm.groupMembers.some(member => member.id === user.id)
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
            <p>{um.users.length} users, {gm.groups.length} groups</p>
          </div>
        </div>
      </div>

      <div className="management-tabs">
        <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          <FiUsers /> Users
        </button>
        <button className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`} onClick={() => setActiveTab('groups')}>
          <FiFolder /> Groups
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
                      currentUser={currentUser}
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

      {/* Groups Tab */}
      {activeTab === 'groups' && (
        <div className="tab-content groups-tab">
          {!canManageGroups ? (
            <div className="access-notice"><FiShield /><p>Only admins can manage groups.</p></div>
          ) : (
            <div className="groups-layout">
              <div className="groups-list-panel">
                <div className="panel-header">
                  <h3>Groups</h3>
                  <button className="btn-primary btn-sm" onClick={() => gm.setShowCreateGroupModal(true)}>
                    <FiPlus /> New Group
                  </button>
                </div>

                {gm.groupsLoading ? (
                  <div className="loading-state"><FiLoader className="spinner" /></div>
                ) : gm.groups.length === 0 ? (
                  <div className="empty-groups">
                    <FiFolder size={32} /><p>No groups yet</p>
                    <button className="btn-primary btn-sm" onClick={() => gm.setShowCreateGroupModal(true)}>Create First Group</button>
                  </div>
                ) : (
                  <div className="groups-list">
                    {gm.groups.map(group => (
                      <div key={group.id} className={`group-item ${gm.selectedGroup?.id === group.id ? 'selected' : ''}`} onClick={() => gm.handleSelectGroup(group)}>
                        <div className="group-info">
                          <div className="group-icon"><FiFolder /></div>
                          <div>
                            <div className="group-name">{group.name}</div>
                            <div className="group-meta">{group.member_count || 0} members</div>
                          </div>
                        </div>
                        <div className="group-actions">
                          <button className="action-btn-sm" onClick={(e) => { e.stopPropagation(); gm.openEditGroupModal(group); }} title="Edit Group"><FiEdit2 /></button>
                          <button className="action-btn-sm danger" onClick={(e) => { e.stopPropagation(); gm.setGroupToDelete(group); }} title="Delete Group"><FiTrash2 /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="group-members-panel">
                {!gm.selectedGroup ? (
                  <div className="no-selection"><FiUsers size={40} /><p>Select a group to manage members</p></div>
                ) : (
                  <>
                    <div className="panel-header">
                      <div>
                        <h3>{gm.selectedGroup.name}</h3>
                        {gm.selectedGroup.description && <p className="group-description">{gm.selectedGroup.description}</p>}
                      </div>
                      <button className="btn-primary btn-sm" onClick={() => gm.setShowAddMemberModal(true)}>
                        <FiUserPlus /> Add Member
                      </button>
                    </div>

                    {gm.groupMembersLoading ? (
                      <div className="loading-state"><FiLoader className="spinner" /></div>
                    ) : gm.groupMembers.length === 0 ? (
                      <div className="empty-members">
                        <FiUsers size={32} /><p>No members in this group</p>
                        <button className="btn-primary btn-sm" onClick={() => gm.setShowAddMemberModal(true)}>Add First Member</button>
                      </div>
                    ) : (
                      <div className="members-list">
                        {gm.groupMembers.map(member => (
                          <div key={member.id} className="member-item">
                            <div className="member-info">
                              <div className="user-avatar">{(member.display_name || member.username || '?')[0].toUpperCase()}</div>
                              <div>
                                <div className="member-name">{member.display_name || member.username}</div>
                                <div className="member-email">{member.email}</div>
                              </div>
                            </div>
                            <span className="role-badge" style={{ backgroundColor: ROLE_COLORS[member.role] }}>{ROLE_LABELS[member.role]}</span>
                            <button className="remove-member-btn" onClick={() => gm.handleRemoveMember(member.id)} title="Remove from group"><FiUserMinus /></button>
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
        />
      )}

      {um.showEditModal && um.selectedUser && (
        <EditUserModal
          formData={um.formData} setFormData={um.setFormData}
          formError={um.formError} formLoading={um.formLoading}
          selectedUser={um.selectedUser} currentUser={currentUser}
          onSubmit={um.handleEditUser} onClose={() => um.setShowEditModal(false)}
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

      {/* Group Modals */}
      {gm.showCreateGroupModal && (
        <CreateGroupModal
          groupFormData={gm.groupFormData} setGroupFormData={gm.setGroupFormData}
          formError={gm.formError} formLoading={gm.formLoading}
          isGroupNameTaken={gm.isGroupNameTaken}
          onSubmit={gm.handleCreateGroup} onClose={gm.closeCreateGroupModal}
        />
      )}

      {gm.showEditGroupModal && gm.selectedGroup && (
        <EditGroupModal
          selectedGroup={gm.selectedGroup}
          groupFormData={gm.groupFormData} setGroupFormData={gm.setGroupFormData}
          formError={gm.formError} formLoading={gm.formLoading}
          isGroupNameTaken={gm.isGroupNameTaken}
          onSubmit={gm.handleUpdateGroup} onClose={gm.closeEditGroupModal}
        />
      )}

      {gm.showAddMemberModal && gm.selectedGroup && (
        <AddMemberModal
          selectedGroup={gm.selectedGroup}
          availableUsers={availableUsersForGroup}
          selectedUserToAdd={gm.selectedUserToAdd} setSelectedUserToAdd={gm.setSelectedUserToAdd}
          onAdd={gm.handleAddMember} onClose={() => gm.setShowAddMemberModal(false)}
        />
      )}

      {gm.memberToRemove && (
        <RemoveMemberConfirmModal onConfirm={gm.confirmRemoveMember} onClose={() => gm.setMemberToRemove(null)} />
      )}

      {/* Delete confirmations */}
      {gm.groupToDelete && (
        <ConfirmDeleteModal itemName={gm.groupToDelete.name} itemType="group" onConfirm={gm.handleDeleteGroup} onCancel={() => gm.setGroupToDelete(null)} />
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
