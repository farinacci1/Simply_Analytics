import { Router } from 'express';
import pg from 'pg';
import configStore from '../config/configStore.js';

const router = Router();

// No guard needed — index.js applies setupAuthMiddleware before this router.
// All endpoints here require a valid bootstrap_admin JWT.

// ---------------------------------------------------------------------------
// GET /api/v1/setup/progress
// ---------------------------------------------------------------------------
router.get('/progress', async (_req, res) => {
  try {
    const progress = await configStore.getSetupProgress();
    res.json(progress);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/setup/master-key  (one-time reveal)
// ---------------------------------------------------------------------------
router.get('/master-key', (_req, res) => {
  const key = configStore.getMasterKeyOnce();
  if (!key) {
    return res.json({ revealed: false, message: 'Master key has already been shown' });
  }
  res.json({ revealed: true, masterKey: key });
});

// ---------------------------------------------------------------------------
// POST /api/v1/setup/test-database
// ---------------------------------------------------------------------------
router.post('/test-database', async (req, res) => {
  const { backend, host, port, database, user, password,
    sfAccount, sfUser, sfAuthType, sfPassword, sfPrivateKeyPath,
    sfPrivateKeyPass, sfToken, sfWarehouse, sfDatabase, sfSchema, sfRole } = req.body;

  if (backend === 'postgres') {
    const { Pool } = pg;
    const targetDb = database || 'simply_analytics';

    const pool = new Pool({
      host: host || 'localhost',
      port: parseInt(port || '5432'),
      database: 'postgres',
      user, password,
      connectionTimeoutMillis: 5000,
    });

    try {
      await pool.query('SELECT NOW() as now');

      const dbCheck = await pool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]
      );
      await pool.end();

      const dbExists = dbCheck.rows.length > 0;
      const msg = dbExists
        ? `Connected. Database "${targetDb}" exists.`
        : `Connected. Database "${targetDb}" does not exist yet — it will be created during migrations.`;

      return res.json({ success: true, message: msg, databaseExists: dbExists });
    } catch (err) {
      try { await pool.end(); } catch (_) {}
      return res.json({ success: false, message: err.message });
    }
  }

  if (backend === 'snowflake') {
    try {
      const envBackup = {};
      const envMap = {
        SF_SERVICE_ACCOUNT: sfAccount,
        SF_SERVICE_USER: sfUser,
        SF_SERVICE_AUTH_TYPE: sfAuthType || 'password',
        SF_SERVICE_PASSWORD: sfPassword,
        SF_SERVICE_PRIVATE_KEY_PATH: sfPrivateKeyPath,
        SF_SERVICE_PRIVATE_KEY_PASS: sfPrivateKeyPass,
        SF_SERVICE_TOKEN: sfToken,
        SF_SERVICE_WAREHOUSE: sfWarehouse,
        SF_SERVICE_DATABASE: sfDatabase,
        SF_SERVICE_SCHEMA: sfSchema,
        SF_SERVICE_ROLE: sfRole,
      };
      for (const [k, v] of Object.entries(envMap)) {
        envBackup[k] = process.env[k];
        if (v) process.env[k] = v;
      }

      const sf = await import('../db/snowflakeBackend.js');
      await sf.initServiceConnection();
      const ok = await sf.testConnection();
      await sf.closeConnection();

      for (const [k, v] of Object.entries(envBackup)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }

      return res.json({ success: ok, message: ok ? 'Snowflake connection OK' : 'Connection test failed' });
    } catch (err) {
      return res.json({ success: false, message: err.message });
    }
  }

  res.status(400).json({ error: 'backend must be "postgres" or "snowflake"' });
});

// ---------------------------------------------------------------------------
// POST /api/v1/setup/test-redis
// ---------------------------------------------------------------------------
router.post('/test-redis', async (req, res) => {
  const { redisUrl, disable } = req.body;

  if (disable) {
    return res.json({ success: true, message: 'Redis disabled — using in-memory sessions' });
  }

  let client;
  try {
    const Redis = (await import('ioredis')).default;
    client = new Redis(redisUrl || 'redis://localhost:6379', {
      maxRetriesPerRequest: 0,
      connectTimeout: 5000,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    client.on('error', () => {});
    await client.connect();
    await client.ping();
    await client.quit();
    return res.json({ success: true, message: 'Redis connection OK' });
  } catch (err) {
    if (client) {
      try { client.disconnect(false); } catch (_) {}
    }
    return res.json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/setup/save-config
// ---------------------------------------------------------------------------
router.post('/save-config', async (req, res) => {
  try {
    const { config: values } = req.body;
    if (!values || typeof values !== 'object') {
      return res.status(400).json({ error: 'config object required' });
    }
    await configStore.saveInitialConfig(values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/setup/run-migrations  (SSE stream)
// ---------------------------------------------------------------------------
router.post('/run-migrations', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const backend = configStore.get('METADATA_BACKEND') || 'postgres';
    const { runPostgresMigration, runSnowflakeMigration } = await import('../services/migrationRunner.js');

    let result;
    if (backend === 'postgres') {
      const dbConfig = {
        host: configStore.get('POSTGRES_HOST'),
        port: configStore.get('POSTGRES_PORT'),
        database: configStore.get('POSTGRES_DB'),
        user: configStore.get('POSTGRES_USER'),
        password: configStore.get('POSTGRES_PASSWORD'),
      };
      result = await runPostgresMigration(dbConfig, (msg) => send({ type: 'log', message: msg }), { skipAdminUser: true });
    } else {
      result = await runSnowflakeMigration((msg) => send({ type: 'log', message: msg }));
    }

    send({ type: 'complete', success: result.success, steps: result.steps, errors: result.errors });
  } catch (err) {
    send({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/setup/create-owner
// ---------------------------------------------------------------------------
router.post('/create-owner', async (req, res) => {
  const { username, email, password, displayName } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' });
  }
  const { validatePasswordStrength } = await import('../services/userService.js');
  const passwordErrors = validatePasswordStrength(password);
  if (passwordErrors.length > 0) {
    return res.status(400).json({ error: `Password must have: ${passwordErrors.join(', ')}` });
  }

  try {
    const backend = configStore.get('METADATA_BACKEND') || 'postgres';

    if (backend === 'postgres') {
      const { Pool } = pg;
      const pool = new Pool({
        host: configStore.get('POSTGRES_HOST'),
        port: parseInt(configStore.get('POSTGRES_PORT') || '5432'),
        database: configStore.get('POSTGRES_DB'),
        user: configStore.get('POSTGRES_USER'),
        password: configStore.get('POSTGRES_PASSWORD'),
      });

      try {
        const { createOwnerAccount } = await import('../services/migrationRunner.js');
        const owner = await createOwnerAccount(pool, { username, email, password, displayName });
        await pool.end();
        return res.json({ success: true, user: owner });
      } catch (err) {
        await pool.end();
        return res.status(400).json({ error: err.message });
      }
    }

    // Snowflake path
    const bcryptMod = await import('bcryptjs');
    const cryptoMod = await import('crypto');
    const passwordHash = await bcryptMod.default.hash(password, 10);
    const { query: sfQuery } = await import('../db/snowflakeBackend.js');
    const id = cryptoMod.default.randomUUID();

    await sfQuery(
      `INSERT INTO users (id, username, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, username, email, passwordHash, displayName || username, 'owner']
    );

    return res.json({ success: true, user: { id, username, email, role: 'owner' } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/setup/complete
// ---------------------------------------------------------------------------
router.post('/complete', async (req, res) => {
  try {
    configStore.markConfigured();
    res.json({ success: true, message: 'Setup complete — app is ready' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export const setupRoutes = router;
