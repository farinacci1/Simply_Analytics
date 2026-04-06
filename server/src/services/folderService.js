import crypto from 'crypto';
import { query } from '../db/db.js';

/**
 * All workspace members can see all folders.
 * Dashboard-level access filtering still applies within folders.
 */

export async function getFoldersForUser(userId, userRole, workspaceId = null) {
  if (workspaceId) {
    const result = await query(`
      SELECT 
        f.*,
        u.username as owner_name,
        (SELECT COUNT(*) FROM dashboards WHERE folder_id = f.id) as dashboard_count
      FROM dashboard_folders f
      LEFT JOIN users u ON f.owner_id = u.id
      WHERE f.workspace_id = $1
      ORDER BY f.name ASC
    `, [workspaceId]);
    return result.rows;
  }

  const result = await query(`
    SELECT 
      f.*,
      u.username as owner_name,
      (SELECT COUNT(*) FROM dashboards WHERE folder_id = f.id) as dashboard_count
    FROM dashboard_folders f
    LEFT JOIN users u ON f.owner_id = u.id
    ORDER BY f.name ASC
  `, []);
  return result.rows;
}

export async function getFolderContents(userId, userRole, parentId = null, workspaceId = null) {
  const isAdmin = ['owner', 'admin'].includes(userRole);

  if (parentId) {
    let dashboardSql, dashboardParams;

    if (isAdmin) {
      dashboardSql = `
        SELECT 
          d.id, d.name, d.description, d.visibility, d.is_published,
          d.created_at, d.updated_at, d.folder_id, d.workspace_id,
          u.username as owner_name,
          d.owner_id = $2 as is_owner
        FROM dashboards d
        LEFT JOIN users u ON d.owner_id = u.id
        WHERE d.folder_id = $1
          AND (d.is_published = true OR d.owner_id = $2)
        ORDER BY d.name ASC
      `;
      dashboardParams = [parentId, userId];
    } else {
      dashboardSql = `
        SELECT DISTINCT
          d.id, d.name, d.description, d.visibility, d.is_published,
          d.created_at, d.updated_at, d.folder_id, d.workspace_id,
          u.username as owner_name,
          d.owner_id = $2 as is_owner
        FROM dashboards d
        LEFT JOIN users u ON d.owner_id = u.id
        LEFT JOIN dashboard_user_access dua ON d.id = dua.dashboard_id AND dua.user_id = $2
        LEFT JOIN dashboard_group_access dga ON d.id = dga.dashboard_id
        LEFT JOIN group_members gm ON dga.group_id = gm.group_id AND gm.user_id = $2
        WHERE d.folder_id = $1
          AND (d.is_published = true OR d.owner_id = $2)
          AND (
            d.owner_id = $2
            OR dua.user_id = $2
            OR gm.user_id = $2
            OR (d.visibility = 'public' AND d.is_published = true)
          )
        ORDER BY d.name ASC
      `;
      dashboardParams = [parentId, userId];
    }

    const dashboardsResult = await query(dashboardSql, dashboardParams);
    let dashboards = dashboardsResult.rows;
    if (workspaceId) {
      dashboards = dashboards.filter(d => d.workspace_id === workspaceId);
    }
    return {
      folders: [],
      dashboards,
    };
  }

  // Root level: return all folders + root-level dashboards filtered by access
  let folderSql, folderParams;
  if (workspaceId) {
    folderSql = `
      SELECT 
        f.*,
        u.username as owner_name,
        f.owner_id = $1 as is_owner,
        (SELECT COUNT(*) FROM dashboards d2 WHERE d2.folder_id = f.id AND (d2.is_published = true OR d2.owner_id = $1)) as dashboard_count
      FROM dashboard_folders f
      LEFT JOIN users u ON f.owner_id = u.id
      WHERE f.parent_id IS NULL AND f.workspace_id = $2
      ORDER BY f.name ASC
    `;
    folderParams = [userId, workspaceId];
  } else {
    folderSql = `
      SELECT 
        f.*,
        u.username as owner_name,
        f.owner_id = $1 as is_owner,
        (SELECT COUNT(*) FROM dashboards d2 WHERE d2.folder_id = f.id AND (d2.is_published = true OR d2.owner_id = $1)) as dashboard_count
      FROM dashboard_folders f
      LEFT JOIN users u ON f.owner_id = u.id
      WHERE f.parent_id IS NULL
      ORDER BY f.name ASC
    `;
    folderParams = [userId];
  }

  let dashboardSql;

  if (isAdmin) {
    dashboardSql = `
      SELECT 
        d.id, d.name, d.description, d.visibility, d.is_published,
        d.created_at, d.updated_at, d.folder_id, d.workspace_id,
        u.username as owner_name,
        d.owner_id = $1 as is_owner
      FROM dashboards d
      LEFT JOIN users u ON d.owner_id = u.id
      WHERE d.folder_id IS NULL
        AND (d.is_published = true OR d.owner_id = $1)
      ORDER BY d.name ASC
    `;
  } else {
    dashboardSql = `
      SELECT DISTINCT
        d.id, d.name, d.description, d.visibility, d.is_published,
        d.created_at, d.updated_at, d.folder_id, d.workspace_id,
        u.username as owner_name,
        d.owner_id = $1 as is_owner
      FROM dashboards d
      LEFT JOIN users u ON d.owner_id = u.id
      LEFT JOIN dashboard_user_access dua ON d.id = dua.dashboard_id AND dua.user_id = $1
      LEFT JOIN dashboard_group_access dga ON d.id = dga.dashboard_id
      LEFT JOIN group_members gm ON dga.group_id = gm.group_id AND gm.user_id = $1
      WHERE d.folder_id IS NULL
        AND (d.is_published = true OR d.owner_id = $1)
        AND (
          d.owner_id = $1
          OR dua.user_id = $1
          OR gm.user_id = $1
          OR (d.visibility = 'public' AND d.is_published = true)
        )
      ORDER BY d.name ASC
    `;
  }

  const [foldersResult, dashboardsResult] = await Promise.all([
    query(folderSql, folderParams),
    query(dashboardSql, [userId]),
  ]);

  let dashboards = dashboardsResult.rows;
  if (workspaceId) {
    dashboards = dashboards.filter(d => d.workspace_id === workspaceId);
  }

  return {
    folders: foldersResult.rows,
    dashboards,
  };
}

