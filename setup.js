#!/usr/bin/env node

/**
 * Simply Analytics — Interactive Setup
 *
 * Walks through every credential and config value the platform needs,
 * then writes the correct .env file(s) for local dev and/or Docker Compose.
 *
 * Usage:  node setup.js
 *         npm run setup
 *
 * Navigation:  Type "back" at any prompt to return to the previous section.
 *
 * Zero external dependencies — uses only Node.js built-ins.
 */

import { createInterface } from 'readline';
import { randomBytes } from 'crypto';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const rl = createInterface({ input: process.stdin, output: process.stdout });

const BACK = Symbol('back');

// ── Helpers ──────────────────────────────────────────────────────────────────

function rawAsk(question, fallback = '') {
  const suffix = fallback ? ` [${fallback}]` : '';
  return new Promise((res) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      res(answer.trim());
    });
  });
}

async function ask(question, fallback = '') {
  const raw = await rawAsk(question, fallback);
  if (raw.toLowerCase() === 'back') throw BACK;
  return raw || fallback;
}

async function askRequired(question) {
  let value = '';
  while (!value) {
    value = await ask(question);
    if (!value) console.log('    ↳ This field is required.');
  }
  return value;
}

async function askChoice(question, choices) {
  const labels = choices.join(' / ');
  let value = '';
  while (!choices.includes(value)) {
    const raw = await rawAsk(`${question} (${labels})`);
    if (raw.toLowerCase() === 'back') throw BACK;
    value = raw.toLowerCase();
    if (!choices.includes(value)) {
      console.log(`    ↳ Please enter one of: ${labels}`);
      value = '';
    }
  }
  return value;
}

async function askYesNo(question, fallback = 'n') {
  const answer = await ask(`${question} (y/n)`, fallback);
  return answer.toLowerCase().startsWith('y');
}

