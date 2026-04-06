/**
 * User Settings Component
 * 
 * Single-page settings with all sections visible
 * - Profile overview
 * - Security/Password
 */

import React, { useState, useEffect } from 'react';
import { 
  FiUser, FiCheck, FiX, FiLoader, FiEye, FiEyeOff,
  FiAlertCircle, FiCheckCircle, FiShield, FiMail
} from 'react-icons/fi';
import { useAppStore } from '../store/appStore';
import { userApi, authApi } from '../api/apiClient';
import TwoFactorSettingsModal from '../components/TwoFactorSettingsModal';
import '../styles/UserSettings.css';

const UserSettings = () => {
  const { currentUser, currentRole } = useAppStore();

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordPolicy, setPasswordPolicy] = useState({ minLength: 14, requireUppercase: true, requireLowercase: true, requireNumber: true, requireSpecial: true });

  // Email form state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState(null);

  useEffect(() => {
    authApi.getPasswordPolicy().then(setPasswordPolicy).catch(() => {});
  }, []);

  const validatePassword = (password) => {
    const p = passwordPolicy;
    const errors = [];
    if (password.length < p.minLength) errors.push(`at least ${p.minLength} characters`);
    if (p.requireUppercase && !/[A-Z]/.test(password)) errors.push('1 uppercase letter');
    if (p.requireLowercase && !/[a-z]/.test(password)) errors.push('1 lowercase letter');
    if (p.requireNumber && !/[0-9]/.test(password)) errors.push('1 number');
    if (p.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('1 special character');
    return errors;
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    const validationErrors = validatePassword(passwordForm.newPassword);
    if (validationErrors.length > 0) {
      setPasswordError(`Password must have: ${validationErrors.join(', ')}`);
      return;
    }

    setPasswordLoading(true);

    try {
      await userApi.changePassword(
        currentUser.id,
        passwordForm.currentPassword,
        passwordForm.newPassword
      );
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setEmailError(null);
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailForm)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmailLoading(true);
    try {
      await userApi.updateEmail(currentUser.id, emailForm);
      // Update the user in the store
      useAppStore.getState().setCurrentUser({ ...currentUser, email: emailForm });
      setShowEmailModal(false);
      setEmailForm('');
    } catch (err) {
      setEmailError(err.message);
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="user-settings">
      <header className="settings-header">
        <div className="header-content">
          <div>
            <h1>Settings</h1>
            <p>Manage your account and security</p>
          </div>
        </div>
      </header>

      <div className="settings-content">
        <section className="settings-section">
          <div className="section-header">
            <div>
              <h2><FiUser /> Profile</h2>
              <p>Your account information and credentials</p>
            </div>
          </div>
          <div className="section-card profile-card">
            <div className="profile-row">
              <div className="profile-avatar">
                {(currentUser?.displayName || currentUser?.display_name || currentUser?.username || 'U')[0].toUpperCase()}
              </div>
              <div className="profile-info">
                <h2>{currentUser?.displayName || currentUser?.display_name || currentUser?.username}</h2>
                <span className="profile-username">@{currentUser?.username}</span>
              </div>
              <span className="role-badge">{currentRole}</span>
            </div>
            
            <div className="profile-details">
              <div className="detail-item">
                <FiMail />
                {currentUser?.email ? (
                  <span>{currentUser.email}</span>
                ) : (
                  <button 
                    className="text-btn"
                    onClick={() => setShowEmailModal(true)}
                  >
                    No email set - Click to add
                  </button>
                )}
              </div>
              <div className="detail-item">
                <FiShield />
                {showPasswordForm ? (
                  <button 
                    className="text-btn cancel"
                    onClick={() => setShowPasswordForm(false)}
                  >
                    Cancel
                  </button>
                ) : (
                  <button 
                    className="text-btn"
                    onClick={() => setShowPasswordForm(true)}
                  >
                    Change Password
                  </button>
                )}
              </div>
            </div>

            {/* Inline Password Form */}
            {showPasswordForm && (
              <form onSubmit={handleChangePassword} className="inline-password-form">
                {passwordError && (
                  <div className="form-alert error">
                    <FiAlertCircle />
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="form-alert success">
                    <FiCheckCircle />
                    Password updated!
                  </div>
                )}
                
                <div className="password-fields">
                  <div className="password-field">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                      placeholder="Current password"
                      required
                    />
                    <button
                      type="button"
                      className="visibility-toggle"
                      onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                    >
                      {showPasswords.current ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  
                  <div className="password-field">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                      placeholder="New password"
                      required
                      minLength={passwordPolicy.minLength}
                    />
                    <button
                      type="button"
                      className="visibility-toggle"
                      onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                    >
                      {showPasswords.new ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  
                  <div className="password-field">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                      placeholder="Confirm new password"
                      required
                      minLength={passwordPolicy.minLength}
                    />
                    <button
                      type="button"
                      className="visibility-toggle"
                      onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                    >
                      {showPasswords.confirm ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </div>
                
                <p className="password-requirements">
                  Must be {passwordPolicy.minLength}+ characters
                  {passwordPolicy.requireUppercase && ', uppercase'}
                  {passwordPolicy.requireLowercase && ', lowercase'}
                  {passwordPolicy.requireNumber && ', number'}
                  {passwordPolicy.requireSpecial && ', special character'}.
                </p>
                
                <button type="submit" className="save-password-btn" disabled={passwordLoading}>
                  {passwordLoading ? <FiLoader className="spinner" /> : <FiCheck />}
                  Update Password
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="settings-section">
          <TwoFactorSettingsModal />
        </section>

      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="modal-overlay" onClick={() => setShowEmailModal(false)}>
          <div className="modal email-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <FiMail />
                Set Email Address
              </h2>
              <button className="modal-close" onClick={() => setShowEmailModal(false)}>
                <FiX />
              </button>
            </div>

            <form onSubmit={handleUpdateEmail}>
              <div className="modal-body">
                {emailError && (
                  <div className="form-alert error">
                    <FiAlertCircle />
                    {emailError}
                  </div>
                )}

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={emailForm}
                    onChange={e => setEmailForm(e.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                    required
                  />
                </div>

                <p className="email-info">
                  Your email will be used for account recovery and important notifications.
                </p>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="modal-btn secondary" 
                  onClick={() => setShowEmailModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-btn primary" disabled={emailLoading}>
                  {emailLoading ? <FiLoader className="spinner" /> : <FiCheck />}
                  Save Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSettings;
