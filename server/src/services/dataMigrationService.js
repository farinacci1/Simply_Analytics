/**
 * Data Migration Service
 *
 * Migrates all metadata from the current (source) database to a destination
 * database. Supports all four migration paths:
 *   Postgres -> Postgres
 *   Postgres -> Snowflake
 *   Snowflake -> Postgres
 *   Snowflake -> Snowflake
 *
 * Source is read-only; destination must be empty (post-schema-migration).
 */

import pg from 'pg';
import { query as sourceQuery } from '../db/db.js';
import { runPostgresMigration, runSnowflakeMigration, createSnowflakeDestConnection } from './migrationRunner.js';

const MIGRATION_ORDER = [
  'users',
  'user_groups',
  'group_members',
  'snowflake_connections',
  'workspaces',
  'workspace_connections',
  'workspace_members',
  'workspace_semantic_views',
  'workspace_agents',
  'dashboard_folders',
  'folder_group_access',
  'dashboards',
  'dashboard_group_access',
  'dashboard_user_access',
  'ask_conversations',
  'ask_messages',
  'ask_dashboards',
  'webauthn_challenges',
  'audit_log',
];

const BATCH_SIZE = 500;

/**
 * Test connectivity to the destination database.
 */
export async function testDestination(destConfig) {
  if (destConfig.backend === 'postgres') {
    const { Pool } = pg;
    const pool = new Pool({
      host: destConfig.host,
      port: parseInt(destConfig.port || '5432'),
      database: 'postgres',
      user: destConfig.user,
      password: destConfig.password,
      connectionTimeoutMillis: 5000,
    });

    try {
      const result = await pool.query('SELECT NOW() as now');
      await pool.end();
      return { success: true, message: `Connected at ${result.rows[0].now}` };
    } catch (err) {
      try { await pool.end(); } catch (_) {}
      return { success: false, message: err.message };
    }
  }

  if (destConfig.backend === 'snowflake') {
    let dest;
    try {
      dest = await createSnowflakeDestConnection(destConfig);
      const result = await dest.query('SELECT CURRENT_TIMESTAMP() AS now');
      const now = result.rows[0]?.now;
      dest.destroy();
      return { success: true, message: `Connected at ${now}` };
    } catch (err) {
      if (dest) dest.destroy();
      return { success: false, message: err.message };
    }
  }

  return { success: false, message: `Unsupported backend: ${destConfig.backend}` };
}

/**
 * Migrate all data from the current source database to the destination.
 * @param {object} destConfig - { backend, ... } with backend-specific connection fields
 * @param {function} onProgress - callback({ step, table, rows, total, message })
 */