function heading(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

function genHex(bytes) {
  return randomBytes(bytes).toString('hex');
}

function buildEnvString(vars) {
  let out = '';
  for (const entry of vars) {
    if (entry.comment) {
      out += `\n# ${entry.comment}\n`;
    }
    if (entry.key) {
      out += `${entry.key}=${entry.value}\n`;
    }
  }
  return out.trimStart();
}

async function safeWriteFile(filePath, content, description) {
  if (existsSync(filePath)) {
    console.log(`\n  ${description} already exists at ${filePath}`);
    const overwrite = await askYesNo('  Overwrite?', 'n');
    if (!overwrite) {
      console.log('  Skipped.');
      return false;
    }
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
  console.log(`  ✓ Wrote ${filePath}`);
  return true;
}

// ── Step definitions ─────────────────────────────────────────────────────────
// Each step receives the shared state object `s`, prompts the user, writes
// values back into `s`, and returns. If the user types "back", the BACK symbol
// propagates up and the runner decrements the step index.

async function stepDeploymentMode(s) {
  heading('1. Deployment Mode');
  console.log('  Type "back" at any prompt to return to the previous section.\n');
  s.mode = await askChoice('How will you run the app?', ['local', 'docker', 'both']);
  s.isDocker = s.mode === 'docker' || s.mode === 'both';
  s.isLocal = s.mode === 'local' || s.mode === 'both';
}

async function stepServer(s) {
  heading('2. Server');
  s.nodeEnv = s.isDocker && !s.isLocal
    ? 'production'
    : await ask('NODE_ENV', s.nodeEnv || 'development');
  s.port = await ask('PORT', s.port || '3001');

  const defaultCors = s.isDocker
    ? 'http://localhost'
    : 'http://localhost:5173,http://localhost:3000';
  s.corsOrigins = await ask('CORS_ORIGINS (comma-separated)', s.corsOrigins || defaultCors);
  s.defaultCors = defaultCors;

  const defaultFrontend = s.isDocker ? 'http://localhost' : 'http://localhost:5173';
  s.frontendUrl = await ask('FRONTEND_URL', s.frontendUrl || defaultFrontend);
  s.rateLimitMax = await ask('RATE_LIMIT_MAX (requests per 15 min)', s.rateLimitMax || '1000');
}

async function stepSecrets(s) {
  heading('3. Security Secrets');
  console.log('  Cryptographic secrets will be auto-generated for you.\n');

  if (!s.jwtSecret) s.jwtSecret = genHex(64);
  console.log(`  JWT_SECRET       = ${s.jwtSecret.slice(0, 16)}...  (auto-generated)`);

  if (!s.encryptionKey) s.encryptionKey = genHex(32);
  console.log(`  ENCRYPTION_KEY   = ${s.encryptionKey.slice(0, 16)}...  (auto-generated)`);

  s.jwtExpiry = await ask('JWT_EXPIRY', s.jwtExpiry || '8h');
  s.sessionTimeout = await ask('SESSION_TIMEOUT_MINUTES', s.sessionTimeout || '20');
}

async function stepMetadataBackend(s) {
  heading('4. Metadata Backend');
  s.metadataBackend = await askChoice('METADATA_BACKEND', ['postgres', 'snowflake']);
}

async function stepPostgres(s) {
  if (s.metadataBackend !== 'postgres') {
    console.log('\n  Skipping PostgreSQL (metadata backend is Snowflake).');
    return;
  }
  heading('5. PostgreSQL');

  const defaultHost = s.isDocker ? 'postgres' : 'localhost';
  s.pgHost = await ask('POSTGRES_HOST', s.pgHost || defaultHost);
  s.pgPort = await ask('POSTGRES_PORT', s.pgPort || '5432');
  s.pgDb = await ask('POSTGRES_DB', s.pgDb || 'simply_analytics');
  s.pgUser = await ask('POSTGRES_USER', s.pgUser || 'simply');
  s.pgPassword = await askRequired('POSTGRES_PASSWORD');
  if (s.pgPassword.length < 8) {
    console.log('    ⚠  Consider using a password of at least 8 characters.');
  }
}

async function stepSnowflake(s) {
  heading('6. Snowflake Service Account');
  console.log('  Used for data queries and (optionally) metadata storage.\n');

  s.sfAuthType = await askChoice(
    'SF_SERVICE_AUTH_TYPE',
    ['password', 'keypair', 'pat'],
  );
  s.sfAccount = await askRequired('SF_SERVICE_ACCOUNT');
  s.sfUser = await askRequired('SF_SERVICE_USER');

  if (s.sfAuthType === 'password') {
    s.sfPassword = await askRequired('SF_SERVICE_PASSWORD');
  } else if (s.sfAuthType === 'keypair') {
    s.sfKeyPath = await ask('SF_SERVICE_PRIVATE_KEY_PATH', s.sfKeyPath || './keys/rsa_key.p8');
    s.sfKeyPass = await ask('SF_SERVICE_PRIVATE_KEY_PASS', s.sfKeyPass || '');
  } else {
    s.sfToken = await askRequired('SF_SERVICE_TOKEN');
  }

  s.sfRole = await ask('SF_SERVICE_ROLE', s.sfRole || 'SIMPLY_SVC_ROLE');
  s.sfWarehouse = await ask('SF_SERVICE_WAREHOUSE', s.sfWarehouse || 'SIMPLY_WH');
  s.sfDatabase = await ask('SF_SERVICE_DATABASE', s.sfDatabase || 'SIMPLY_ANALYTICS');
  s.sfSchema = await ask('SF_SERVICE_SCHEMA', s.sfSchema || 'APP');
  s.sfInsecure = await ask('SNOWFLAKE_INSECURE_CONNECT', s.sfInsecure || 'false');
}

async function stepSnowflakeOAuth(s) {
  heading('7. Snowflake OAuth (optional)');
  s.useOAuth = await askYesNo(
    'Do you use Snowflake OAuth for end-user login?',
    s.useOAuth ? 'y' : 'n',
  );

  if (s.useOAuth) {
    s.oauthAccount = await ask('SNOWFLAKE_ACCOUNT', s.oauthAccount || s.sfAccount);
    s.oauthClientId = await askRequired('SNOWFLAKE_OAUTH_CLIENT_ID');
    s.oauthClientSecret = await askRequired('SNOWFLAKE_OAUTH_CLIENT_SECRET');
    const defaultRedirect = `http://localhost:${s.port}/api/auth/callback`;
    s.oauthRedirectUri = await ask(
      'SNOWFLAKE_OAUTH_REDIRECT_URI',
      s.oauthRedirectUri || defaultRedirect,
    );
  }
}

async function stepRedis(s) {
  heading('8. Redis Sessions');

  if (s.isDocker) {
    console.log('  Docker Compose provides Redis automatically.\n');
    s.redisUrl = await ask('REDIS_URL', s.redisUrl || 'redis://redis:6379');
    s.disableRedis = 'false';
  } else {
    const useRedis = await askYesNo(
      'Enable Redis for sessions? (requires a running Redis instance)',
      s.disableRedis === 'false' ? 'y' : 'n',
    );
    if (useRedis) {
      s.redisUrl = await ask('REDIS_URL', s.redisUrl || 'redis://localhost:6379');
      s.disableRedis = 'false';
    } else {
      s.redisUrl = s.redisUrl || 'redis://localhost:6379';
      s.disableRedis = 'true';
      console.log('  Sessions will use in-memory storage (single-server only).');
    }
  }
  s.redisPrefix = await ask('REDIS_SESSION_PREFIX', s.redisPrefix || 'simply:session:');
  s.sessionTtl = await ask('SESSION_TTL_SECONDS', s.sessionTtl || '28800');
}

async function stepSso(s) {
  heading('9. SSO / SAML / SCIM (optional)');
  s.useSso = await askYesNo('Configure SAML SSO?', s.useSso ? 'y' : 'n');

  if (s.useSso) {
    s.ssoEnabled = 'true';
    s.samlEntrypoint = await askRequired('SAML_ENTRYPOINT (IdP SSO URL)');
    s.samlIssuer = await ask('SAML_ISSUER', s.samlIssuer || 'simply-analytics');
    s.samlCert = await ask('SAML_CERT (base64 IdP signing cert, or leave blank)', s.samlCert || '');
    const defaultCallback = `${s.frontendUrl.replace(/\/$/, '')}/api/saml/callback`;
    s.samlCallback = await ask('SAML_CALLBACK_URL', s.samlCallback || defaultCallback);

    s.useScim = await askYesNo('Enable SCIM user provisioning?', s.useScim ? 'y' : 'n');
    if (s.useScim) {
      s.scimEnabled = 'true';
      s.scimToken = await askRequired('SCIM_BEARER_TOKEN');
    } else {
      s.scimEnabled = 'false';
    }
  } else {
    s.ssoEnabled = 'false';
    s.scimEnabled = 'false';
  }
}

async function stepWebauthn(s) {
  heading('10. WebAuthn / MFA (optional)');
  s.useWebauthn = await askYesNo('Configure WebAuthn (passkeys)?', s.useWebauthn ? 'y' : 'n');

  if (s.useWebauthn) {
    s.appName = await ask('APP_NAME', s.appName || 'Simply Analytics');
    s.rpId = await ask('WEBAUTHN_RP_ID (domain, e.g. localhost)', s.rpId || 'localhost');
    s.rpOrigin = await ask('WEBAUTHN_ORIGIN', s.rpOrigin || s.frontendUrl);
  }
}

async function stepDebug(s) {
  heading('11. Debug Flags (optional)');
  const enableDebug = await askYesNo(
    'Enable verbose / debug logging?',
    s.verboseLogs === 'true' ? 'y' : 'n',
  );
  s.verboseLogs = enableDebug ? 'true' : 'false';
  s.semanticDebug = enableDebug ? 'true' : 'false';
  s.viteDebug = enableDebug ? 'true' : 'false';
}

// ── File writing (not a navigable step) ──────────────────────────────────────

async function writeFiles(s) {
  heading('Writing configuration files');

  const serverVars = [
    { comment: 'Server' },
    { key: 'NODE_ENV', value: s.nodeEnv },
    { key: 'PORT', value: s.port },
    { key: 'CORS_ORIGINS', value: s.corsOrigins },
    { key: 'FRONTEND_URL', value: s.frontendUrl },
    { key: 'RATE_LIMIT_MAX', value: s.rateLimitMax },

    { comment: 'Security' },
    { key: 'JWT_SECRET', value: s.jwtSecret },
    { key: 'JWT_EXPIRY', value: s.jwtExpiry },
    { key: 'CREDENTIALS_ENCRYPTION_KEY', value: s.encryptionKey },
    { key: 'SESSION_TIMEOUT_MINUTES', value: s.sessionTimeout },

    { comment: 'Metadata Backend' },
    { key: 'METADATA_BACKEND', value: s.metadataBackend },
  ];

  if (s.metadataBackend === 'postgres') {
    serverVars.push(
      { comment: 'PostgreSQL' },
      { key: 'POSTGRES_HOST', value: s.pgHost },
      { key: 'POSTGRES_PORT', value: s.pgPort },
      { key: 'POSTGRES_DB', value: s.pgDb },
      { key: 'POSTGRES_USER', value: s.pgUser },
      { key: 'POSTGRES_PASSWORD', value: s.pgPassword },
    );
  }

  serverVars.push(
    { comment: 'Snowflake Service Account' },
    { key: 'SF_SERVICE_AUTH_TYPE', value: s.sfAuthType },
    { key: 'SF_SERVICE_ACCOUNT', value: s.sfAccount },
    { key: 'SF_SERVICE_USER', value: s.sfUser },
  );

  if (s.sfAuthType === 'password') {
    serverVars.push({ key: 'SF_SERVICE_PASSWORD', value: s.sfPassword });
  } else if (s.sfAuthType === 'keypair') {
    serverVars.push(
      { key: 'SF_SERVICE_PRIVATE_KEY_PATH', value: s.sfKeyPath },
      { key: 'SF_SERVICE_PRIVATE_KEY_PASS', value: s.sfKeyPass },
    );
  } else {
    serverVars.push({ key: 'SF_SERVICE_TOKEN', value: s.sfToken });
  }

  serverVars.push(
    { key: 'SF_SERVICE_ROLE', value: s.sfRole },
    { key: 'SF_SERVICE_WAREHOUSE', value: s.sfWarehouse },
    { key: 'SF_SERVICE_DATABASE', value: s.sfDatabase },
    { key: 'SF_SERVICE_SCHEMA', value: s.sfSchema },
    { key: 'SNOWFLAKE_INSECURE_CONNECT', value: s.sfInsecure },
  );

  if (s.useOAuth) {
    serverVars.push(
      { comment: 'Snowflake OAuth' },
      { key: 'SNOWFLAKE_ACCOUNT', value: s.oauthAccount },
      { key: 'SNOWFLAKE_OAUTH_CLIENT_ID', value: s.oauthClientId },
      { key: 'SNOWFLAKE_OAUTH_CLIENT_SECRET', value: s.oauthClientSecret },
      { key: 'SNOWFLAKE_OAUTH_REDIRECT_URI', value: s.oauthRedirectUri },
    );
  }

  serverVars.push(
    { comment: 'Redis' },
    { key: 'REDIS_URL', value: s.redisUrl },
    { key: 'DISABLE_REDIS', value: s.disableRedis },
    { key: 'REDIS_SESSION_PREFIX', value: s.redisPrefix },
    { key: 'SESSION_TTL_SECONDS', value: s.sessionTtl },
  );

  if (s.useSso) {
    serverVars.push(
      { comment: 'SSO / SAML' },
      { key: 'SSO_ENABLED', value: s.ssoEnabled },
      { key: 'SAML_ENTRYPOINT', value: s.samlEntrypoint },
      { key: 'SAML_ISSUER', value: s.samlIssuer },
      { key: 'SAML_CERT', value: s.samlCert },
      { key: 'SAML_CALLBACK_URL', value: s.samlCallback },
    );
    if (s.scimEnabled === 'true') {
      serverVars.push(
        { comment: 'SCIM Provisioning' },
        { key: 'SCIM_ENABLED', value: s.scimEnabled },
        { key: 'SCIM_BEARER_TOKEN', value: s.scimToken },
      );
    }
  }

  if (s.useWebauthn) {
    serverVars.push(
      { comment: 'WebAuthn / Passkeys' },
      { key: 'APP_NAME', value: s.appName },
      { key: 'WEBAUTHN_RP_ID', value: s.rpId },
      { key: 'WEBAUTHN_ORIGIN', value: s.rpOrigin },
    );
  }

  serverVars.push(
    { comment: 'Debug' },
    { key: 'VERBOSE_LOGS', value: s.verboseLogs },
    { key: 'SEMANTIC_DEBUG', value: s.semanticDebug },
  );

  const serverEnvPath = resolve(__dirname, 'server', '.env');
  await safeWriteFile(serverEnvPath, buildEnvString(serverVars), 'server/.env');

  if (s.isDocker && s.metadataBackend === 'postgres') {
    const rootVars = [
      { comment: 'Docker Compose — used by the postgres service' },
      { key: 'POSTGRES_DB', value: s.pgDb },
      { key: 'POSTGRES_USER', value: s.pgUser },
      { key: 'POSTGRES_PASSWORD', value: s.pgPassword },
    ];
    const rootEnvPath = resolve(__dirname, '.env');
    await safeWriteFile(rootEnvPath, buildEnvString(rootVars), '.env (root)');
  }

  if (s.viteDebug === 'true' || s.corsOrigins !== s.defaultCors) {
    const clientVars = [
      { comment: 'Client build-time variables' },
      { key: 'VITE_DEBUG', value: s.viteDebug },
    ];
    const clientEnvPath = resolve(__dirname, 'client', '.env');
    await safeWriteFile(clientEnvPath, buildEnvString(clientVars), 'client/.env');
  }

  heading('Setup Complete');
  console.log('  Files written:');
  console.log('    • server/.env');
  if (s.isDocker && s.metadataBackend === 'postgres') console.log('    • .env (Docker Compose)');
  if (s.viteDebug === 'true' || s.corsOrigins !== s.defaultCors) console.log('    • client/.env');

  console.log('\n  Next steps:');
  if (s.metadataBackend === 'postgres') {
    if (s.isDocker) {
      console.log('    1. docker compose up -d');
      console.log('    2. docker compose exec api node src/db/migrate-postgres.js');
      console.log('    3. Open http://localhost in your browser');
    } else {
      console.log('    1. cd server && node src/db/migrate-postgres.js');
      console.log('    2. npm run dev');
      console.log('    3. Open http://localhost:5173 in your browser');
    }
  } else {
    if (s.isDocker) {
      console.log('    1. docker compose up -d');
      console.log('    2. Open http://localhost in your browser');
    } else {
      console.log('    1. npm run dev');
      console.log('    2. Open http://localhost:5173 in your browser');
    }
  }
  console.log('\n  Default admin login: admin / admin123');
  console.log('  ⚠  Change this password immediately after first login.\n');
}

// ── Step runner ──────────────────────────────────────────────────────────────

const steps = [
  stepDeploymentMode,
  stepServer,
  stepSecrets,
  stepMetadataBackend,
  stepPostgres,
  stepSnowflake,
  stepSnowflakeOAuth,
  stepRedis,
  stepSso,
  stepWebauthn,
  stepDebug,
];

async function main() {
  console.log('\n  Simply Analytics — Interactive Setup\n');
  console.log('  This wizard will walk you through configuring the platform.');
  console.log('  Press Enter to accept the default shown in [brackets].');
  console.log('  Type "back" at any prompt to return to the previous section.\n');

  const state = {};
  let i = 0;

  while (i < steps.length) {
    try {
      await steps[i](state);
      i++;
    } catch (err) {
      if (err === BACK) {
        if (i > 0) {
          i--;
          console.log('\n  ↩  Going back...');
        } else {
          console.log('\n  ↩  Already at the first section.');
        }
      } else {
        throw err;
      }
    }
  }

  await writeFiles(state);
  rl.close();
}

main().catch((err) => {
  console.error('\n  Setup failed:', err.message);
  rl.close();
  process.exit(1);
});