export async function getFolderById(folderId) {
  const result = await query(
    `SELECT f.*, u.username as owner_name
     FROM dashboard_folders f
     LEFT JOIN users u ON f.owner_id = u.id
     WHERE f.id = $1`,
    [folderId]
  );
  return result.rows[0] || null;
}

export async function getFolderPath(folderId) {
  const path = [];
  let currentId = folderId;

  while (currentId) {
    const result = await query(
      'SELECT id, name, parent_id FROM dashboard_folders WHERE id = $1',
      [currentId]
    );

    if (result.rows.length === 0) break;

    const folder = result.rows[0];
    path.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parent_id;
  }

  return path;
}

export async function createFolder(folderData) {
  const { name, description, parentId, ownerId, workspaceId, icon, color } = folderData;

  if (parentId) {
    throw new Error('Nested folders are not supported. All folders must be at the root level.');
  }

  const id = crypto.randomUUID();
  await query(
    `INSERT INTO dashboard_folders (id, name, description, parent_id, owner_id, workspace_id, is_public, icon, color)
     VALUES ($1, $2, $3, NULL, $4, $5, true, $6, $7)`,
    [id, name.trim(), description || null, ownerId, workspaceId || null, icon || 'folder', color || '#6366f1']
  );

  const result = await query(
    'SELECT * FROM dashboard_folders WHERE id = $1',
    [id]
  );

  return result.rows[0];
}

export async function updateFolder(folderId, updates) {
  const { name, description, icon, color } = updates;

  await query(
    `UPDATE dashboard_folders 
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         icon = COALESCE($3, icon),
         color = COALESCE($4, color)
     WHERE id = $5`,
    [name ? name.trim() : name, description, icon, color, folderId]
  );

  const result = await query(
    'SELECT * FROM dashboard_folders WHERE id = $1',
    [folderId]
  );

  return result.rows[0];
}

