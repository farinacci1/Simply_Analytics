import { Router } from 'express';
import os from 'os';
import configStore, { SECTION_KEYS } from '../config/configStore.js';

const router = Router();

/** Only the owner role may access admin routes. */
function ownerGuard(req, res, next) {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
}

router.use(ownerGuard);

// ---------------------------------------------------------------------------
// GET /api/v1/admin/config
// ---------------------------------------------------------------------------
router.get('/config', (_req, res) => {
  res.json(configStore.toSafeObject());
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/config/:section  (raw values for editing)
// ---------------------------------------------------------------------------
router.get('/config/:section', (req, res) => {
  const { section } = req.params;
  if (!SECTION_KEYS[section]) {
    return res.status(400).json({ error: `Unknown section: ${section}` });
  }
  res.json(configStore.getRawSection(section));
});

// ---------------------------------------------------------------------------
// PUT /api/v1/admin/config/:section
// ---------------------------------------------------------------------------
router.put('/config/:section', async (req, res) => {
  const { section } = req.params;
  if (!SECTION_KEYS[section]) {
    return res.status(400).json({ error: `Unknown section: ${section}` });
  }

  if (section === 'security' && req.body.PASSWORD_MIN_LENGTH !== undefined) {
    const len = parseInt(req.body.PASSWORD_MIN_LENGTH, 10);
    if (isNaN(len) || len < 8) {
      return res.status(400).json({ error: 'Password minimum length cannot be less than 8 characters' });
    }
    req.body.PASSWORD_MIN_LENGTH = String(len);
  }

  // For database section: verify connection works before persisting credential changes
  if (section === 'database') {
    const backend = configStore.get('METADATA_BACKEND') || 'postgres';
    if (backend === 'postgres') {
      const testUser = req.body.POSTGRES_USER || configStore.get('POSTGRES_USER');
      const testPass = (req.body.POSTGRES_PASSWORD && req.body.POSTGRES_PASSWORD !== '••••••••')
        ? req.body.POSTGRES_PASSWORD
        : configStore.get('POSTGRES_PASSWORD');

      const pg = await import('pg');
      const { Pool } = pg.default || pg;
      const pool = new Pool({
        host: configStore.get('POSTGRES_HOST'),
        port: parseInt(configStore.get('POSTGRES_PORT') || '5432'),
        database: configStore.get('POSTGRES_DB'),
        user: testUser,
        password: testPass,
        connectionTimeoutMillis: 5000,
      });

      try {
        const check = await pool.query(
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') as ok`
        );
        await pool.end();
        if (!check.rows[0]?.ok) {
          return res.status(400).json({ error: 'Connection succeeded but required tables are not accessible with these credentials.' });
        }
      } catch (err) {
        try { await pool.end(); } catch (_) {}
        return res.status(400).json({ error: `Cannot connect with new credentials: ${err.message}. Config was NOT saved.` });
      }
    }
  }

  try {
    const changedKeys = await configStore.update(section, req.body);
    res.json({ success: true, changedKeys });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/test-connection
// ---------------------------------------------------------------------------
router.post('/test-connection', async (req, res) => {
  const { type } = req.body; // 'database' or 'redis'

  if (type === 'database') {
    const backend = configStore.get('METADATA_BACKEND') || 'postgres';

    if (backend === 'postgres') {
      const pg = await import('pg');
      const { Pool } = pg.default || pg;
      const pool = new Pool({
        host: req.body.host || configStore.get('POSTGRES_HOST'),
        port: parseInt(req.body.port || configStore.get('POSTGRES_PORT') || '5432'),
        database: req.body.database || configStore.get('POSTGRES_DB'),
        user: req.body.user || configStore.get('POSTGRES_USER'),
        password: req.body.password || configStore.get('POSTGRES_PASSWORD'),
        connectionTimeoutMillis: 5000,
      });

      try {
        const result = await pool.query('SELECT NOW() as now');
        await pool.end();
        return res.json({ success: true, message: `Connected at ${result.rows[0].now}` });
      } catch (err) {
        try { await pool.end(); } catch (_) {}
        return res.json({ success: false, message: err.message });
      }
    }

    return res.json({ success: false, message: 'Snowflake test-connection via admin not yet implemented' });
  }

  if (type === 'redis') {
    const url = req.body.redisUrl || configStore.get('REDIS_URL') || 'redis://localhost:6379';
    let client;
    try {
      const Redis = (await import('ioredis')).default;
      client = new Redis(url, {
        maxRetriesPerRequest: 0,
        connectTimeout: 5000,
        lazyConnect: true,
        retryStrategy: () => null,
      });
      client.on('error', () => {});
      await client.connect();
      await client.ping();
      await client.quit();
      return res.json({ success: true, message: 'Redis OK' });
    } catch (err) {
      if (client) {
        try { client.disconnect(false); } catch (_) {}
      }
      return res.json({ success: false, message: err.message });
    }
  }

  res.status(400).json({ error: 'type must be "database" or "redis"' });
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/migrate  (SSE)
// ---------------------------------------------------------------------------
router.post('/migrate', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const backend = configStore.get('METADATA_BACKEND') || 'postgres';
    const { runPostgresMigration, runSnowflakeMigration } = await import('../services/migrationRunner.js');

    let result;
    if (backend === 'postgres') {
      result = await runPostgresMigration(
        {
          host: configStore.get('POSTGRES_HOST'),
          port: configStore.get('POSTGRES_PORT'),
          database: configStore.get('POSTGRES_DB'),
          user: configStore.get('POSTGRES_USER'),
          password: configStore.get('POSTGRES_PASSWORD'),
        },
        (msg) => send({ type: 'log', message: msg }),
        { skipAdminUser: true }
      );
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
// POST /api/v1/admin/test-migration-target
// ---------------------------------------------------------------------------
router.post('/test-migration-target', async (req, res) => {
  const { testDestination } = await import('../services/dataMigrationService.js');
  try {
    const result = await testDestination(req.body);
    res.json(result);
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/migrate-data  (SSE — streams progress to client)
// ---------------------------------------------------------------------------
router.post('/migrate-data', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const { migrateData } = await import('../services/dataMigrationService.js');

    const result = await migrateData(req.body, (progress) => {
      send({ type: 'progress', ...progress });
    });

    send({ type: 'complete', success: result.success, totalRows: result.totalRows, warnings: result.warnings || [] });
  } catch (err) {
    send({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/switch-backend  (swap config to point to new DB)
// Verifies the destination is reachable and has required tables before switching.
// ---------------------------------------------------------------------------
router.post('/switch-backend', async (req, res) => {
  try {
    // Pre-switch verification: connect and confirm required tables exist
    if (req.body.backend === 'postgres') {
      const pg = await import('pg');
      const { Pool } = pg.default || pg;
      const pool = new Pool({
        host: req.body.host,
        port: parseInt(req.body.port || '5432'),
        database: req.body.database,
        user: req.body.user,
        password: req.body.password,
        connectionTimeoutMillis: 5000,
      });

      try {
        const check = await pool.query(
          `SELECT COUNT(*) as cnt FROM information_schema.tables
           WHERE table_name IN ('users', 'dashboards', 'snowflake_connections', 'user_groups')`
        );
        await pool.end();
        const tableCount = parseInt(check.rows[0].cnt);
        if (tableCount < 4) {
          return res.status(400).json({
            success: false,
            message: `Destination only has ${tableCount}/4 required core tables. Migration may not have completed successfully. Switch aborted.`,
          });
        }
      } catch (err) {
        try { await pool.end(); } catch (_) {}
        return res.status(400).json({
          success: false,
          message: `Cannot verify destination database: ${err.message}. Switch aborted — current database is unchanged.`,
        });
      }
    } else if (req.body.backend === 'snowflake') {
      const { createSnowflakeDestConnection } = await import('../services/migrationRunner.js');
      let dest;
      try {
        dest = await createSnowflakeDestConnection(req.body);
        const result = await dest.query(`SHOW TABLES`);
        const tableNames = new Set(result.rows.map(r => (r.name || '').toUpperCase()));
        const required = ['USERS', 'DASHBOARDS', 'SNOWFLAKE_CONNECTIONS', 'USER_GROUPS'];
        const found = required.filter(t => tableNames.has(t));
        dest.destroy();

        if (found.length < required.length) {
          const missing = required.filter(t => !tableNames.has(t));
          return res.status(400).json({
            success: false,
            message: `Destination is missing required tables: ${missing.join(', ')}. Migration may not have completed successfully. Switch aborted.`,
          });
        }
      } catch (err) {
        if (dest) dest.destroy();
        return res.status(400).json({
          success: false,
          message: `Cannot verify destination Snowflake: ${err.message}. Switch aborted — current database is unchanged.`,
        });
      }
    }

    await configStore.switchBackend(req.body);
    res.json({ success: true, message: 'Backend switched successfully. The server is now using the new database.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/rotate-key/:keyType
// ---------------------------------------------------------------------------
router.post('/rotate-key/:keyType', async (req, res) => {
  const { keyType } = req.params;
  const crypto = await import('crypto');

  if (keyType === 'jwt') {
    const newSecret = crypto.randomBytes(64).toString('hex');
    await configStore.update('security', { JWT_SECRET: newSecret });
    return res.json({ success: true, message: 'JWT secret rotated — all users will be signed out' });
  }

  if (keyType === 'encryption') {
    const oldKey = configStore.get('CREDENTIALS_ENCRYPTION_KEY');
    const newKeyHex = crypto.randomBytes(32).toString('hex');

    // Re-encrypt stored credentials with the new key
    try {
      const backend = configStore.get('METADATA_BACKEND') || 'postgres';
      if (backend === 'postgres') {
        const encMod = await import('../utils/encryption.js');
        const pg = await import('pg');
        const { Pool } = pg.default || pg;
        const pool = new Pool({
          host: configStore.get('POSTGRES_HOST'),
          port: parseInt(configStore.get('POSTGRES_PORT') || '5432'),
          database: configStore.get('POSTGRES_DB'),
          user: configStore.get('POSTGRES_USER'),
          password: configStore.get('POSTGRES_PASSWORD'),
        });

        const { rows } = await pool.query('SELECT id, credentials_encrypted FROM snowflake_connections WHERE credentials_encrypted IS NOT NULL');
        const oldKeyBuf = Buffer.from(oldKey, 'hex');
        const newKeyBuf = Buffer.from(newKeyHex, 'hex');

        let reEncrypted = 0;
        for (const row of rows) {
          try {
            const plain = encMod.decryptWithKey(row.credentials_encrypted, oldKeyBuf);
            const cipher = encMod.encryptWithKey(plain, newKeyBuf);
            await pool.query('UPDATE snowflake_connections SET credentials_encrypted = $1 WHERE id = $2', [cipher, row.id]);
            reEncrypted++;
          } catch (e) {
            console.error(`[admin] Re-encrypt failed for connection ${row.id}:`, e.message);
          }
        }
        await pool.end();

        await configStore.update('security', { CREDENTIALS_ENCRYPTION_KEY: newKeyHex });
        return res.json({ success: true, message: `Encryption key rotated — ${reEncrypted} credentials re-encrypted` });
      }

      await configStore.update('security', { CREDENTIALS_ENCRYPTION_KEY: newKeyHex });
      return res.json({ success: true, message: 'Encryption key rotated' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(400).json({ error: 'keyType must be "jwt" or "encryption"' });
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/system
// ---------------------------------------------------------------------------
router.get('/system', async (_req, res) => {
  const { getActiveSessionCount } = await import('../middleware/auth.js');

  res.json({
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    memoryUsage: process.memoryUsage(),
    metadataBackend: configStore.get('METADATA_BACKEND') || 'postgres',
    activeSessions: getActiveSessionCount(),
    sessionTimeoutMinutes: parseInt(configStore.get('SESSION_TIMEOUT_MINUTES') || '20', 10),
    serverTime: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/master-key/verify
// ---------------------------------------------------------------------------
router.post('/master-key/verify', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });
  const match = configStore.verifyMasterKey(key);
  res.json({ match });
});

export const adminRoutes = router;
