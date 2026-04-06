import crypto from 'crypto';
import { query, transaction, now } from '../db/db.js';

export async function listWorkspaces(userId, userRole) {
  if (['owner', 'admin'].includes(userRole)) {
    const result = await query(`
      SELECT w.*, u.display_name as owner_name,
             (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) as member_count,
             (SELECT COUNT(*) FROM workspace_connections wc WHERE wc.workspace_id = w.id) as connection_count
      FROM workspaces w
      JOIN users u ON w.created_by = u.id
      ORDER BY w.updated_at DESC
    `);
    return result.rows;
  }

  const result = await query(`
    SELECT DISTINCT w.*, u.display_name as owner_name,
           (SELECT COUNT(*) FROM workspace_members wm2 WHERE wm2.workspace_id = w.id) as member_count,
           (SELECT COUNT(*) FROM workspace_connections wc WHERE wc.workspace_id = w.id) as connection_count
    FROM workspaces w
    JOIN users u ON w.created_by = u.id
    JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
    ORDER BY w.updated_at DESC
  `, [userId]);
  return result.rows;
}

export async function getWorkspaceById(workspaceId) {
  const result = await query(`
    SELECT w.*, u.display_name as owner_name
    FROM workspaces w
    JOIN users u ON w.created_by = u.id
    WHERE w.id = $1
  `, [workspaceId]);
  return result.rows[0] || null;
}

export async function checkWorkspaceAccess(workspaceId, userId, userRole) {
  const ws = await getWorkspaceById(workspaceId);
  if (!ws) return null;

  if (ws.created_by === userId) return { workspace: ws, accessLevel: 'owner' };
  if (['owner', 'admin'].includes(userRole)) return { workspace: ws, accessLevel: 'admin' };

  const membership = await query(
    'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId],
  );
  if (membership.rows.length > 0) return { workspace: ws, accessLevel: 'member' };

  return null;
}

export async function isWorkspaceMember(workspaceId, userId) {
  const result = await query(
    'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId],
  );
  return result.rows.length > 0;
}

export async function createWorkspace({ name, description, createdBy }) {
  const id = crypto.randomUUID();
  await query(`
    INSERT INTO workspaces (id, name, description, created_by)
    VALUES ($1, $2, $3, $4)
  `, [id, name.trim(), description || null, createdBy]);

  // Auto-add creator as member
  await query(`
    INSERT INTO workspace_members (workspace_id, user_id, added_by)
    VALUES ($1, $2, $2)
    ON CONFLICT (workspace_id, user_id) DO NOTHING
  `, [id, createdBy]);

  return getWorkspaceById(id);
}

export async function updateWorkspace(workspaceId, updates) {
  const allowedFields = ['name', 'description'];
  const setClauses = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      setClauses.push(`${key} = $${idx}`);
      values.push(typeof value === 'string' ? value.trim() : value);
      idx++;
    }
  }

  if (setClauses.length === 0) return getWorkspaceById(workspaceId);

  values.push(workspaceId);
  await query(`UPDATE workspaces SET ${setClauses.join(', ')} WHERE id = $${idx}`, values);

  return getWorkspaceById(workspaceId);
}

export async function getWorkspaceDeletePreview(workspaceId) {
  const [folders, dashboards, conversations, members, connections] = await Promise.all([
    query('SELECT COUNT(*)::int AS count FROM dashboard_folders WHERE workspace_id = $1', [workspaceId]),
    query('SELECT COUNT(*)::int AS count FROM dashboards WHERE workspace_id = $1', [workspaceId]),
    query('SELECT COUNT(*)::int AS count FROM ask_conversations WHERE workspace_id = $1', [workspaceId]),
    query('SELECT COUNT(*)::int AS count FROM workspace_members WHERE workspace_id = $1', [workspaceId]),
    query('SELECT COUNT(*)::int AS count FROM workspace_connections WHERE workspace_id = $1', [workspaceId]),
  ]);

  return {
    folderCount: folders.rows[0].count,
    dashboardCount: dashboards.rows[0].count,
    conversationCount: conversations.rows[0].count,
    memberCount: members.rows[0].count,
    connectionCount: connections.rows[0].count,
  };
}

