import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run PostgreSQL migrations programmatically.
 * @param {object} dbConfig - { host, port, database, user, password }
 * @param {function} onLog  - callback(message) for streaming output
 * @param {object} opts     - { skipAdminUser: true } to skip default admin creation
 * @returns {{ success, steps: { name, status, duration }[], errors: string[] }}
 */
export async function runPostgresMigration(dbConfig, onLog = console.log, opts = {}) {
  const { Pool } = pg;
  const steps = [];
  const errors = [];

  const step = (name, status, duration = 0) => {
    steps.push({ name, status, duration });
  };

  onLog('Starting PostgreSQL schema migration...');

  // 1 - Ensure target DB exists
  const adminPool = new Pool({
    host: dbConfig.host,
    port: parseInt(dbConfig.port || '5432'),
    database: 'postgres',
    user: dbConfig.user,
    password: dbConfig.password,
  });

  try {
    const t0 = Date.now();
    const dbCheck = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbConfig.database]);
    if (dbCheck.rows.length === 0) {
      await adminPool.query(`CREATE DATABASE "${dbConfig.database}"`);
      onLog(`Database '${dbConfig.database}' created`);
      step('Create database', 'ok', Date.now() - t0);
    } else {
      onLog(`Database '${dbConfig.database}' already exists`);
      step('Create database', 'skipped', Date.now() - t0);
    }
  } catch (err) {
    onLog(`ERROR creating database: ${err.message}`);
    step('Create database', 'error');
    errors.push(err.message);
    await adminPool.end();
    return { success: false, steps, errors };
  } finally {
    await adminPool.end();
  }

  // 2 - Connect to target DB and run schema
  const pool = new Pool({
    host: dbConfig.host,
    port: parseInt(dbConfig.port || '5432'),
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
  });

  try {
    await pool.query('SELECT NOW()');
    onLog(`Connected to ${dbConfig.database}`);

    // Run schema.sql
    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      const statements = splitSqlStatements(schemaSql);
      onLog(`Executing ${statements.length} schema statements...`);

      let completed = 0, skipped = 0, errCount = 0;
      for (const stmt of statements) {
        const short = stmt.substring(0, 70).replace(/\n/g, ' ').trim();
        try {
          await pool.query(stmt);
          completed++;
        } catch (err) {
          if (err.message.includes('already exists') || err.code === '42710' || err.code === '42P07') {
            skipped++;
          } else {
            errCount++;
            onLog(`  ERROR: ${short} — ${err.message}`);
            errors.push(err.message);
          }
        }
      }
      onLog(`Schema: ${completed} executed, ${skipped} skipped, ${errCount} errors`);
      step('Run schema.sql', errCount > 0 ? 'warning' : 'ok');
    } else {
      onLog('schema.sql not found — skipping');
      step('Run schema.sql', 'skipped');
    }

    // 3 - Incremental migrations
    onLog('Running incremental migrations...');
    const migrations = [
      { col: 'theme_preference', sql: `ALTER TABLE users ADD COLUMN theme_preference VARCHAR(20) DEFAULT 'light'` },
      { col: 'active_session_id', sql: `ALTER TABLE users ADD COLUMN active_session_id VARCHAR(255)` },
      { col: 'session_expires_at', sql: `ALTER TABLE users ADD COLUMN session_expires_at TIMESTAMP WITH TIME ZONE` },
      { col: 'preferences', sql: `ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb` },
      { col: 'totp_secret', sql: `ALTER TABLE users ADD COLUMN totp_secret TEXT` },
      { col: 'totp_enabled', sql: `ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT false` },
      { col: 'passkey_credentials', sql: `ALTER TABLE users ADD COLUMN passkey_credentials JSONB DEFAULT '[]'::jsonb` },
      { col: 'passkey_enabled', sql: `ALTER TABLE users ADD COLUMN passkey_enabled BOOLEAN DEFAULT false` },
      { col: 'two_factor_required', sql: `ALTER TABLE users ADD COLUMN two_factor_required BOOLEAN DEFAULT true` },
      { col: 'two_factor_grace_period_start', sql: `ALTER TABLE users ADD COLUMN two_factor_grace_period_start TIMESTAMP WITH TIME ZONE` },
      { col: 'two_factor_grace_days', sql: `ALTER TABLE users ADD COLUMN two_factor_grace_days INTEGER DEFAULT 7` },
      { col: 'account_locked', sql: `ALTER TABLE users ADD COLUMN account_locked BOOLEAN DEFAULT false` },
      { col: 'account_locked_reason', sql: `ALTER TABLE users ADD COLUMN account_locked_reason TEXT` },
      { col: 'account_unlock_expires', sql: `ALTER TABLE users ADD COLUMN account_unlock_expires TIMESTAMP WITH TIME ZONE` },
      { col: 'failed_login_attempts', sql: `ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0` },
      { col: 'last_failed_login', sql: `ALTER TABLE users ADD COLUMN last_failed_login TIMESTAMP WITH TIME ZONE` },
      { col: 'mfa_bypass_until', sql: `ALTER TABLE users ADD COLUMN mfa_bypass_until TIMESTAMP WITH TIME ZONE` },
      { col: 'mfa_bypass_reason', sql: `ALTER TABLE users ADD COLUMN mfa_bypass_reason TEXT` },
      { col: 'auth_provider', sql: `ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'local'` },
      { col: 'external_id', sql: `ALTER TABLE users ADD COLUMN external_id VARCHAR(255)` },
      { col: 'scim_managed', sql: `ALTER TABLE users ADD COLUMN scim_managed BOOLEAN DEFAULT false` },
    ];

    for (const m of migrations) {
      try {
        const check = await pool.query(
          `SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name=$1`, [m.col]
        );
        if (check.rows.length === 0) {
          await pool.query(m.sql);
          onLog(`  Added column: ${m.col}`);
        }
      } catch (err) {
        if (!err.message.includes('already exists')) {
          onLog(`  WARN (${m.col}): ${err.message}`);
        }
      }
    }

    // webauthn_challenges table
    try {
      const wc = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='webauthn_challenges'`);
      if (wc.rows.length === 0) {
        await pool.query(`
          CREATE TABLE webauthn_challenges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            challenge TEXT NOT NULL,
            type VARCHAR(20) NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user ON webauthn_challenges(user_id)`);
        onLog('  Created webauthn_challenges table');
      }
    } catch (err) {
      if (!err.message.includes('already exists')) onLog(`  WARN webauthn_challenges: ${err.message}`);
    }

    // folder_id on dashboards
    try {
      const fc = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='dashboards' AND column_name='folder_id'`);
      if (fc.rows.length === 0) {
        await pool.query(`ALTER TABLE dashboards ADD COLUMN folder_id UUID REFERENCES dashboard_folders(id) ON DELETE SET NULL`);
        onLog('  Added folder_id to dashboards');
      }
    } catch (err) {
      if (!err.message.includes('already exists')) onLog(`  WARN folder_id: ${err.message}`);
    }

    // folder_group_access
    try {
      const fga = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='folder_group_access'`);
      if (fga.rows.length === 0) {
        await pool.query(`
          CREATE TABLE folder_group_access (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            folder_id UUID NOT NULL REFERENCES dashboard_folders(id) ON DELETE CASCADE,
            group_id UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
            granted_by UUID REFERENCES users(id),
            granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_folder_group UNIQUE (folder_id, group_id)
          )`);
        onLog('  Created folder_group_access table');
      }
    } catch (err) {
      if (!err.message.includes('already exists')) onLog(`  WARN folder_group_access: ${err.message}`);
    }

    // ask_conversations columns
    for (const [col, sql] of [
      ['mode', `ALTER TABLE ask_conversations ADD COLUMN mode VARCHAR(20) NOT NULL DEFAULT 'semantic'`],
      ['workspace_id', `ALTER TABLE ask_conversations ADD COLUMN workspace_id UUID REFERENCES ask_workspaces(id) ON DELETE SET NULL`],
    ]) {
      try {
        const c = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='ask_conversations' AND column_name=$1`, [col]);
        if (c.rows.length === 0) {
          await pool.query(sql);
          onLog(`  Added ${col} to ask_conversations`);
        }
      } catch (err) {
        if (!err.message.includes('already exists')) onLog(`  WARN ${col}: ${err.message}`);
      }
    }

    // sample_questions
    for (const tbl of ['ask_workspace_views', 'ask_workspace_agents']) {
      try {
        const c = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='sample_questions'`, [tbl]);
        if (c.rows.length === 0) {
          await pool.query(`ALTER TABLE ${tbl} ADD COLUMN sample_questions JSONB DEFAULT '[]'`);
          onLog(`  Added sample_questions to ${tbl}`);
        }
      } catch (err) {
        if (!err.message.includes('already exists')) onLog(`  WARN sample_questions ${tbl}: ${err.message}`);
      }
    }

    step('Incremental migrations', 'ok');

    // Drop NOT NULL on password_hash for SSO users
    try {
      await pool.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
    } catch (_) { /* already nullable or does not exist */ }

    // unique index on external_id
    try {
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_external_id ON users(external_id) WHERE external_id IS NOT NULL`);
    } catch (_) {}

    // unique folder name
    try {
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_unique_name ON dashboard_folders(LOWER(name))`);
    } catch (_) {}

    step('Post-migration indexes', 'ok');

    // ── Workspace migration ─────────────────────────────────────
    onLog('Running workspace migration...');

    // Create workspaces table
    try {
      const wt = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='workspaces'`);
      if (wt.rows.length === 0) {
        await pool.query(`
          CREATE TABLE workspaces (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            connection_id UUID REFERENCES snowflake_connections(id),
            warehouse VARCHAR(255),
            role VARCHAR(255),
            created_by UUID NOT NULL REFERENCES users(id),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON workspaces(created_by)`);
        onLog('  Created workspaces table');
      }
    } catch (err) {
      if (!err.message.includes('already exists')) onLog(`  WARN workspaces: ${err.message}`);
    }

    // Create workspace_members table
    try {
      const wm = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='workspace_members'`);
      if (wm.rows.length === 0) {
        await pool.query(`
          CREATE TABLE workspace_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            added_by UUID REFERENCES users(id),
            added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_workspace_member UNIQUE (workspace_id, user_id)
          )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON workspace_members(workspace_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id)`);
        onLog('  Created workspace_members table');
      }
    } catch (err) {
      if (!err.message.includes('already exists')) onLog(`  WARN workspace_members: ${err.message}`);
    }

    // Create workspace_semantic_views table
    try {
      const wsv = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='workspace_semantic_views'`);
      if (wsv.rows.length === 0) {
        await pool.query(`
          CREATE TABLE workspace_semantic_views (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            semantic_view_fqn VARCHAR(1000) NOT NULL,
            label VARCHAR(255),
            sample_questions JSONB DEFAULT '[]',
            added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_ws_semantic_view UNIQUE (workspace_id, semantic_view_fqn)
          )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_ws_semantic_views_ws ON workspace_semantic_views(workspace_id)`);
        onLog('  Created workspace_semantic_views table');
      }
    } catch (err) {
      if (!err.message.includes('already exists')) onLog(`  WARN workspace_semantic_views: ${err.message}`);
    }

    // Create workspace_agents table
    try {
      const wa = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='workspace_agents'`);
      if (wa.rows.length === 0) {
        await pool.query(`
          CREATE TABLE workspace_agents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            agent_fqn VARCHAR(1000) NOT NULL,
            label VARCHAR(255),
            sample_questions JSONB DEFAULT '[]',
            added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_ws_agent UNIQUE (workspace_id, agent_fqn)
          )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_ws_agents_ws ON workspace_agents(workspace_id)`);
        onLog('  Created workspace_agents table');
      }
    } catch (err) {
      if (!err.message.includes('already exists')) onLog(`  WARN workspace_agents: ${err.message}`);
    }

    // Create workspace_connections table (many-to-many)
    try {
      const wc = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='workspace_connections'`);
      if (wc.rows.length === 0) {
        await pool.query(`
          CREATE TABLE workspace_connections (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            connection_id UUID NOT NULL REFERENCES snowflake_connections(id) ON DELETE CASCADE,
            warehouse VARCHAR(255),
            role VARCHAR(255),
            added_by UUID REFERENCES users(id),
            added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_workspace_connection UNIQUE (workspace_id, connection_id)
          )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_workspace_connections_ws ON workspace_connections(workspace_id)`);
        onLog('  Created workspace_connections table');

        // Migrate any existing workspaces.connection_id -> workspace_connections
        const hasOldCol = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='workspaces' AND column_name='connection_id'`);
        if (hasOldCol.rows.length > 0) {
          const migrated = await pool.query(`
            INSERT INTO workspace_connections (workspace_id, connection_id, warehouse, role, added_by)
            SELECT w.id, w.connection_id, w.warehouse, w.role, w.created_by
            FROM workspaces w
            WHERE w.connection_id IS NOT NULL
            ON CONFLICT (workspace_id, connection_id) DO NOTHING
          `);
          if (migrated.rowCount > 0) onLog(`  Migrated ${migrated.rowCount} workspace connections to workspace_connections`);

          // Drop old columns
          try { await pool.query(`ALTER TABLE workspaces DROP COLUMN IF EXISTS connection_id`); } catch (_) {}
          try { await pool.query(`ALTER TABLE workspaces DROP COLUMN IF EXISTS warehouse`); } catch (_) {}
          try { await pool.query(`ALTER TABLE workspaces DROP COLUMN IF EXISTS role`); } catch (_) {}
          onLog('  Dropped legacy connection_id/warehouse/role from workspaces');
        }
      }
    } catch (err) {
      if (!err.message.includes('already exists')) onLog(`  WARN workspace_connections: ${err.message}`);
    }

    // Add workspace_id to dashboards
    try {
      const dc = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='dashboards' AND column_name='workspace_id'`);
      if (dc.rows.length === 0) {
        await pool.query(`ALTER TABLE dashboards ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_dashboards_workspace ON dashboards(workspace_id)`);
        onLog('  Added workspace_id to dashboards');
      }
    } catch (err) {
      if (!err.message.includes('already exists')) onLog(`  WARN dashboards.workspace_id: ${err.message}`);
    }

    // Make dashboards.connection_id nullable (workspace provides connection)
    try {
      await pool.query(`ALTER TABLE dashboards ALTER COLUMN connection_id DROP NOT NULL`);
    } catch (_) { /* already nullable */ }
    try {
      await pool.query(`ALTER TABLE dashboards ALTER COLUMN warehouse DROP NOT NULL`);
    } catch (_) { /* already nullable */ }
    try {
      await pool.query(`ALTER TABLE dashboards ALTER COLUMN role DROP NOT NULL`);
    } catch (_) { /* already nullable */ }

    // Add workspace_id to dashboard_folders
    try {
      const fc = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='dashboard_folders' AND column_name='workspace_id'`);
      if (fc.rows.length === 0) {
        await pool.query(`ALTER TABLE dashboard_folders ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL`);
        onLog('  Added workspace_id to dashboard_folders');
      }
    } catch (err) {
      if (!err.message.includes('already exists')) onLog(`  WARN dashboard_folders.workspace_id: ${err.message}`);
    }

    // Add workspaces trigger
    try {
      await pool.query(`
        DROP TRIGGER IF EXISTS update_workspaces_updated_at ON workspaces;
        CREATE TRIGGER update_workspaces_updated_at
          BEFORE UPDATE ON workspaces
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);
    } catch (_) {}

    // ── Migrate data from ask_workspaces -> workspaces ────────
    try {
      const hasAskWs = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='ask_workspaces'`);
      if (hasAskWs.rows.length > 0) {
        const notYetMigrated = await pool.query(`
          SELECT aw.* FROM ask_workspaces aw
          LEFT JOIN workspaces w ON w.id = aw.id
          WHERE w.id IS NULL
        `);
        for (const row of notYetMigrated.rows) {
          try {
            await pool.query(`
              INSERT INTO workspaces (id, name, description, created_by, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (id) DO NOTHING
            `, [row.id, row.name, row.description, row.owner_id, row.created_at, row.updated_at]);
          } catch (nameErr) {
            if (nameErr.message.includes('unique') || nameErr.message.includes('duplicate')) {
              await pool.query(`
                INSERT INTO workspaces (id, name, description, created_by, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO NOTHING
              `, [row.id, `${row.name} (migrated-${row.id.slice(0,8)})`, row.description, row.owner_id, row.created_at, row.updated_at]);
            }
          }
          if (row.connection_id) {
            try {
              await pool.query(`
                INSERT INTO workspace_connections (workspace_id, connection_id, warehouse, role, added_by)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (workspace_id, connection_id) DO NOTHING
              `, [row.id, row.connection_id, row.warehouse || null, row.role || null, row.owner_id]);
            } catch (_) {}
          }
        }
        if (notYetMigrated.rows.length > 0) onLog(`  Migrated ${notYetMigrated.rows.length} ask_workspaces -> workspaces`);

        // Migrate views
        try {
          const hasWsViews = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='ask_workspace_views'`);
          if (hasWsViews.rows.length > 0) {
            await pool.query(`
              INSERT INTO workspace_semantic_views (id, workspace_id, semantic_view_fqn, label, sample_questions, added_at)
              SELECT id, workspace_id, semantic_view_fqn, label, COALESCE(sample_questions, '[]'::jsonb), added_at
              FROM ask_workspace_views
              WHERE workspace_id IN (SELECT id FROM workspaces)
              ON CONFLICT (id) DO NOTHING
            `);
          }
        } catch (_) {}

        // Migrate agents
        try {
          const hasWsAgents = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='ask_workspace_agents'`);
          if (hasWsAgents.rows.length > 0) {
            await pool.query(`
              INSERT INTO workspace_agents (id, workspace_id, agent_fqn, label, sample_questions, added_at)
              SELECT id, workspace_id, agent_fqn, label, COALESCE(sample_questions, '[]'::jsonb), added_at
              FROM ask_workspace_agents
              WHERE workspace_id IN (SELECT id FROM workspaces)
              ON CONFLICT (id) DO NOTHING
            `);
          }
        } catch (_) {}

        // Migrate workspace group access -> workspace members
        try {
          const hasWga = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='ask_workspace_group_access'`);
          if (hasWga.rows.length > 0) {
            await pool.query(`
              INSERT INTO workspace_members (workspace_id, user_id, added_by, added_at)
              SELECT DISTINCT wga.workspace_id, gm.user_id, wga.granted_by, wga.granted_at
              FROM ask_workspace_group_access wga
              JOIN group_members gm ON gm.group_id = wga.group_id
              WHERE wga.workspace_id IN (SELECT id FROM workspaces)
              ON CONFLICT (workspace_id, user_id) DO NOTHING
            `);
          }
        } catch (_) {}

        // Add workspace owners as members
        try {
          await pool.query(`
            INSERT INTO workspace_members (workspace_id, user_id, added_by, added_at)
            SELECT w.id, w.created_by, w.created_by, w.created_at
            FROM workspaces w
            ON CONFLICT (workspace_id, user_id) DO NOTHING
          `);
        } catch (_) {}
      }
    } catch (err) {
      onLog(`  WARN ask_workspaces migration: ${err.message}`);
    }

    // Update ask_conversations workspace_id FK to point to new workspaces table
    // (only needed if ask_conversations still references ask_workspaces)
    try {
      const fkCheck = await pool.query(`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'ask_conversations' AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%workspace%'
      `);
      for (const fk of fkCheck.rows) {
        if (fk.constraint_name.includes('ask_workspace')) {
          await pool.query(`ALTER TABLE ask_conversations DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`);
          await pool.query(`
            ALTER TABLE ask_conversations
            ADD CONSTRAINT ask_conversations_workspace_id_fkey
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
          `);
          onLog('  Updated ask_conversations FK to reference workspaces');
          break;
        }
      }
    } catch (err) {
      if (!err.message.includes('already exists')) onLog(`  WARN ask_conversations FK: ${err.message}`);
    }

    step('Workspace migration', 'ok');
    onLog('Migration complete');
  } catch (err) {
    onLog(`FATAL: ${err.message}`);
    errors.push(err.message);
    step('Migration', 'error');
  } finally {
    await pool.end();
  }

  return { success: errors.length === 0, steps, errors };
}

