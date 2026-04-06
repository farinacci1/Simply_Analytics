/**
 * Simply Analytics - API Server
 * 
 * Production-ready Express server for the Simply Analytics platform.
 * Supports zero-config deployment with bootstrap admin login and admin panel provisioning.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

import configStore from './config/configStore.js';
import { getMasterKeyHex } from './config/configEncryption.js';
import { initHotReload } from './config/hotReload.js';

const app = express();

// ---------------------------------------------------------------------------
// Global middleware (always active regardless of setup state)
// ---------------------------------------------------------------------------

const NODE_ENV = process.env.NODE_ENV || 'development';
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: NODE_ENV === 'production', crossOriginEmbedderPolicy: false }));

app.use(cors({
  origin: (_origin, cb) => {
    const raw = configStore.get('CORS_ORIGINS') || process.env.CORS_ORIGINS;
    const allowed = raw ? raw.split(',') : ['http://localhost:5173', 'http://localhost:3000'];
    cb(null, allowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: () => parseInt(configStore.get('RATE_LIMIT_MAX') || process.env.RATE_LIMIT_MAX || '1000', 10),
  message: { error: 'Too many requests' },
  skip: (req) => req.path === '/api/v1/health' || req.path.startsWith('/api/v1/setup'),
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// ---------------------------------------------------------------------------
// Bootstrap auth — available before full setup
// Hardcoded admin/admin123 credentials, disabled once a real owner is created.
// ---------------------------------------------------------------------------

const BOOTSTRAP_USER = 'admin';
const BOOTSTRAP_PASS = 'admin123';

function getBootstrapSecret() {
  return crypto.createHash('sha256').update('bootstrap:' + getMasterKeyHex()).digest('hex');
}

function setupAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, getBootstrapSecret());
    if (decoded.role === 'bootstrap_admin') {
      req.user = decoded;
      return next();
    }
  } catch (_) {}

  if (configStore.isConfigured()) {
    return res.status(403).json({ error: 'Setup already complete' });
  }
  return res.status(401).json({ error: 'Invalid or expired token' });
}

// Bootstrap login — only active when app is unconfigured
app.post('/api/v1/auth/login', (req, res, next) => {
  if (configStore.isConfigured()) return next();

  const { username, password } = req.body;
  if (username === BOOTSTRAP_USER && password === BOOTSTRAP_PASS) {
    const token = jwt.sign(
      { userId: 'bootstrap', username: BOOTSTRAP_USER, role: 'bootstrap_admin' },
      getBootstrapSecret(),
      { expiresIn: '4h' }
    );
    return res.json({
      success: true,
      user: { id: 'bootstrap', username: BOOTSTRAP_USER, email: '', role: 'bootstrap_admin' },
      token,
    });
  }
  return res.status(401).json({ success: false, error: 'Invalid credentials' });
});

// Bootstrap token validation
app.get('/api/v1/auth/validate', (req, res, next) => {
  if (configStore.isConfigured()) return next();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.json({ valid: false });
  try {
    const decoded = jwt.verify(token, getBootstrapSecret());
    return res.json({ valid: true, user: { id: decoded.userId, username: decoded.username, role: decoded.role } });
  } catch (_) {
    return res.json({ valid: false });
  }
});

// Bootstrap logout (no-op — stateless JWT)
app.post('/api/v1/auth/logout', (req, res, next) => {
  if (configStore.isConfigured()) return next();
  return res.json({ success: true });
});

// Bootstrap roles
app.get('/api/v1/auth/roles', (req, res, next) => {
  if (configStore.isConfigured()) return next();
  return res.json({ roles: ['bootstrap_admin'] });
});

// ---------------------------------------------------------------------------
// Emergency login — when DB is unreachable, let the owner authenticate
// using the master encryption key they saved during initial setup.
// No database access needed.
// ---------------------------------------------------------------------------

app.post('/api/v1/auth/emergency-login', (req, res) => {
  if (!configStore.isConfigured()) {
    return res.status(400).json({ success: false, error: 'App is not configured yet' });
  }

  const { masterKey } = req.body;
  if (!masterKey) {
    return res.status(400).json({ success: false, error: 'Master encryption key is required' });
  }

  if (!configStore.verifyMasterKey(masterKey)) {
    return res.status(401).json({ success: false, error: 'Invalid master key' });
  }

  const jwtSecret = configStore.get('JWT_SECRET');
  if (!jwtSecret) {
    return res.status(500).json({ success: false, error: 'JWT secret not configured' });
  }

  const token = jwt.sign(
    {
      userId: 'emergency',
      username: 'owner',
      role: 'owner',
      emergencyMode: true,
    },
    jwtSecret,
    { expiresIn: '2h' }
  );

  console.warn('[emergency-login] Owner authenticated via master key (database may be unreachable)');

  res.json({
    success: true,
    token,
    user: {
      id: 'emergency',
      username: 'owner',
      role: 'owner',
    },
    emergencyMode: true,
  });
});

// ---------------------------------------------------------------------------
// Emergency helpers — check DB health and create owner when DB is up but empty
// ---------------------------------------------------------------------------

function requireEmergencyJwt(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, configStore.get('JWT_SECRET'));
    if (decoded.emergencyMode) { req.user = decoded; return next(); }
  } catch (_) {}
  return res.status(403).json({ error: 'Emergency authentication required' });
}

app.get('/api/v1/auth/db-status', requireEmergencyJwt, async (_req, res) => {
  const pg = await import('pg');
  const pool = new pg.default.Pool({
    host: configStore.get('POSTGRES_HOST'),
    port: parseInt(configStore.get('POSTGRES_PORT') || '5432'),
    database: configStore.get('POSTGRES_DB'),
    user: configStore.get('POSTGRES_USER'),
    password: configStore.get('POSTGRES_PASSWORD'),
    connectionTimeoutMillis: 5000,
  });

  try {
    await pool.query('SELECT 1');
    try {
      const userCount = await pool.query('SELECT COUNT(*)::int AS count FROM users');
      const ownerRow = await pool.query(
        `SELECT id, username, email FROM users WHERE role = 'owner' LIMIT 1`
      );
      res.json({
        dbReachable: true,
        userCount: userCount.rows[0].count,
        tablesExist: true,
        owner: ownerRow.rows[0] || null,
      });
    } catch (_) {
      res.json({ dbReachable: true, userCount: 0, tablesExist: false, owner: null });
    }
  } catch (err) {
    res.json({ dbReachable: false, userCount: 0, tablesExist: false, owner: null, error: err.message });
  } finally {
    await pool.end().catch(() => {});
  }
});

app.post('/api/v1/auth/emergency-create-owner', requireEmergencyJwt, async (req, res) => {
  const { username, email, password, displayName } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' });
  }

  const { validatePasswordStrength } = await import('./services/userService.js');
  const pwErrors = validatePasswordStrength(password);
  if (pwErrors.length > 0) {
    return res.status(400).json({ error: `Password must have: ${pwErrors.join(', ')}` });
  }

  const pg = await import('pg');
  const pool = new pg.default.Pool({
    host: configStore.get('POSTGRES_HOST'),
    port: parseInt(configStore.get('POSTGRES_PORT') || '5432'),
    database: configStore.get('POSTGRES_DB'),
    user: configStore.get('POSTGRES_USER'),
    password: configStore.get('POSTGRES_PASSWORD'),
  });

  try {
    const { runPostgresMigration, createOwnerAccount } = await import('./services/migrationRunner.js');
    const bcrypt = await import('bcryptjs');

    // Ensure tables exist — run full migration if needed
    const tableCheck = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') AS exists`
    );
    if (!tableCheck.rows[0].exists) {
      const dbConfig = {
        host: configStore.get('POSTGRES_HOST'),
        port: configStore.get('POSTGRES_PORT') || '5432',
        database: configStore.get('POSTGRES_DB'),
        user: configStore.get('POSTGRES_USER'),
        password: configStore.get('POSTGRES_PASSWORD'),
      };
      const migResult = await runPostgresMigration(dbConfig, console.log, { skipAdminUser: true });
      if (!migResult.success) {
        return res.status(500).json({ error: 'Failed to create database tables' });
      }
    }

    // Check if an owner already exists
    const existingOwner = await pool.query(`SELECT id FROM users WHERE role = 'owner' LIMIT 1`);

    if (existingOwner.rows.length > 0) {
      // Reset existing owner credentials
      const passwordHash = await bcrypt.default.hash(password, 10);
      const updated = await pool.query(
        `UPDATE users SET username = $1, email = $2, password_hash = $3, display_name = $4,
         account_locked = false, account_locked_reason = NULL, failed_login_attempts = 0,
         is_active = true
         WHERE id = $5
         RETURNING id, username, email, display_name, role`,
        [username, email, passwordHash, displayName || username, existingOwner.rows[0].id]
      );
      return res.json({ success: true, user: updated.rows[0], action: 'reset' });
    }

    // No owner — create one
    const owner = await createOwnerAccount(pool, { username, email, password, displayName });
    res.json({ success: true, user: owner, action: 'created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end().catch(() => {});
  }
});

// ---------------------------------------------------------------------------
// Health & setup-status endpoints (always available)
// ---------------------------------------------------------------------------

app.get('/api/v1/health', async (_req, res) => {
  let activeSessions = 0;
  try {
    const authMod = await import('./middleware/auth.js');
    activeSessions = authMod.getActiveSessionCount();
  } catch (_) {}
  res.json({ status: 'ok', timestamp: new Date().toISOString(), activeSessions });
});

app.get('/api/v1/ready', (_req, res) => res.json({ ready: true }));
app.get('/api/v1/live', (_req, res) => res.json({ alive: true }));

app.get('/api/v1/password-policy', (_req, res) => {
  res.json(configStore.getPasswordPolicy());
});

app.get('/api/v1/setup/status', (_req, res) => {
  res.json({ configured: configStore.isConfigured() });
});

// Setup routes — protected by bootstrap admin auth (dynamic import to avoid loading db.js before config)
import('./routes/setup.js').then(({ setupRoutes }) => {
  app.use('/api/v1/setup', setupAuthMiddleware, setupRoutes);
});

// ---------------------------------------------------------------------------
// Normal-mode route mounting
// ---------------------------------------------------------------------------

let normalRoutesLoaded = false;

async function mountNormalRoutes() {
  if (normalRoutesLoaded) return;
  normalRoutesLoaded = true;

  const { queryRoutes } = await import('./routes/query.js');
  const { semanticRoutes } = await import('./routes/semantic.js');
  const { dashboardRoutes } = await import('./routes/dashboard.js');
  const { authRoutes } = await import('./routes/auth.js');
  const { twoFactorRoutes } = await import('./routes/twoFactor.js');
  const { userRoutes } = await import('./routes/users.js');
  const { connectionRoutes } = await import('./routes/connections.js');
  const folderRoutes = (await import('./routes/folders.js')).default;
  const samlRoutes = (await import('./routes/saml.js')).default;
  const scimRoutes = (await import('./routes/scim.js')).default;
  const { dashboardAiRoutes } = await import('./routes/dashboardAi.js');
  const { askRoutes, askPublicRoutes } = await import('./routes/ask.js');
  const { workspaceRoutes } = await import('./routes/workspaces.js');
  const { groupRoutes } = await import('./routes/groups.js');

  const { authMiddleware, optionalAuthMiddleware } = await import('./middleware/auth.js');
  const { adminRoutes } = await import('./routes/admin.js');

  app.use('/api/v1/admin', authMiddleware, adminRoutes);

  app.use('/api/v1/auth', optionalAuthMiddleware, authRoutes);
  app.use('/api/v1/2fa', optionalAuthMiddleware, twoFactorRoutes);
  app.use('/api/v1/saml', samlRoutes);
  app.use('/api/v1/ask/shared/dashboard', askPublicRoutes);
  app.use('/scim/v2', scimRoutes);

  app.use('/api/v1/workspaces', authMiddleware, workspaceRoutes);
  app.use('/api/v1/dashboard', authMiddleware, dashboardRoutes);
  app.use('/api/v1/semantic', authMiddleware, semanticRoutes);
  app.use('/api/v1/query', authMiddleware, queryRoutes);
  app.use('/api/v1/dashboard-ai', authMiddleware, dashboardAiRoutes);
  app.use('/api/v1/ask', authMiddleware, askRoutes);
  app.use('/api/v1/users', authMiddleware, userRoutes);
  app.use('/api/v1/connections', authMiddleware, connectionRoutes);
  app.use('/api/v1/folders', authMiddleware, folderRoutes);
  app.use('/api/v1/groups', authMiddleware, groupRoutes);

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/v1')) res.status(404).json({ error: 'Endpoint not found' });
    else next();
  });

  app.use((err, req, res, _next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({
      error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
  });

  console.log('[server] Normal-mode routes mounted');
}

// ---------------------------------------------------------------------------
// Lightweight schema patches (run at startup to ensure new tables exist)
// ---------------------------------------------------------------------------

async function ensureLatestSchema(dbQuery) {
  const patches = [
    {
      name: 'workspace_connections',
      check: `SELECT 1 FROM information_schema.tables WHERE table_name='workspace_connections'`,
      apply: [
        `CREATE TABLE IF NOT EXISTS workspace_connections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          connection_id UUID NOT NULL REFERENCES snowflake_connections(id) ON DELETE CASCADE,
          warehouse VARCHAR(255),
          role VARCHAR(255),
          added_by UUID REFERENCES users(id),
          added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_workspace_connection UNIQUE (workspace_id, connection_id)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_workspace_connections_ws ON workspace_connections(workspace_id)`,
      ],
    },
    {
      name: 'users.default_workspace_id',
      check: `SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='default_workspace_id'`,
      apply: [
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS default_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL`,
      ],
    },
    {
      name: 'workspace_semantic_views.workspace_connection_id',
      check: `SELECT 1 FROM information_schema.columns WHERE table_name='workspace_semantic_views' AND column_name='workspace_connection_id'`,
      apply: [
        `ALTER TABLE workspace_semantic_views ADD COLUMN workspace_connection_id UUID REFERENCES workspace_connections(id) ON DELETE CASCADE`,
        `ALTER TABLE workspace_semantic_views DROP CONSTRAINT IF EXISTS unique_ws_semantic_view`,
        `ALTER TABLE workspace_semantic_views ADD CONSTRAINT unique_ws_conn_semantic_view UNIQUE (workspace_id, workspace_connection_id, semantic_view_fqn)`,
        `CREATE INDEX IF NOT EXISTS idx_ws_semantic_views_conn ON workspace_semantic_views(workspace_connection_id)`,
      ],
    },
    {
      name: 'workspace_agents.workspace_connection_id',
      check: `SELECT 1 FROM information_schema.columns WHERE table_name='workspace_agents' AND column_name='workspace_connection_id'`,
      apply: [
        `ALTER TABLE workspace_agents ADD COLUMN workspace_connection_id UUID REFERENCES workspace_connections(id) ON DELETE CASCADE`,
        `ALTER TABLE workspace_agents DROP CONSTRAINT IF EXISTS unique_ws_agent`,
        `ALTER TABLE workspace_agents ADD CONSTRAINT unique_ws_conn_agent UNIQUE (workspace_id, workspace_connection_id, agent_fqn)`,
        `CREATE INDEX IF NOT EXISTS idx_ws_agents_conn ON workspace_agents(workspace_connection_id)`,
      ],
    },
  ];

  for (const patch of patches) {
    try {
      const exists = await dbQuery(patch.check);
      if (exists.rows.length === 0) {
        for (const sql of patch.apply) {
          await dbQuery(sql);
        }
        console.log(`[schema] Created missing table: ${patch.name}`);
      }
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.warn(`[schema] Patch ${patch.name}: ${err.message}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function startServer() {
  const isConfigured = configStore.initialize();

  if (isConfigured) {
    try {
      const { validateKeyConfigured } = await import('./utils/encryption.js');
      validateKeyConfigured();
    } catch (err) {
      console.error('FATAL:', err.message);
      process.exit(1);
    }

    try {
      const { init: initDb, test: testDb, metadataBackend } = await import('./db/db.js');
      console.log(`Initializing ${metadataBackend} metadata backend...`);
      await initDb();
      const dbConnected = await testDb();
      if (dbConnected) {
        console.log(`${metadataBackend} metadata connection established`);

        // Auto-apply lightweight schema patches for new tables/columns
        try {
          const { query: dbQuery } = await import('./db/db.js');
          await ensureLatestSchema(dbQuery);
        } catch (schemaErr) {
          console.warn('Schema patch warning:', schemaErr.message);
        }

        try {
          const userService = (await import('./services/userService.js')).default;
          await userService.clearAllActiveSessions();
        } catch (sessionErr) {
          console.warn('Could not clear active sessions:', sessionErr.message);
        }
      } else {
        console.warn(`${metadataBackend} connection test failed - some features may not work`);
      }
    } catch (dbErr) {
      console.warn('Database connection failed:', dbErr.message);
      console.warn('App will start but metadata features require a database');
    }

    await mountNormalRoutes();
    initHotReload();
  } else {
    console.log('[server] Running in SETUP MODE — sign in with: admin / admin123');

    configStore.on('change', async () => {
      if (configStore.isConfigured() && !normalRoutesLoaded) {
        console.log('[server] Setup complete — loading normal-mode routes...');
        await new Promise(r => setTimeout(r, 500));

        try {
          const { init: initDb, test: testDb } = await import('./db/db.js');
          await initDb();
          const ok = await testDb();
          if (ok) {
            console.log('[server] Database connection verified after setup');
            try {
              const userService = (await import('./services/userService.js')).default;
              await userService.clearAllActiveSessions();
            } catch (_) {}
          }
        } catch (err) {
          console.warn('[server] DB init after setup:', err.message);
        }
        await mountNormalRoutes();
        initHotReload();
      }
    });
  }

  const PORT = configStore.get('PORT') || process.env.PORT || 3001;
  const server = app.listen(PORT, () => {
    console.log(`Simply Analytics API Server running on port ${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
    if (!isConfigured) {
      console.log(`Open the app and sign in with: admin / admin123`);
    }
  });

  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}

startServer();

export default app;