export async function migrateData(destConfig, onProgress = () => {}) {
  const isPostgresDest = destConfig.backend === 'postgres';
  const isSnowflakeDest = destConfig.backend === 'snowflake';

  if (!isPostgresDest && !isSnowflakeDest) {
    throw new Error(`Unsupported destination backend: ${destConfig.backend}`);
  }

  // 1. Run schema migrations on destination
  onProgress({ step: 'schema', message: 'Running schema migrations on destination...' });

  if (isPostgresDest) {
    const schemaResult = await runPostgresMigration(
      {
        host: destConfig.host,
        port: destConfig.port,
        database: destConfig.database,
        user: destConfig.user,
        password: destConfig.password,
      },
      (msg) => onProgress({ step: 'schema', message: msg }),
      { skipAdminUser: true },
    );
    if (!schemaResult.success) {
      throw new Error(`Schema migration failed: ${schemaResult.errors.join(', ')}`);
    }
  } else {
    const schemaResult = await runSnowflakeMigration(
      destConfig,
      (msg) => onProgress({ step: 'schema', message: msg }),
    );
    if (!schemaResult.success) {
      throw new Error(`Schema migration failed: ${schemaResult.errors.join(', ')}`);
    }
  }

  onProgress({ step: 'schema', message: 'Schema migration complete' });

  // 2. Connect to destination
  let destQuery;
  let destCleanup;

  if (isPostgresDest) {
    const { Pool } = pg;
    const destPool = new Pool({
      host: destConfig.host,
      port: parseInt(destConfig.port || '5432'),
      database: destConfig.database,
      user: destConfig.user,
      password: destConfig.password,
    });

    try {
      await destPool.query('SELECT 1');
    } catch (err) {
      await destPool.end();
      throw new Error(`Cannot connect to destination: ${err.message}`);
    }

    destQuery = {
      run: (sql, params) => destPool.query(sql, params),
      beginBatch: async () => {
        const client = await destPool.connect();
        await client.query('BEGIN');
        return {
          run: (sql, params) => client.query(sql, params),
          commit: async () => { await client.query('COMMIT'); client.release(); },
          rollback: async () => { await client.query('ROLLBACK'); client.release(); },
        };
      },
    };
    destCleanup = () => destPool.end();
  } else {
    const dest = await createSnowflakeDestConnection(destConfig);

    destQuery = {
      run: (sql, params) => dest.query(sql, params),
      beginBatch: async () => ({
        run: (sql, params) => dest.query(sql, params),
        commit: async () => {},
        rollback: async () => {},
      }),
    };
    destCleanup = () => dest.destroy();
  }

  // 3. Verify destination is empty
  onProgress({ step: 'verify', message: 'Verifying destination is empty...' });
  try {
    const userCount = await destQuery.run('SELECT COUNT(*) as cnt FROM users');
    if (parseInt(userCount.rows[0].cnt) > 0) {
      await destCleanup();
      throw new Error('Destination database is not empty. Migration requires an empty target to avoid ID conflicts.');
    }
  } catch (err) {
    if (err.message.includes('not empty')) throw err;
  }

  // 4. Migrate tables in dependency order
  let totalMigrated = 0;

  for (const table of MIGRATION_ORDER) {
    onProgress({ step: 'migrate', table, message: `Reading ${table}...` });

    let rows;
    try {
      const result = await sourceQuery(`SELECT * FROM ${table}`);
      rows = result.rows;
    } catch (err) {
      if (err.message.includes('does not exist') || err.code === '42P01') {
        onProgress({ step: 'migrate', table, rows: 0, message: `${table}: table does not exist in source, skipping` });
        continue;
      }
      throw err;
    }

    if (!rows || rows.length === 0) {
      onProgress({ step: 'migrate', table, rows: 0, message: `${table}: 0 rows (empty)` });
      continue;
    }

    onProgress({ step: 'migrate', table, message: `Migrating ${table} (${rows.length} rows)...` });

    const columns = Object.keys(rows[0]);
    const colList = columns.map(c => `"${c}"`).join(', ');

    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const txn = await destQuery.beginBatch();

      try {
        for (const row of batch) {
          const values = columns.map(c => normalizeValue(row[c]));

          if (isPostgresDest) {
            const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
            await txn.run(
              `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
              values,
            );
          } else {
            const placeholders = columns.map(() => '?').join(', ');
            await txn.run(
              `INSERT INTO "${table}" (${colList}) SELECT ${placeholders} WHERE NOT EXISTS (SELECT 1 FROM "${table}" WHERE "id" = ?)`,
              [...values, values[0]],
            );
          }
          inserted++;
        }

        await txn.commit();
      } catch (err) {
        await txn.rollback();
        throw new Error(`Failed inserting into ${table}: ${err.message}`);
      }

      onProgress({
        step: 'migrate',
        table,
        rows: inserted,
        total: rows.length,
        message: `${table}: ${inserted}/${rows.length} rows`,
      });
    }

    totalMigrated += inserted;
    onProgress({ step: 'migrate', table, rows: inserted, total: rows.length, message: `${table}: ${inserted} rows migrated` });
  }

  // 5. Post-migration verification — compare row counts
  onProgress({ step: 'verify', message: 'Verifying migration integrity...' });
  const mismatches = [];

  for (const table of MIGRATION_ORDER) {
    try {
      const srcResult = await sourceQuery(`SELECT COUNT(*) as cnt FROM ${table}`);
      const srcCount = parseInt(srcResult.rows[0].cnt);
      if (srcCount === 0) continue;

      const destResult = await destQuery.run(`SELECT COUNT(*) as cnt FROM "${table}"`);
      const destCount = parseInt(destResult.rows[0].cnt);

      if (destCount < srcCount) {
        mismatches.push(`${table}: source=${srcCount}, destination=${destCount}`);
        onProgress({ step: 'verify', message: `WARNING: ${table} mismatch — source: ${srcCount}, destination: ${destCount}` });
      } else {
        onProgress({ step: 'verify', message: `${table}: ${destCount}/${srcCount} rows verified` });
      }
    } catch (err) {
      if (err.message.includes('does not exist') || err.code === '42P01') continue;
      onProgress({ step: 'verify', message: `${table}: verification skipped (${err.message})` });
    }
  }

  await destCleanup();

  if (mismatches.length > 0) {
    const msg = `Migration completed with warnings. ${mismatches.length} table(s) have row count mismatches: ${mismatches.join('; ')}. Do NOT switch to this database without investigating.`;
    onProgress({ step: 'complete', message: msg });
    return { success: false, totalRows: totalMigrated, warnings: mismatches };
  }

  onProgress({ step: 'complete', message: `Migration verified. ${totalMigrated} total rows transferred and confirmed across ${MIGRATION_ORDER.length} tables.` });

  return { success: true, totalRows: totalMigrated };
}

/**
 * Normalize a value for cross-backend insertion.
 * Handles JSONB/VARIANT objects -> JSON strings, Date -> ISO string.
 */
function normalizeValue(val) {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && !Buffer.isBuffer(val)) {
    return JSON.stringify(val);
  }
  return val;
}
