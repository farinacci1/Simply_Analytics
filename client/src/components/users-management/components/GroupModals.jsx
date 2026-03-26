import React from 'react';
import {
  FiUserPlus, FiEdit2, FiCheck, FiX, FiLoader, FiFolder, FiUserMinus,
} from 'react-icons/fi';
import { ROLE_LABELS, ROLE_COLORS } from '../constants';

export const CreateGroupModal = ({
  groupFormData, setGroupFormData, formError, formLoading,
  isGroupNameTaken, onSubmit, onClose,
}) => (
  <div className="modal-overlay">
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h2><FiFolder /> Create New Group</h2>
        <button className="close-btn" onClick={onClose}><FiX /></button>
      </div>
      <form onSubmit={onSubmit}>
        <div className="modal-body">
          {formError && <div className="form-error">{formError}</div>}
          <div className={`form-group ${isGroupNameTaken(groupFormData.name) ? 'has-error' : ''}`}>
            <label>Group Name *</label>
            <input
              type="text" value={groupFormData.name}
              onChange={e => setGroupFormData({...groupFormData, name: e.target.value})}
              placeholder="e.g., Marketing Team"
              className={isGroupNameTaken(groupFormData.name) ? 'input-error' : ''}
              required
            />
            {isGroupNameTaken(groupFormData.name) && <span className="field-error">A group with this name already exists</span>}
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={groupFormData.description} onChange={e => setGroupFormData({...groupFormData, description: e.target.value})} placeholder="Optional description" rows={3} />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={formLoading || !groupFormData.name.trim() || isGroupNameTaken(groupFormData.name)}>
            {formLoading ? <FiLoader className="spinner" /> : <FiCheck />} Create Group
          </button>
        </div>
      </form>
    </div>
  </div>
);

export const EditGroupModal = ({
  selectedGroup, groupFormData, setGroupFormData, formError, formLoading,
  isGroupNameTaken, onSubmit, onClose,
}) => (
  <div className="modal-overlay">
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h2><FiEdit2 /> Edit Group</h2>
        <button className="close-btn" onClick={onClose}><FiX /></button>
      </div>
      <form onSubmit={onSubmit}>
        <div className="modal-body">
          {formError && <div className="form-error">{formError}</div>}
          <div className={`form-group ${isGroupNameTaken(groupFormData.name, selectedGroup.id) ? 'has-error' : ''}`}>
            <label>Group Name *</label>
            <input
              type="text" value={groupFormData.name}
              onChange={e => setGroupFormData({...groupFormData, name: e.target.value})}
              className={isGroupNameTaken(groupFormData.name, selectedGroup.id) ? 'input-error' : ''}
              required
            />
            {isGroupNameTaken(groupFormData.name, selectedGroup.id) && <span className="field-error">A group with this name already exists</span>}
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={groupFormData.description} onChange={e => setGroupFormData({...groupFormData, description: e.target.value})} rows={3} />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={formLoading || !groupFormData.name.trim() || isGroupNameTaken(groupFormData.name, selectedGroup.id)}>
            {formLoading ? <FiLoader className="spinner" /> : <FiCheck />} Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
);

export const AddMemberModal = ({
  selectedGroup, availableUsers, selectedUserToAdd, setSelectedUserToAdd,
  onAdd, onClose,
}) => (
  <div className="modal-overlay">
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h2><FiUserPlus /> Add Member to {selectedGroup.name}</h2>
        <button className="close-btn" onClick={onClose}><FiX /></button>
      </div>
      <div className="modal-body">
        {availableUsers.length === 0 ? (
          <p className="no-users-available">All users are already in this group.</p>
        ) : (
          <div className="form-group">
            <label>Select User</label>
            <select value={selectedUserToAdd} onChange={e => setSelectedUserToAdd(e.target.value)}>
              <option value="">Choose a user...</option>
              {availableUsers.map(user => (
                <option key={user.id} value={user.id}>{user.display_name || user.username} ({user.email})</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={onAdd} disabled={!selectedUserToAdd}>
          <FiCheck /> Add Member
        </button>
      </div>
    </div>
  </div>
);

export const RemoveMemberConfirmModal = ({ onConfirm, onClose }) => (
  <div className="modal-overlay">
    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h2><FiUserMinus /> Remove Member</h2>
        <button className="close-btn" onClick={onClose}><FiX /></button>
      </div>
      <div className="modal-body">
        <p>Remove this user from the group?</p>
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm}><FiUserMinus /> Remove</button>
      </div>
    </div>
  </div>
);