export async function deleteWorkspace(workspaceId) {
  const preview = await getWorkspaceDeletePreview(workspaceId);

  await transaction(async (client) => {
    // Clear default_workspace_id for any users pointing at this workspace
    await client.query(
      'UPDATE users SET default_workspace_id = NULL WHERE default_workspace_id = $1',
      [workspaceId],
    );

    // Delete ask conversations (ask_messages cascade via FK)
    await client.query(
      'DELETE FROM ask_conversations WHERE workspace_id = $1',
      [workspaceId],
    );

    // Delete dashboards (dashboard_user_access cascades via FK)
    await client.query(
      'DELETE FROM dashboards WHERE workspace_id = $1',
      [workspaceId],
    );

    // Delete folders (nested children cascade via parent_id FK)
    await client.query(
      'DELETE FROM dashboard_folders WHERE workspace_id = $1',
      [workspaceId],
    );

    // Delete the workspace itself
    // (workspace_connections, workspace_members, workspace_semantic_views,
    //  workspace_agents all cascade via FK)
    await client.query(
      'DELETE FROM workspaces WHERE id = $1',
      [workspaceId],
    );
  });

  return preview;
}

// ── Connections ──────────────────────────────────────────────

export async function getWorkspaceConnections(workspaceId) {
  const result = await query(`
    SELECT wc.id, wc.connection_id, wc.warehouse, wc.role, wc.added_at,
           sc.name as connection_name, sc.account as connection_account,
           sc.default_warehouse, sc.default_role
    FROM workspace_connections wc
    JOIN snowflake_connections sc ON wc.connection_id = sc.id
    WHERE wc.workspace_id = $1
    ORDER BY wc.added_at ASC
  `, [workspaceId]);
  return result.rows;
}

