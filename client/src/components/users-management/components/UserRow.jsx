import React, { useState, useEffect, useRef } from 'react';
import {
  FiEdit2, FiTrash2, FiShield, FiChevronDown,
  FiMoreHorizontal, FiLock, FiUnlock, FiClock, FiRefreshCw,
} from 'react-icons/fi';
import { ROLE_LABELS, ROLE_COLORS } from '../constants';

const UserRow = ({ 
  user, 
  currentUser, 
  currentRole, 
  canManageUsers,
  canDelete,
  onUpdateRole, 
  onEdit, 
  onDelete,
  onTransferOwnership,
  onLockAccount,
  onUnlockAccount,
  onMfaBypass,
  onResetMfa,
  assignableRoles 
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          triggerRef.current && !triggerRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleMenuToggle = () => {
    if (!menuOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - 180
      });
    }
    setMenuOpen(!menuOpen);
  };

  const formatLastActive = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const day = d.getDate();
    const month = d.toLocaleString('default', { month: 'short' });
    return `${day} ${month}`;
  };

  const canManageSecurity = canManageUsers && user.username !== currentUser && 
    (currentRole === 'owner' || (currentRole === 'admin' && !['owner', 'admin'].includes(user.role)));

  return (
    <tr className={`${!user.is_active ? 'row-inactive' : ''} ${user.account_locked ? 'row-locked' : ''}`}>
      <td className="col-name">
        <div className="user-cell">
          <div className="user-avatar" style={{ background: `linear-gradient(135deg, ${ROLE_COLORS[user.role]}88, ${ROLE_COLORS[user.role]})` }}>
            {(user.display_name || user.username || '?')[0].toUpperCase()}
          </div>
          <div className="user-details">
            <span className="user-name">
              {user.display_name || user.username}
              {user.account_locked && <FiLock className="status-icon locked" title="Account Locked" />}
              {user.mfa_bypass_until && new Date(user.mfa_bypass_until) > new Date() && (
                <FiClock className="status-icon bypass" title="MFA Bypassed" />
              )}
            </span>
            <span className="user-email">{user.email}</span>
          </div>
        </div>
      </td>
      <td className="col-role">
        {canManageUsers && user.username !== currentUser ? (
          <div className="role-dropdown">
            <select
              value={user.role}
              onChange={(e) => onUpdateRole(user.id, e.target.value)}
              className="role-select"
            >
              {assignableRoles.map(role => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
            <FiChevronDown className="dropdown-icon" />
          </div>
        ) : (
          <span className="role-label">{ROLE_LABELS[user.role]}</span>
        )}
      </td>
      <td className="col-status">
        <div className="status-badges">
          {user.auth_provider === 'saml' && <span className="badge badge-mfa" title="SSO Authenticated">SSO</span>}
          {user.totp_enabled && <span className="badge badge-mfa" title="TOTP Enabled">TOTP</span>}
          {user.passkey_enabled && <span className="badge badge-mfa" title="Passkey Enabled">Passkey</span>}
          {user.auth_provider !== 'saml' && !user.totp_enabled && !user.passkey_enabled && (
            <span className="badge badge-warning" title="No MFA">No MFA</span>
          )}
        </div>
      </td>
      <td className="col-active">{formatLastActive(user.last_login)}</td>
      <td className="col-settings">
        {canManageUsers && (
          <div className="settings-menu">
            <button 
              ref={triggerRef}
              className="menu-trigger" 
              onClick={handleMenuToggle}
            >
              <FiMoreHorizontal />
            </button>
            {menuOpen && (
              <div 
                ref={menuRef}
                className="menu-dropdown"
                style={{ top: menuPosition.top, left: menuPosition.left }}
              >
                <button onClick={() => { onEdit(user); setMenuOpen(false); }}>
                  <FiEdit2 /> Edit User
                </button>
                
                {canManageSecurity && (
                  <>
                    <div className="menu-divider" />
                    {user.account_locked ? (
                      <button onClick={() => { onUnlockAccount(user); setMenuOpen(false); }}>
                        <FiUnlock /> Unlock Account
                      </button>
                    ) : (
                      <button className="warning" onClick={() => { onLockAccount(user); setMenuOpen(false); }}>
                        <FiLock /> Lock Account
                      </button>
                    )}
                    {user.auth_provider !== 'saml' && (user.totp_enabled || user.passkey_enabled) && (
                      <>
                        <button onClick={() => { onMfaBypass(user); setMenuOpen(false); }}>
                          <FiClock /> Bypass MFA (4h)
                        </button>
                        {currentRole === 'owner' && (
                          <button className="warning" onClick={() => { onResetMfa(user); setMenuOpen(false); }}>
                            <FiRefreshCw /> Reset MFA
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
                
                {currentRole === 'owner' && user.role === 'admin' && (
                  <>
                    <div className="menu-divider" />
                    <button className="transfer" onClick={() => { onTransferOwnership(user); setMenuOpen(false); }}>
                      <FiShield /> Transfer Ownership
                    </button>
                  </>
                )}
                
                {canDelete && (
                  <>
                    <div className="menu-divider" />
                    <button className="danger" onClick={() => { onDelete(); setMenuOpen(false); }}>
                      <FiTrash2 /> Delete User
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
};

export default UserRow;