/**
 * Connect to an arbitrary Snowflake account using the provided config.
 * Returns { query, destroy } for running SQL and cleaning up.
 */
async function createSnowflakeDestConnection(destConfig) {
  const snowflake = (await import('snowflake-sdk')).default;

  snowflake.configure({ insecureConnect: true, logLevel: 'WARN', keepAlive: false });

  const opts = {
    account: destConfig.account,
    username: destConfig.user || destConfig.sfUser,
    warehouse: destConfig.warehouse,
    database: destConfig.database || destConfig.sfDatabase,
    schema: destConfig.schema || destConfig.sfSchema || 'APP',
    role: destConfig.role || destConfig.sfRole,
    clientSessionKeepAlive: false,
    timeout: 60000,
  };

  const authType = destConfig.authType || 'password';
  if (authType === 'keypair') {
    opts.authenticator = 'SNOWFLAKE_JWT';
    const keyContent = destConfig.privateKey || destConfig.sfPrivateKey;
    if (keyContent) {
      const cryptoMod = await import('crypto');
      const keyObj = cryptoMod.createPrivateKey({
        key: keyContent,
        format: 'pem',
        passphrase: destConfig.privateKeyPass || undefined,
      });
      opts.privateKey = keyObj.export({ type: 'pkcs8', format: 'pem' });
    }
  } else if (authType === 'pat') {
    opts.authenticator = 'SNOWFLAKE';
    opts.password = destConfig.token || destConfig.sfToken || destConfig.password;
  } else {
    opts.authenticator = 'SNOWFLAKE';
    opts.password = destConfig.password || destConfig.sfPassword;
  }

  const conn = await new Promise((resolve, reject) => {
    const c = snowflake.createConnection(opts);
    c.connect((err, connected) => err ? reject(err) : resolve(connected));
  });

  const execRaw = (sql, binds = []) => new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds,
      complete: (err, _stmt, rows) => err ? reject(err) : resolve(rows || []),
    });
  });

  await execRaw(`USE DATABASE "${(destConfig.database || destConfig.sfDatabase).replace(/"/g, '')}"`);
  await execRaw(`USE SCHEMA "${(destConfig.schema || destConfig.sfSchema || 'APP').replace(/"/g, '')}"`);
  if (destConfig.warehouse) {
    await execRaw(`USE WAREHOUSE "${destConfig.warehouse.replace(/"/g, '')}"`);
  }

  return {
    query: async (sql, binds = []) => {
      const sfSql = sql.replace(/\$(\d+)/g, () => '?');
      const rows = await execRaw(sfSql, binds.map(b => b === undefined ? null : b));
      const normalized = rows.map(row => {
        const out = {};
        for (const [k, v] of Object.entries(row)) out[k.toLowerCase()] = v;
        return out;
      });
      return { rows: normalized, rowCount: normalized.length };
    },
    destroy: () => { try { conn.destroy(); } catch (_) {} },
  };
}