export async function deleteFolder(folderId) {
  const contents = await query(
    `SELECT COUNT(*) as dashboard_count FROM dashboards WHERE folder_id = $1`,
    [folderId]
  );

  const dashboardCount = parseInt(contents.rows[0].dashboard_count);

  if (dashboardCount > 0) {
    throw new Error(`Cannot delete folder: it contains ${dashboardCount} dashboard${dashboardCount > 1 ? 's' : ''}. Move or delete the dashboards first.`);
  }

  await query('DELETE FROM dashboard_folders WHERE id = $1', [folderId]);
  return true;
}

export async function moveDashboardToFolder(dashboardId, folderId) {
  await query(
    'UPDATE dashboards SET folder_id = $1 WHERE id = $2',
    [folderId, dashboardId]
  );
  const result = await query(
    'SELECT * FROM dashboards WHERE id = $1',
    [dashboardId]
  );
  return result.rows[0];
}

export async function searchFoldersAndDashboards(userId, userRole, searchTerm, workspaceId = null) {
  const isAdmin = ['owner', 'admin'].includes(userRole);
  const searchPattern = `%${searchTerm.toLowerCase()}%`;

  let folderSql, folderParams;
  if (workspaceId) {
    folderSql = `
      SELECT 
        f.*,
        'folder' as type,
        u.username as owner_name,
        f.owner_id = $2 as is_owner
      FROM dashboard_folders f
      LEFT JOIN users u ON f.owner_id = u.id
      WHERE (LOWER(f.name) LIKE $1 OR LOWER(f.description) LIKE $1)
        AND f.workspace_id = $3
      ORDER BY f.name ASC
      LIMIT 20
    `;
    folderParams = [searchPattern, userId, workspaceId];
  } else {
    folderSql = `
      SELECT 
        f.*,
        'folder' as type,
        u.username as owner_name,
        f.owner_id = $2 as is_owner
      FROM dashboard_folders f
      LEFT JOIN users u ON f.owner_id = u.id
      WHERE LOWER(f.name) LIKE $1 OR LOWER(f.description) LIKE $1
      ORDER BY f.name ASC
      LIMIT 20
    `;
    folderParams = [searchPattern, userId];
  }

  let dashboardSql;

  if (isAdmin) {
    dashboardSql = `
      SELECT 
        d.id, d.name, d.description, d.visibility, d.is_published,
        d.created_at, d.updated_at, d.folder_id, d.workspace_id,
        'dashboard' as type,
        u.username as owner_name,
        d.owner_id = $2 as is_owner
      FROM dashboards d
      LEFT JOIN users u ON d.owner_id = u.id
      WHERE (LOWER(d.name) LIKE $1 OR LOWER(d.description) LIKE $1)
        AND (d.is_published = true OR d.owner_id = $2)
      ORDER BY d.name ASC
      LIMIT 20
    `;
  } else {
    dashboardSql = `
      SELECT DISTINCT
        d.id, d.name, d.description, d.visibility, d.is_published,
        d.created_at, d.updated_at, d.folder_id, d.workspace_id,
        'dashboard' as type,
        u.username as owner_name,
        d.owner_id = $2 as is_owner
      FROM dashboards d
      LEFT JOIN users u ON d.owner_id = u.id
      LEFT JOIN dashboard_user_access dua ON d.id = dua.dashboard_id AND dua.user_id = $2
      LEFT JOIN dashboard_group_access dga ON d.id = dga.dashboard_id
      LEFT JOIN group_members gm ON dga.group_id = gm.group_id AND gm.user_id = $2
      WHERE (LOWER(d.name) LIKE $1 OR LOWER(d.description) LIKE $1)
        AND (d.is_published = true OR d.owner_id = $2)
        AND (
          d.owner_id = $2
          OR dua.user_id = $2
          OR gm.user_id = $2
          OR (d.visibility = 'public' AND d.is_published = true)
        )
      ORDER BY d.name ASC
      LIMIT 20
    `;
  }

  const [foldersResult, dashboardsResult] = await Promise.all([
    query(folderSql, folderParams),
    query(dashboardSql, [searchPattern, userId]),
  ]);

  let dashboards = dashboardsResult.rows;
  if (workspaceId) {
    dashboards = dashboards.filter(d => d.workspace_id === workspaceId);
  }

  return {
    folders: foldersResult.rows,
    dashboards,
  };
}
