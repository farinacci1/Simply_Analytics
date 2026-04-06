import React from 'react';
import {
  FiUserPlus, FiEdit2, FiTrash2, FiShield,
  FiCheck, FiX, FiLoader, FiLock, FiUnlock,
  FiAlertTriangle, FiClock, FiRefreshCw, FiFolder,
} from 'react-icons/fi';
import { ROLE_LABELS, ROLE_COLORS } from '../constants';

export const CreateUserModal = ({
  formData, setFormData, formError, formLoading,
  onSubmit, onClose, assignableRoles, passwordPolicy,
}) => {
  const pp = passwordPolicy || { minLength: 14, requireUppercase: true, requireLowercase: true, requireNumber: true, requireSpecial: true };
  const hints = [`${pp.minLength}+ chars`, pp.requireUppercase && 'uppercase', pp.requireLowercase && 'lowercase', pp.requireNumber && 'number', pp.requireSpecial && 'special char'].filter(Boolean).join(', ');
  return (
  <div className="modal-overlay">
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h2><FiUserPlus /> Create New User</h2>
        <button className="close-btn" onClick={onClose}><FiX /></button>
      </div>
      <form onSubmit={onSubmit}>
        <div className="modal-body">
          {formError && <div className="form-error">{formError}</div>}
          <div className="form-group">
            <label>Username *</label>
            <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
          </div>
          <div className="form-group">
            <label>Display Name</label>
            <input type="text" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Password *</label>
            <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required minLength={pp.minLength} />
            <span className="field-hint">{hints}</span>
          </div>
          <div className="form-group">
            <label>Role *</label>
            <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
              {assignableRoles.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={formLoading}>
            {formLoading ? <FiLoader className="spinner" /> : <FiCheck />} Create User
          </button>
        </div>
      </form>
    </div>
  </div>
  );
};

export const EditUserModal = ({
  formData, setFormData, formError, formLoading,
  selectedUser, currentUser, onSubmit, onClose, passwordPolicy,
}) => {
  const pp = passwordPolicy || { minLength: 14, requireUppercase: true, requireLowercase: true, requireNumber: true, requireSpecial: true };
  const hints = [`${pp.minLength}+ chars`, pp.requireUppercase && 'uppercase', pp.requireLowercase && 'lowercase', pp.requireNumber && 'number', pp.requireSpecial && 'special char'].filter(Boolean).join(', ');
  return (
  <div className="modal-overlay">
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h2><FiEdit2 /> Edit User</h2>
        <button className="close-btn" onClick={onClose}><FiX /></button>
      </div>
      <form onSubmit={onSubmit}>
        <div className="modal-body">
          {formError && <div className="form-error">{formError}</div>}
          {selectedUser.username !== currentUser && (
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
            </div>
          )}
          <div className="form-group">
            <label>Display Name</label>
            <input type="text" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          {selectedUser.username !== currentUser && (
            <div className="form-group">
              <label>New Password (leave blank to keep current)</label>
              <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Enter new password..." minLength={pp.minLength} />
              <span className="field-hint">{hints}</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={formLoading}>
            {formLoading ? <FiLoader className="spinner" /> : <FiCheck />} Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
  );
};

export const TransferOwnershipModal = ({
  targetUser, confirmText, setConfirmText,
  error, loading, onTransfer, onClose,
}) => (
  <div className="modal-overlay">
    <div className="modal transfer-ownership-modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h2><FiShield /> Transfer Ownership</h2>
        <button className="close-btn" onClick={onClose}><FiX /></button>
      </div>
      <div className="modal-body">
        <div className="transfer-warning">
          <span className="warning-icon">⚠️</span>
          <div className="warning-text">
            <strong>This action is irreversible!</strong>
            <p>You will become an admin, and <strong>{targetUser.display_name || targetUser.username}</strong> will become the new owner.</p>
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="form-group">
          <label>Transfer ownership to</label>
          <div className="selected-user-card">
            <div className="user-avatar" style={{ background: `linear-gradient(135deg, ${ROLE_COLORS[targetUser.role]}88, ${ROLE_COLORS[targetUser.role]})` }}>
              {(targetUser.display_name || targetUser.username || '?')[0].toUpperCase()}
            </div>
            <div className="user-info">
              <span className="name">{targetUser.display_name || targetUser.username}</span>
              <span className="email">{targetUser.email}</span>
            </div>
            <span className="role-badge-inline" style={{ color: ROLE_COLORS[targetUser.role] }}>
              {ROLE_LABELS[targetUser.role]} → Owner
            </span>
          </div>
        </div>
        <div className="form-group">
          <label>Type <strong>{targetUser.username}</strong> to confirm</label>
          <input
            type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
            placeholder="Type username to confirm"
            className={confirmText && confirmText !== targetUser.username ? 'input-error' : ''}
          />
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-danger" disabled={loading || confirmText !== targetUser?.username} onClick={onTransfer}>
          {loading ? <FiLoader className="spinner" /> : <FiShield />} Transfer Ownership
        </button>
      </div>
    </div>
  </div>
);

export const LockConfirmModal = ({ user, onConfirm, onClose }) => (
  <div className="modal-overlay">
    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h2><FiLock /> Lock Account</h2>
        <button className="close-btn" onClick={onClose}><FiX /></button>
      </div>
      <div className="modal-body">
        <p>Lock account for <strong>{user.display_name || user.username}</strong>?</p>
        <p className="text-muted">This user will not be able to sign in until unlocked.</p>
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm}><FiLock /> Lock Account</button>
      </div>
    </div>
  </div>
);

export const UnlockAccountModal = ({
  user, unlockDuration, setUnlockDuration,
  loading, onUnlock, onClose,
}) => (
  <div className="modal-overlay">
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h2><FiUnlock /> Unlock Account</h2>
        <button className="close-btn" onClick={onClose}><FiX /></button>
      </div>
      <div className="modal-body">
        <p>Unlock account for <strong>{user.display_name || user.username}</strong></p>
        <div className="form-group">
          <label>Unlock Duration</label>
          <select value={unlockDuration || ''} onChange={e => setUnlockDuration(e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">Permanent (until manually locked)</option>
            <option value="1">1 hour</option>
            <option value="4">4 hours</option>
            <option value="8">8 hours</option>
            <option value="24">24 hours</option>
          </select>
        </div>
        {user.account_locked_reason && (
          <div className="info-box warning">
            <FiAlertTriangle />
            <span>Locked reason: {user.account_locked_reason}</span>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={onUnlock} disabled={loading}>
          {loading ? <FiLoader className="spinner" /> : <FiUnlock />} Unlock Account
        </button>
      </div>
    </div>
  </div>
);

export const MfaBypassModal = ({
  user, mfaBypassHours, setMfaBypassHours,
  loading, onBypass, onClose,
}) => (
  <div className="modal-overlay">
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h2><FiClock /> MFA Bypass</h2>
        <button className="close-btn" onClick={onClose}><FiX /></button>
      </div>
      <div className="modal-body">
        <p>Allow <strong>{user.display_name || user.username}</strong> to login without MFA for a temporary period.</p>
        <p className="text-muted">This is useful when the user has lost access to their authenticator.</p>
        <div className="form-group">
          <label>Bypass Duration (max 4 hours)</label>
          <select value={mfaBypassHours} onChange={e => setMfaBypassHours(parseInt(e.target.value))}>
            <option value="1">1 hour</option>
            <option value="2">2 hours</option>
            <option value="3">3 hours</option>
            <option value="4">4 hours</option>
          </select>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={onBypass} disabled={loading}>
          {loading ? <FiLoader className="spinner" /> : <FiClock />} Set Bypass
        </button>
      </div>
    </div>
  </div>
);

export const ResetMfaConfirmModal = ({ user, onConfirm, onClose }) => (
  <div className="modal-overlay">
    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h2><FiRefreshCw /> Reset MFA</h2>
        <button className="close-btn" onClick={onClose}><FiX /></button>
      </div>
      <div className="modal-body">
        <p>Reset all MFA methods for <strong>{user.display_name || user.username}</strong>?</p>
        <p className="text-muted">They will need to set up MFA again within the grace period.</p>
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm}><FiRefreshCw /> Reset MFA</button>
      </div>
    </div>
  </div>
);

export const TransferDashboardsModal = ({
  userToDelete, userDashboards, users,
  dashboardTransferTarget, setDashboardTransferTarget,
  loading, onTransfer, onClose,
}) => (
  <div className="modal-overlay">
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h2><FiAlertTriangle /> Transfer Dashboards</h2>
        <button className="close-btn" onClick={onClose}><FiX /></button>
      </div>
      <div className="modal-body">
        <div className="info-box warning">
          <FiAlertTriangle />
          <span>
            <strong>{userToDelete.display_name || userToDelete.username}</strong> owns {userDashboards.length} dashboard(s). 
            Transfer ownership before deleting.
          </span>
        </div>
        <div className="dashboard-list">
          {userDashboards.map(d => (
            <div key={d.id} className="dashboard-item"><FiFolder /><span>{d.name}</span></div>
          ))}
        </div>
        <div className="form-group">
          <label>Transfer to</label>
          <select value={dashboardTransferTarget} onChange={e => setDashboardTransferTarget(e.target.value)}>
            <option value="">Select a user...</option>
            {users.filter(u => u.id !== userToDelete.id && u.is_active).map(u => (
              <option key={u.id} value={u.id}>{u.display_name || u.username} ({ROLE_LABELS[u.role]})</option>
            ))}
          </select>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-danger" onClick={onTransfer} disabled={loading || !dashboardTransferTarget}>
          {loading ? <FiLoader className="spinner" /> : <FiCheck />} Transfer & Delete User
        </button>
      </div>
    </div>
  </div>
);