/**
 * Run Snowflake migrations programmatically.
 * @param {object} destConfig - Snowflake connection config for the destination.
 *   If omitted, uses the app's own service connection (for schema-update-in-place).
 * @param {function} onLog - callback(message) for streaming output
 */
export async function runSnowflakeMigration(destConfig, onLog = console.log) {
  const steps = [];
  const errors = [];

  // Support legacy call signature: runSnowflakeMigration(onLog)
  if (typeof destConfig === 'function') {
    onLog = destConfig;
    destConfig = null;
  }

  onLog('Starting Snowflake schema migration...');

  let sfQuery;
  let destroyConn = null;

  if (destConfig) {
    try {
      const dest = await createSnowflakeDestConnection(destConfig);
      sfQuery = dest.query;
      destroyConn = dest.destroy;
      onLog(`Connected to Snowflake destination: ${destConfig.account}`);
    } catch (err) {
      onLog(`ERROR connecting to Snowflake destination: ${err.message}`);
      errors.push(err.message);
      return { success: false, steps: [{ name: 'Connect', status: 'error' }], errors };
    }
  } else {
    try {
      const sfBackend = await import('../db/snowflakeBackend.js');
      await sfBackend.initServiceConnection();
      sfQuery = sfBackend.query;
      onLog('Connected to Snowflake service account');
    } catch (err) {
      onLog(`ERROR connecting to Snowflake: ${err.message}`);
      errors.push(err.message);
      return { success: false, steps: [{ name: 'Connect', status: 'error' }], errors };
    }
  }

  const statements = [
    { name: 'users', sql: `CREATE HYBRID TABLE IF NOT EXISTS users (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      username VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255), display_name VARCHAR(255),
      role VARCHAR(20) DEFAULT 'viewer' NOT NULL,
      auth_provider VARCHAR(20) DEFAULT 'local' NOT NULL,
      external_id VARCHAR(255), scim_managed BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE, theme_preference VARCHAR(20) DEFAULT 'light',
      active_session_id VARCHAR(255), session_expires_at TIMESTAMP_LTZ,
      preferences VARIANT DEFAULT PARSE_JSON('{}'),
      totp_secret VARCHAR(1000), totp_enabled BOOLEAN DEFAULT FALSE,
      passkey_credentials VARIANT DEFAULT PARSE_JSON('[]'),
      passkey_enabled BOOLEAN DEFAULT FALSE,
      two_factor_required BOOLEAN DEFAULT TRUE,
      two_factor_grace_period_start TIMESTAMP_LTZ,
      two_factor_grace_days INTEGER DEFAULT 7,
      account_locked BOOLEAN DEFAULT FALSE, account_locked_reason VARCHAR(500),
      account_unlock_expires TIMESTAMP_LTZ,
      failed_login_attempts INTEGER DEFAULT 0, last_failed_login TIMESTAMP_LTZ,
      mfa_bypass_until TIMESTAMP_LTZ, mfa_bypass_reason VARCHAR(500),
      created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      last_login TIMESTAMP_LTZ, created_by VARCHAR(36),
      default_workspace_id VARCHAR(36),
      PRIMARY KEY (id), UNIQUE (username), UNIQUE (email)
    )` },

    { name: 'snowflake_connections', sql: `CREATE HYBRID TABLE IF NOT EXISTS snowflake_connections (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      name VARCHAR(255) NOT NULL, description VARCHAR(5000),
      user_id VARCHAR(36) NOT NULL,
      account VARCHAR(255) NOT NULL, username VARCHAR(255) NOT NULL,
      auth_type VARCHAR(20) NOT NULL, credentials_encrypted VARCHAR(10000) NOT NULL,
      default_warehouse VARCHAR(255), default_role VARCHAR(255),
      is_valid BOOLEAN DEFAULT TRUE, last_tested TIMESTAMP_LTZ,
      last_test_error VARCHAR(5000),
      created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id), UNIQUE (user_id, name),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )` },

    { name: 'user_groups', sql: `CREATE HYBRID TABLE IF NOT EXISTS user_groups (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      name VARCHAR(255) NOT NULL, description VARCHAR(5000),
      created_by VARCHAR(36) NOT NULL,
      created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id), UNIQUE (name),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )` },

    { name: 'group_members', sql: `CREATE HYBRID TABLE IF NOT EXISTS group_members (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      group_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL,
      added_by VARCHAR(36),
      added_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id), UNIQUE (group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES user_groups(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )` },

    { name: 'workspaces', sql: `CREATE HYBRID TABLE IF NOT EXISTS workspaces (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      name VARCHAR(255) NOT NULL, description VARCHAR(16777216),
      created_by VARCHAR(36) NOT NULL,
      created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id), UNIQUE (name),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )` },

    { name: 'workspace_connections', sql: `CREATE HYBRID TABLE IF NOT EXISTS workspace_connections (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      workspace_id VARCHAR(36) NOT NULL,
      connection_id VARCHAR(36) NOT NULL,
      warehouse VARCHAR(255), role VARCHAR(255),
      added_by VARCHAR(36),
      added_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id), UNIQUE (workspace_id, connection_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (connection_id) REFERENCES snowflake_connections(id)
    )` },

    { name: 'workspace_members', sql: `CREATE HYBRID TABLE IF NOT EXISTS workspace_members (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      workspace_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL,
      added_by VARCHAR(36),
      added_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id), UNIQUE (workspace_id, user_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )` },

    { name: 'workspace_semantic_views', sql: `CREATE HYBRID TABLE IF NOT EXISTS workspace_semantic_views (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      workspace_id VARCHAR(36) NOT NULL,
      workspace_connection_id VARCHAR(36) NOT NULL,
      semantic_view_fqn VARCHAR(1000) NOT NULL,
      label VARCHAR(255),
      sample_questions VARIANT DEFAULT PARSE_JSON('[]'),
      added_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id),
      UNIQUE (workspace_id, workspace_connection_id, semantic_view_fqn),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (workspace_connection_id) REFERENCES workspace_connections(id)
    )` },

    { name: 'workspace_agents', sql: `CREATE HYBRID TABLE IF NOT EXISTS workspace_agents (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      workspace_id VARCHAR(36) NOT NULL,
      workspace_connection_id VARCHAR(36) NOT NULL,
      agent_fqn VARCHAR(1000) NOT NULL,
      label VARCHAR(255),
      sample_questions VARIANT DEFAULT PARSE_JSON('[]'),
      added_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id),
      UNIQUE (workspace_id, workspace_connection_id, agent_fqn),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (workspace_connection_id) REFERENCES workspace_connections(id)
    )` },

    { name: 'dashboard_folders', sql: `CREATE HYBRID TABLE IF NOT EXISTS dashboard_folders (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      name VARCHAR(255) NOT NULL, description VARCHAR(5000),
      parent_id VARCHAR(36), owner_id VARCHAR(36) NOT NULL,
      workspace_id VARCHAR(36),
      is_public BOOLEAN DEFAULT FALSE,
      icon VARCHAR(50) DEFAULT 'folder', color VARCHAR(7) DEFAULT '#6366f1',
      created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )` },

    { name: 'folder_group_access', sql: `CREATE HYBRID TABLE IF NOT EXISTS folder_group_access (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      folder_id VARCHAR(36) NOT NULL, group_id VARCHAR(36) NOT NULL,
      granted_by VARCHAR(36),
      granted_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id), UNIQUE (folder_id, group_id),
      FOREIGN KEY (folder_id) REFERENCES dashboard_folders(id),
      FOREIGN KEY (group_id) REFERENCES user_groups(id)
    )` },

    { name: 'dashboards', sql: `CREATE HYBRID TABLE IF NOT EXISTS dashboards (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      name VARCHAR(255) NOT NULL, description VARCHAR(5000),
      owner_id VARCHAR(36) NOT NULL,
      workspace_id VARCHAR(36), connection_id VARCHAR(36), folder_id VARCHAR(36),
      warehouse VARCHAR(255), role VARCHAR(255),
      yaml_definition VARCHAR(16777216),
      visibility VARCHAR(20) DEFAULT 'private',
      is_published BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )` },

    { name: 'dashboard_group_access', sql: `CREATE HYBRID TABLE IF NOT EXISTS dashboard_group_access (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      dashboard_id VARCHAR(36) NOT NULL, group_id VARCHAR(36) NOT NULL,
      granted_by VARCHAR(36),
      granted_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id), UNIQUE (dashboard_id, group_id),
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id),
      FOREIGN KEY (group_id) REFERENCES user_groups(id)
    )` },

    { name: 'dashboard_user_access', sql: `CREATE HYBRID TABLE IF NOT EXISTS dashboard_user_access (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      dashboard_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL,
      access_level VARCHAR(50) DEFAULT 'view',
      granted_by VARCHAR(36),
      granted_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id), UNIQUE (dashboard_id, user_id),
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )` },

    { name: 'ask_conversations', sql: `CREATE HYBRID TABLE IF NOT EXISTS ask_conversations (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      user_id VARCHAR(36) NOT NULL, connection_id VARCHAR(36),
      workspace_id VARCHAR(36),
      mode VARCHAR(20) DEFAULT 'semantic',
      title VARCHAR(500) DEFAULT 'New conversation',
      created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )` },

    { name: 'ask_messages', sql: `CREATE HYBRID TABLE IF NOT EXISTS ask_messages (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      conversation_id VARCHAR(36) NOT NULL,
      role VARCHAR(20) NOT NULL,
      content VARCHAR(16777216) DEFAULT '',
      artifacts VARCHAR(16777216),
      created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id),
      FOREIGN KEY (conversation_id) REFERENCES ask_conversations(id)
    )` },

    { name: 'ask_dashboards', sql: `CREATE HYBRID TABLE IF NOT EXISTS ask_dashboards (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      user_id VARCHAR(36) NOT NULL, connection_id VARCHAR(36),
      title VARCHAR(500) DEFAULT 'AI Dashboard',
      yaml_definition VARCHAR(16777216) NOT NULL,
      share_token VARCHAR(64),
      created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )` },

    { name: 'audit_log', sql: `CREATE HYBRID TABLE IF NOT EXISTS audit_log (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      user_id VARCHAR(36), action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50), entity_id VARCHAR(36),
      details VARIANT, ip_address VARCHAR(45),
      created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id)
    )` },

    { name: 'webauthn_challenges', sql: `CREATE HYBRID TABLE IF NOT EXISTS webauthn_challenges (
      id VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      challenge VARCHAR(5000) NOT NULL, type VARCHAR(20) NOT NULL,
      expires_at TIMESTAMP_LTZ NOT NULL,
      created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )` },
  ];

  let completed = 0, skipped = 0;
  for (const { name, sql } of statements) {
    try {
      await sfQuery(sql);
      completed++;
      onLog(`  OK: ${name}`);
    } catch (err) {
      if (err.message?.includes('already exists')) {
        skipped++;
        onLog(`  Skipped: ${name}`);
      } else {
        errors.push(`${name}: ${err.message}`);
        onLog(`  ERROR: ${name} — ${err.message}`);
      }
    }
  }

  steps.push({ name: 'Schema tables', status: errors.length === 0 ? 'ok' : 'warning' });
  onLog(`Snowflake migration complete: ${completed} created, ${skipped} skipped, ${errors.length} errors`);

  if (destroyConn) destroyConn();

  return { success: errors.length === 0, steps, errors };
}

/** Exported for use by dataMigrationService to get a query handle on a Snowflake destination. */
export { createSnowflakeDestConnection };

/**
 * Create the initial owner account (used during setup wizard).
 */
export async function createOwnerAccount(pool, { username, email, password, displayName }) {
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
  if (existing.rows.length > 0) {
    throw new Error('A user with that username or email already exists');
  }

  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4, 'owner') RETURNING id, username, email, display_name, role`,
    [username, email, passwordHash, displayName || username]
  );

  return result.rows[0];
}

// ---- helpers ---------------------------------------------------------------

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarBlock = false;

  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') && !inDollarBlock) continue;
    current += line + '\n';

    const dollarMatches = line.match(/\$\$/g);
    if (dollarMatches) {
      for (const _ of dollarMatches) inDollarBlock = !inDollarBlock;
    }

    if (!inDollarBlock && trimmed.endsWith(';')) {
      const stmt = current.trim();
      if (stmt.length > 0 && !stmt.startsWith('--')) statements.push(stmt);
      current = '';
    }
  }

  if (current.trim().length > 0 && !current.trim().startsWith('--')) {
    statements.push(current.trim());
  }

  return statements;
}
