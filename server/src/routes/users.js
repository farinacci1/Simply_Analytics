/**
 * User Management Routes
 * 
 * Handles user CRUD operations, role management, and password resets.
 */

import { Router } from 'express';
import userService from '../services/userService.js';
import twoFactorService from '../services/twoFactorService.js';
import { query } from '../db/db.js';

export const userRoutes = Router();

/**
 * Middleware: Require MFA (or SSO) for admin-level user management operations.
 * All roles (including owner) must have MFA enabled or be SSO-provisioned.
 */
async function requireMfaForAdminAction(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const result = await query(`
    SELECT totp_enabled, passkey_enabled, mfa_bypass_until, auth_provider
    FROM users WHERE id = $1
  `, [req.user.id]);

  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'User not found' });

  if (user.auth_provider === 'saml') return next();

  if (user.mfa_bypass_until && new Date(user.mfa_bypass_until) > new Date()) {
    return next();
  }

  if (user.totp_enabled || user.passkey_enabled) {
    return next();
  }

  return res.status(403).json({
    error: 'Multi-factor authentication is required to manage users. Please set up MFA in your settings.',
    code: 'MFA_REQUIRED',
  });
}

/**
 * GET /api/v1/users
 * Get all users (admin/owner only)
 */
userRoutes.get('/', async (req, res) => {
  try {
    const { user } = req;
    
    if (!['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const users = await userService.getAllUsers();
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/users/lookup?email=
 * Look up a user by exact email. Available to any authenticated user.
 * Returns { user: { id, username, display_name, email, role } } or 404.
 */
userRoutes.get('/lookup', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email query parameter required' });

    const found = await userService.getUserByEmail(email.trim().toLowerCase());
    if (!found) return res.status(404).json({ error: 'No user found with that email' });

    res.json({
      user: {
        id: found.id,
        username: found.username,
        display_name: found.display_name,
        email: found.email,
        role: found.role,
      },
    });
  } catch (error) {
    console.error('User lookup error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/users/me/default-workspace
 * Get the authenticated user's default workspace ID
 */
userRoutes.get('/me/default-workspace', async (req, res) => {
  try {
    const result = await query('SELECT default_workspace_id FROM users WHERE id = $1', [req.user.id]);
    res.json({ defaultWorkspaceId: result.rows[0]?.default_workspace_id || null });
  } catch (error) {
    console.error('Get default workspace error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/users/me/default-workspace
 * Set the authenticated user's default workspace
 */
userRoutes.put('/me/default-workspace', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const membership = await query(
      'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, req.user.id]
    );
    const isAdminRole = ['owner', 'admin'].includes(req.user.role);
    if (membership.rows.length === 0 && !isAdminRole) {
      return res.status(403).json({ error: 'You are not a member of this workspace' });
    }

    await query('UPDATE users SET default_workspace_id = $1 WHERE id = $2', [workspaceId, req.user.id]);
    res.json({ success: true, defaultWorkspaceId: workspaceId });
  } catch (error) {
    console.error('Set default workspace error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/users/me/theme
 * Get current user's theme preference
 */
userRoutes.get('/me/theme', async (req, res) => {
  try {
    const { user } = req;
    const theme = await userService.getThemePreference(user.id);
    res.json({ theme });
  } catch (error) {
    console.error('Get theme error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/users/me/theme
 * Update current user's theme preference
 */
userRoutes.put('/me/theme', async (req, res) => {
  try {
    const { user } = req;
    const { theme } = req.body;

    if (!theme || !['light', 'dark'].includes(theme)) {
      return res.status(400).json({ error: 'Invalid theme. Must be "light" or "dark"' });
    }

    const updatedTheme = await userService.updateThemePreference(user.id, theme);
    res.json({ theme: updatedTheme, success: true });
  } catch (error) {
    console.error('Update theme error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// COLOR SCHEMES
// ============================================

/**
 * GET /api/v1/users/color-schemes
 * Get user's saved color schemes
 */
userRoutes.get('/color-schemes', async (req, res) => {
  try {
    const { user } = req;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const colorSchemes = await userService.getColorSchemes(user.id);
    res.json({ colorSchemes });
  } catch (error) {
    console.error('Get color schemes error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/users/color-schemes
 * Save user's color schemes (replaces all)
 */
userRoutes.put('/color-schemes', async (req, res) => {
  try {
    const { user } = req;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { colorSchemes } = req.body;
    
    if (!Array.isArray(colorSchemes)) {
      return res.status(400).json({ error: 'colorSchemes must be an array' });
    }
    
    const saved = await userService.saveColorSchemes(user.id, colorSchemes);
    res.json({ colorSchemes: saved, success: true });
  } catch (error) {
    console.error('Save color schemes error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/users/preferences
 * Get all user preferences
 */
userRoutes.get('/preferences', async (req, res) => {
  try {
    const { user } = req;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const preferences = await userService.getUserPreferences(user.id);
    res.json(preferences);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/users/transfer-ownership
 * Transfer owner role to another user (owner only, requires MFA)
 * This is an irreversible action - the current owner becomes admin
 */
userRoutes.post('/transfer-ownership', requireMfaForAdminAction, async (req, res) => {
  try {
    const { user } = req;
    const { newOwnerId } = req.body;

    if (user.role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can transfer ownership' });
    }

    if (!newOwnerId) {
      return res.status(400).json({ error: 'New owner ID is required' });
    }

    const targetUser = await userService.getUserById(newOwnerId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    if (targetUser.id === user.userId) {
      return res.status(400).json({ error: 'Cannot transfer ownership to yourself' });
    }

    if (!targetUser.is_active) {
      return res.status(400).json({ error: 'Cannot transfer ownership to an inactive user' });
    }

    if (targetUser.role !== 'admin') {
      return res.status(400).json({ error: 'Ownership can only be transferred to administrators' });
    }

    await userService.transferOwnership(user.userId, newOwnerId);
    console.log(`Ownership transferred from ${user.username} to ${targetUser.username}`);
    
    res.json({ 
      success: true, 
      message: `Ownership transferred to ${targetUser.username}` 
    });
  } catch (error) {
    console.error('Transfer ownership error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/users/:id
 * Get user by ID
 */
userRoutes.get('/:id', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    if (user.id !== id && !['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const targetUser = await userService.getUserById(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: targetUser });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/users
 * Create a new user (admin/owner only, requires MFA)
 */
userRoutes.post('/', requireMfaForAdminAction, async (req, res) => {
  try {
    const { user } = req;
    const { username, email, password, displayName, role } = req.body;

    if (!['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only administrators can create users' });
    }

    if (user.role === 'admin' && ['owner', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Admins can only create editor or viewer users' });
    }

    const existingUsername = await userService.getUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const existingEmail = await userService.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const newUser = await userService.createUser({
      username,
      email,
      password,
      displayName,
      role,
      createdBy: user.id,
    });

    res.status(201).json({ user: newUser });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/users/:id
 * Update user details
 */
userRoutes.put('/:id', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const updates = req.body;

    // Users can update their own profile, admins can update anyone
    if (user.id !== id && !['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedUser = await userService.updateUser(id, updates);
    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/users/:id/role
 * Update user role (with permission checks, requires MFA)
 */
userRoutes.put('/:id/role', requireMfaForAdminAction, async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { role } = req.body;

    // Only owner and admin can change roles
    if (!['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only administrators can change user roles' });
    }

    const updatedUser = await userService.updateUserRole(id, role, user);
    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/v1/users/:id/change-password
 * Change user's own password
 */
userRoutes.post('/:id/change-password', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Users can only change their own password
    if (user.id !== id) {
      return res.status(403).json({ error: 'Can only change your own password' });
    }

    await userService.changePassword(id, currentPassword, newPassword);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/users/:id/email
 * Update user's email address
 */
userRoutes.put('/:id/email', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { email } = req.body;

    // Users can only update their own email
    if (user.id !== id) {
      return res.status(403).json({ error: 'Can only update your own email' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    await userService.updateEmail(id, email);
    res.json({ success: true, message: 'Email updated successfully' });
  } catch (error) {
    console.error('Update email error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/v1/users/:id/reset-password
 * Reset user password (admin action, requires MFA)
 */
userRoutes.post('/:id/reset-password', requireMfaForAdminAction, async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only admins can reset passwords' });
    }

    await userService.resetPassword(id, newPassword, user);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/users/:id
 * Delete user (owner and admin only, with role hierarchy, requires MFA)
 */
userRoutes.delete('/:id', requireMfaForAdminAction, async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    // Only owner and admin can delete users
    if (!['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only owners and admins can delete users' });
    }

    await userService.deleteUser(id, user);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// 2FA ADMIN MANAGEMENT
// ============================================

/**
 * GET /api/v1/users/:id/2fa-status
 * Get a user's 2FA status (admin only)
 */
userRoutes.get('/:id/2fa-status', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    // Only owner/admin can view other users' 2FA status
    if (user.id !== id && !['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const status = await twoFactorService.get2FAStatus(id);
    res.json(status);
  } catch (error) {
    console.error('Get 2FA status error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/users/:id/unlock
 * Unlock a user's account (admin/owner only, requires MFA)
 */
userRoutes.post('/:id/unlock', requireMfaForAdminAction, async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { unlockDurationHours } = req.body;

    // Only owner and admin can unlock accounts
    if (!['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only administrators can unlock accounts' });
    }

    // Get the target user to check role hierarchy
    const targetUser = await userService.getUserById(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Admin cannot unlock owner accounts
    if (user.role === 'admin' && targetUser.role === 'owner') {
      return res.status(403).json({ error: 'Admins cannot unlock owner accounts' });
    }

    const result = await twoFactorService.unlockUserAccount(id, unlockDurationHours);
    
    res.json({
      success: true,
      message: result.temporary 
        ? `Account unlocked until ${result.expiresAt.toISOString()}`
        : 'Account unlocked. User must set up MFA within grace period.',
      ...result,
    });
  } catch (error) {
    console.error('Unlock account error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/users/:id/2fa-grace
 * Set or extend a user's 2FA grace period (admin/owner only, requires MFA)
 */
userRoutes.post('/:id/2fa-grace', requireMfaForAdminAction, async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { graceDays } = req.body;

    // Only owner and admin can modify grace periods
    if (!['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only administrators can modify grace periods' });
    }

    if (!graceDays || graceDays < 1 || graceDays > 30) {
      return res.status(400).json({ error: 'Grace period must be between 1 and 30 days' });
    }

    const result = await twoFactorService.setUserGracePeriod(id, graceDays);
    
    res.json({
      success: true,
      message: `Grace period set to ${graceDays} days`,
      ...result,
    });
  } catch (error) {
    console.error('Set grace period error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/users/:id/2fa-requirement
 * Set whether 2FA is required for a user (admin/owner only, requires MFA)
 */
userRoutes.post('/:id/2fa-requirement', requireMfaForAdminAction, async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { required } = req.body;

    // Only owner and admin can modify MFA requirements
    if (!['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only administrators can modify MFA requirements' });
    }

    const result = await twoFactorService.setUser2FARequirement(id, required);
    
    res.json({
      success: true,
      message: required ? 'MFA is now required for this user' : 'MFA is no longer required for this user',
      ...result,
    });
  } catch (error) {
    console.error('Set 2FA requirement error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/users/:id/2fa
 * Reset a user's 2FA (remove all methods) - owner only, for recovery, requires MFA
 */
userRoutes.delete('/:id/2fa', requireMfaForAdminAction, async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    // Only owner can reset 2FA for other users
    if (user.role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can reset MFA for users' });
    }

    // Disable both TOTP and remove all passkeys
    await twoFactorService.disableTotp(id);
    
    // Get and remove all passkeys
    const passkeys = await twoFactorService.getUserPasskeys(id);
    for (const passkey of passkeys) {
      await twoFactorService.removePasskey(id, passkey.id);
    }
    
    // Start a new grace period
    await twoFactorService.startGracePeriod(id);
    
    res.json({
      success: true,
      message: 'MFA has been reset. User must set up MFA within the grace period.',
    });
  } catch (error) {
    console.error('Reset 2FA error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ACCOUNT LOCK/UNLOCK
// ============================================

/**
 * POST /api/v1/users/:id/lock
 * Lock a user's account (admin/owner only, requires MFA)
 */
userRoutes.post('/:id/lock', requireMfaForAdminAction, async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { reason } = req.body;

    if (!['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only administrators can lock accounts' });
    }

    const result = await userService.lockAccount(id, reason || 'admin_action', user);
    res.json(result);
  } catch (error) {
    console.error('Lock account error:', error);
    res.status(400).json({ error: error.message });
  }
});


/**
 * GET /api/v1/users/:id/security
 * Get user's security status (lock status, MFA, etc)
 */
userRoutes.get('/:id/security', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    // Only owner/admin can view other users' security status
    if (user.id !== id && !['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const securityInfo = await userService.getUserSecurityInfo(id);
    if (!securityInfo) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(securityInfo);
  } catch (error) {
    console.error('Get security info error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MFA BYPASS
// ============================================

/**
 * POST /api/v1/users/:id/mfa-bypass
 * Set MFA bypass for a user (up to 4 hours, requires MFA)
 */
userRoutes.post('/:id/mfa-bypass', requireMfaForAdminAction, async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { hours, reason } = req.body;

    if (!['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only administrators can set MFA bypass' });
    }

    if (!hours || hours < 1 || hours > 4) {
      return res.status(400).json({ error: 'Bypass hours must be between 1 and 4' });
    }

    const result = await userService.setMfaBypass(id, hours, reason || 'admin_granted', user);
    res.json({
      success: true,
      message: `MFA bypassed for ${hours} hours`,
      ...result
    });
  } catch (error) {
    console.error('Set MFA bypass error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/users/:id/mfa-bypass
 * Clear MFA bypass for a user (requires MFA)
 */
userRoutes.delete('/:id/mfa-bypass', requireMfaForAdminAction, async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    if (!['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only administrators can clear MFA bypass' });
    }

    await userService.clearMfaBypass(id);
    res.json({ success: true, message: 'MFA bypass cleared' });
  } catch (error) {
    console.error('Clear MFA bypass error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// DASHBOARD TRANSFER
// ============================================

/**
 * GET /api/v1/users/:id/dashboards
 * Get dashboards owned by a user
 */
userRoutes.get('/:id/dashboards', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    if (!['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const dashboards = await userService.getUserDashboards(id);
    res.json({ dashboards });
  } catch (error) {
    console.error('Get user dashboards error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/users/:id/transfer-dashboards
 * Transfer all dashboards from one user to another (requires MFA)
 */
userRoutes.post('/:id/transfer-dashboards', requireMfaForAdminAction, async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { toUserId } = req.body;

    if (!['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only administrators can transfer dashboards' });
    }

    if (!toUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    const result = await userService.transferDashboards(id, toUserId, user);
    res.json({
      success: true,
      message: `${result.transferredCount} dashboard(s) transferred`,
      ...result
    });
  } catch (error) {
    console.error('Transfer dashboards error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/users/:id/admin-update
 * Admin update user details (email, username, display_name, requires MFA)
 */
userRoutes.put('/:id/admin-update', requireMfaForAdminAction, async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const updates = req.body;

    if (!['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only administrators can update users' });
    }

    const updatedUser = await userService.adminUpdateUser(id, updates, user);
    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default userRoutes;