export async function addWorkspaceConnection(workspaceId, { connectionId, warehouse, role, addedBy }) {
  if (!warehouse) throw new Error('warehouse is required');
  if (!role) throw new Error('role is required');
  const id = crypto.randomUUID();
  await query(`
    INSERT INTO workspace_connections (id, workspace_id, connection_id, warehouse, role, added_by)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [id, workspaceId, connectionId, warehouse, role, addedBy]);
  return getWorkspaceConnections(workspaceId);
}

export async function updateWorkspaceConnection(wcId, workspaceId, { warehouse, role }) {
  const setClauses = [];
  const values = [];
  let idx = 1;

  if (warehouse !== undefined) {
    if (!warehouse) throw new Error('warehouse cannot be empty');
    setClauses.push(`warehouse = $${idx}`);
    values.push(warehouse);
    idx++;
  }
  if (role !== undefined) {
    if (!role) throw new Error('role cannot be empty');
    setClauses.push(`role = $${idx}`);
    values.push(role);
    idx++;
  }

  if (setClauses.length === 0) return getWorkspaceConnections(workspaceId);

  values.push(wcId, workspaceId);
  await query(
    `UPDATE workspace_connections SET ${setClauses.join(', ')} WHERE id = $${idx} AND workspace_id = $${idx + 1}`,
    values,
  );
  return getWorkspaceConnections(workspaceId);
}

export async function removeWorkspaceConnection(wcId, workspaceId) {
  await query('DELETE FROM workspace_connections WHERE id = $1 AND workspace_id = $2', [wcId, workspaceId]);
  return true;
}

// ── Members ──────────────────────────────────────────────────

export async function getWorkspaceMembers(workspaceId) {
  const result = await query(`
    SELECT u.id, u.username, u.email, u.display_name, u.role,
           wm.added_at, adder.display_name as added_by_name
    FROM workspace_members wm
    JOIN users u ON wm.user_id = u.id
    LEFT JOIN users adder ON wm.added_by = adder.id
    WHERE wm.workspace_id = $1
    ORDER BY wm.added_at ASC
  `, [workspaceId]);
  return result.rows;
}

export async function addWorkspaceMember(workspaceId, userId, addedBy) {
  await query(`
    INSERT INTO workspace_members (workspace_id, user_id, added_by)
    VALUES ($1, $2, $3)
    ON CONFLICT (workspace_id, user_id) DO NOTHING
  `, [workspaceId, userId, addedBy]);

  // Auto-set as default workspace if user doesn't have one yet
  await query(`
    UPDATE users SET default_workspace_id = $1
    WHERE id = $2 AND default_workspace_id IS NULL
  `, [workspaceId, userId]);

  return true;
}

export async function removeWorkspaceMember(workspaceId, userId) {
  await query(
    'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId],
  );
  return true;
}

// ── Semantic Views ───────────────────────────────────────────

export async function getWorkspaceViews(workspaceId, workspaceConnectionId) {
  if (workspaceConnectionId) {
    const result = await query(
      'SELECT * FROM workspace_semantic_views WHERE workspace_id = $1 AND workspace_connection_id = $2 ORDER BY added_at ASC',
      [workspaceId, workspaceConnectionId],
    );
    return result.rows;
  }
  const result = await query(
    'SELECT * FROM workspace_semantic_views WHERE workspace_id = $1 ORDER BY added_at ASC',
    [workspaceId],
  );
  return result.rows;
}

export async function addWorkspaceView(workspaceId, workspaceConnectionId, semanticViewFqn, label) {
  const id = crypto.randomUUID();
  const normalizedFqn = semanticViewFqn.trim().toUpperCase();
  await query(
    'INSERT INTO workspace_semantic_views (id, workspace_id, workspace_connection_id, semantic_view_fqn, label) VALUES ($1, $2, $3, $4, $5)',
    [id, workspaceId, workspaceConnectionId, normalizedFqn, label || null],
  );
  return getWorkspaceViews(workspaceId, workspaceConnectionId);
}

export async function updateWorkspaceView(viewId, workspaceId, { sampleQuestions }) {
  const questions = Array.isArray(sampleQuestions) ? sampleQuestions.slice(0, 5) : [];
  await query(
    'UPDATE workspace_semantic_views SET sample_questions = $1 WHERE id = $2 AND workspace_id = $3',
    [JSON.stringify(questions), viewId, workspaceId],
  );
  return { success: true, sampleQuestions: questions };
}

export async function removeWorkspaceView(viewId, workspaceId) {
  await query('DELETE FROM workspace_semantic_views WHERE id = $1 AND workspace_id = $2', [viewId, workspaceId]);
  return true;
}

// ── Agents ───────────────────────────────────────────────────

export async function getWorkspaceAgents(workspaceId, workspaceConnectionId) {
  if (workspaceConnectionId) {
    const result = await query(
      'SELECT * FROM workspace_agents WHERE workspace_id = $1 AND workspace_connection_id = $2 ORDER BY added_at ASC',
      [workspaceId, workspaceConnectionId],
    );
    return result.rows;
  }
  const result = await query(
    'SELECT * FROM workspace_agents WHERE workspace_id = $1 ORDER BY added_at ASC',
    [workspaceId],
  );
  return result.rows;
}

export async function addWorkspaceAgent(workspaceId, workspaceConnectionId, agentFqn, label) {
  const id = crypto.randomUUID();
  const normalizedFqn = agentFqn.trim().toUpperCase();
  await query(
    'INSERT INTO workspace_agents (id, workspace_id, workspace_connection_id, agent_fqn, label) VALUES ($1, $2, $3, $4, $5)',
    [id, workspaceId, workspaceConnectionId, normalizedFqn, label || null],
  );
  return getWorkspaceAgents(workspaceId, workspaceConnectionId);
}

export async function updateWorkspaceAgent(agentId, workspaceId, { sampleQuestions }) {
  const questions = Array.isArray(sampleQuestions) ? sampleQuestions.slice(0, 5) : [];
  await query(
    'UPDATE workspace_agents SET sample_questions = $1 WHERE id = $2 AND workspace_id = $3',
    [JSON.stringify(questions), agentId, workspaceId],
  );
  return { success: true, sampleQuestions: questions };
}

export async function removeWorkspaceAgent(agentId, workspaceId) {
  await query('DELETE FROM workspace_agents WHERE id = $1 AND workspace_id = $2', [agentId, workspaceId]);
  return true;
}

export default {
  listWorkspaces,
  getWorkspaceById,
  checkWorkspaceAccess,
  isWorkspaceMember,
  createWorkspace,
  updateWorkspace,
  getWorkspaceDeletePreview,
  deleteWorkspace,
  getWorkspaceConnections,
  addWorkspaceConnection,
  updateWorkspaceConnection,
  removeWorkspaceConnection,
  getWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember,
  getWorkspaceViews,
  addWorkspaceView,
  updateWorkspaceView,
  removeWorkspaceView,
  getWorkspaceAgents,
  addWorkspaceAgent,
  updateWorkspaceAgent,
  removeWorkspaceAgent,
};
