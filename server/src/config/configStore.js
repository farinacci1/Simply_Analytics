import { EventEmitter } from 'events';
import crypto from 'crypto';
import {
  ensureMasterKey,
  getMasterKeyHex,
  verifyMasterKey,
  saveConfigFile,
  loadConfigFile,
  configFileExists,
} from './configEncryption.js';

const SENSITIVE_KEYS = new Set([
  'POSTGRES_PASSWORD',
  'JWT_SECRET',
  'CREDENTIALS_ENCRYPTION_KEY',
  'SF_SERVICE_PASSWORD',
  'SF_SERVICE_PRIVATE_KEY_PASS',
  'SF_SERVICE_TOKEN',
  'SAML_CERT',
  'SCIM_BEARER_TOKEN',
  'SNOWFLAKE_OAUTH_CLIENT_SECRET',
  'REDIS_URL',
]);

const SENSITIVE_MASK = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

// Keys that cannot be changed via the normal config update flow.
// To change these, the owner must use the migration wizard (switchBackend).
const IMMUTABLE_DB_KEYS = new Set([
  'METADATA_BACKEND',
  'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB',
  'SF_SERVICE_ACCOUNT', 'SF_SERVICE_DATABASE', 'SF_SERVICE_SCHEMA',
  'SF_SERVICE_WAREHOUSE', 'SF_SERVICE_ROLE',
]);

const SECTION_KEYS = {
  server: ['NODE_ENV', 'PORT', 'CORS_ORIGINS', 'FRONTEND_URL', 'RATE_LIMIT_MAX', 'VERBOSE_LOGS'],
  database: [
    'METADATA_BACKEND',
    'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD',
    'SF_SERVICE_ACCOUNT', 'SF_SERVICE_USER', 'SF_SERVICE_AUTH_TYPE',
    'SF_SERVICE_PASSWORD', 'SF_SERVICE_PRIVATE_KEY_PATH', 'SF_SERVICE_PRIVATE_KEY_PASS',
    'SF_SERVICE_TOKEN', 'SF_SERVICE_ROLE', 'SF_SERVICE_WAREHOUSE',
    'SF_SERVICE_DATABASE', 'SF_SERVICE_SCHEMA',
    'SNOWFLAKE_INSECURE_CONNECT',
  ],
  redis: ['REDIS_URL', 'REDIS_SESSION_PREFIX', 'SESSION_TTL_SECONDS', 'DISABLE_REDIS'],
  security: [
    'JWT_SECRET', 'JWT_EXPIRY', 'CREDENTIALS_ENCRYPTION_KEY', 'SESSION_TIMEOUT_MINUTES',
    'PASSWORD_MIN_LENGTH', 'PASSWORD_REQUIRE_UPPERCASE', 'PASSWORD_REQUIRE_LOWERCASE',
    'PASSWORD_REQUIRE_NUMBER', 'PASSWORD_REQUIRE_SPECIAL',
    'APP_NAME', 'WEBAUTHN_RP_ID', 'WEBAUTHN_ORIGIN',
  ],
  sso: [
    'SSO_ENABLED', 'SAML_ENTRYPOINT', 'SAML_ISSUER', 'SAML_CERT', 'SAML_CALLBACK_URL',
    'SNOWFLAKE_OAUTH_CLIENT_ID', 'SNOWFLAKE_OAUTH_CLIENT_SECRET', 'SNOWFLAKE_OAUTH_REDIRECT_URI', 'SNOWFLAKE_ACCOUNT',
  ],
  scim: ['SCIM_ENABLED', 'SCIM_BEARER_TOKEN'],
};

class ConfigStore extends EventEmitter {
  constructor() {
    super();
    this._config = {};
    this._configured = false;
    this._masterKeyShown = false;
  }

  /**
   * Load config from encrypted file (or fall through to process.env for legacy).
   * Returns true if config was loaded from file (setup complete).
   */
  initialize() {
    ensureMasterKey();

    if (configFileExists()) {
      try {
        this._config = loadConfigFile();
        this._configured = !!this._config._setupComplete;
        this._applyToProcessEnv();
        if (this._configured) {
          console.log('[config] Loaded configuration from encrypted store');
        } else {
          console.log('[config] Config file exists but setup is incomplete — resuming setup mode');
        }
        return this._configured;
      } catch (err) {
        console.error('[config] Failed to decrypt config file:', err.message);
        throw err;
      }
    }

    // No config file — check if legacy .env has enough to run
    if (process.env.CREDENTIALS_ENCRYPTION_KEY &&
        process.env.CREDENTIALS_ENCRYPTION_KEY !== 'default-encryption-key-change-in-production') {
      this._importFromEnv();
      this._configured = true;
      console.log('[config] Loaded configuration from environment variables (legacy mode)');
      return true;
    }

    this._config.DISABLE_REDIS = 'true';
    console.log('[config] No configuration found — entering setup mode');
    return false;
  }

  /** Read a single config value */
  get(key) {
    return this._config[key] ?? process.env[key];
  }

  /** Read all keys for a section */
  getSection(section) {
    const keys = SECTION_KEYS[section];
    if (!keys) return {};
    const result = {};
    for (const k of keys) {
      result[k] = this.get(k);
    }
    return result;
  }

  /** Update a section. Validates, persists, emits 'change'.
   *  Sensitive fields sent as the mask placeholder are silently ignored
   *  so the admin can submit a form without overwriting secrets they didn't touch.
   *  Immutable database keys (host/port/db) are silently skipped — use switchBackend(). */
  async update(section, values) {
    const keys = SECTION_KEYS[section];
    if (!keys) throw new Error(`Unknown config section: ${section}`);

    const changedKeys = [];
    for (const [k, v] of Object.entries(values)) {
      if (!keys.includes(k)) continue;
      if (SENSITIVE_KEYS.has(k) && v === SENSITIVE_MASK) continue;
      if (IMMUTABLE_DB_KEYS.has(k)) continue;
      if (this._config[k] !== v) {
        changedKeys.push(k);
        this._config[k] = v;
      }
    }

    if (changedKeys.length === 0) return changedKeys;

    this._config._setupComplete = true;
    saveConfigFile(this._config);
    this._applyToProcessEnv();
    this.emit('change', { section, changedKeys });
    return changedKeys;
  }

  /** Bulk-set during initial setup (all sections at once).
   *  Does NOT mark the app as configured — that happens in markConfigured()
   *  after migrations and owner creation are done. */
  async saveInitialConfig(allValues) {
    for (const [k, v] of Object.entries(allValues)) {
      if (v !== undefined && v !== null) {
        this._config[k] = v;
      }
    }
    saveConfigFile(this._config);
    this._applyToProcessEnv();
  }

  /** Mark setup as fully complete (called after migrations + owner account).
   *  Sets _configured and emits 'change' so the server mounts normal routes. */
  markConfigured() {
    this._configured = true;
    this._config._setupComplete = true;
    saveConfigFile(this._config);
    this.emit('change', { section: '_setup', changedKeys: ['_setupComplete'] });
  }

  isConfigured() {
    return this._configured;
  }

  /** Returns which provisioning steps are complete (inferred from config state). */
  async getSetupProgress() {
    const cfg = this._config;
    const backend = cfg.METADATA_BACKEND || null;

    const database = !!(backend && (
      (backend === 'postgres' && cfg.POSTGRES_HOST && cfg.POSTGRES_USER) ||
      (backend === 'snowflake' && cfg.SF_SERVICE_ACCOUNT && cfg.SF_SERVICE_USER)
    ));

    const security = !!(cfg.JWT_SECRET && cfg.CREDENTIALS_ENCRYPTION_KEY);

    let migrations = false;
    if (database && security) {
      try {
        if (backend === 'postgres') {
          const pg = await import('pg');
          const pool = new pg.default.Pool({
            host: cfg.POSTGRES_HOST,
            port: parseInt(cfg.POSTGRES_PORT || '5432'),
            database: cfg.POSTGRES_DB || 'simply_analytics',
            user: cfg.POSTGRES_USER,
            password: cfg.POSTGRES_PASSWORD,
            connectionTimeoutMillis: 3000,
          });
          const check = await pool.query(
            `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') as ok`
          );
          migrations = check.rows[0]?.ok === true;
          await pool.end();
        }
      } catch (_) {}
    }

    const owner = !!cfg._setupComplete;

    const steps = [
      { id: 'database', label: 'Database', done: database },
      { id: 'security', label: 'Security', done: security },
      { id: 'migrations', label: 'Migrations', done: migrations },
      { id: 'owner', label: 'Create Owner', done: owner },
    ];

    const currentIndex = steps.findIndex(s => !s.done);
    return {
      steps,
      currentStep: currentIndex === -1 ? steps.length : currentIndex,
      complete: steps.every(s => s.done),
    };
  }

  /**
   * Switch the active database backend after a successful migration.
   * Updates config with new connection details, persists, and triggers hot-reload.
   * @param {object} newConfig - { backend, host, port, database, user, password, ... }
   */
  async switchBackend(newConfig) {
    const keyMap = {
      backend: 'METADATA_BACKEND',
      host: 'POSTGRES_HOST',
      port: 'POSTGRES_PORT',
      database: 'POSTGRES_DB',
      user: 'POSTGRES_USER',
      password: 'POSTGRES_PASSWORD',
      // Snowflake keys
      account: 'SF_SERVICE_ACCOUNT',
      sfUser: 'SF_SERVICE_USER',
      authType: 'SF_SERVICE_AUTH_TYPE',
      sfPassword: 'SF_SERVICE_PASSWORD',
      warehouse: 'SF_SERVICE_WAREHOUSE',
      sfRole: 'SF_SERVICE_ROLE',
      sfDatabase: 'SF_SERVICE_DATABASE',
      sfSchema: 'SF_SERVICE_SCHEMA',
    };

    const changedKeys = [];
    for (const [incoming, configKey] of Object.entries(keyMap)) {
      if (newConfig[incoming] !== undefined && newConfig[incoming] !== null) {
        this._config[configKey] = newConfig[incoming];
        changedKeys.push(configKey);
      }
    }

    if (changedKeys.length === 0) throw new Error('No valid backend configuration provided');

    saveConfigFile(this._config);
    this._applyToProcessEnv();
    this.emit('change', { section: 'database', changedKeys });

    return changedKeys;
  }

  /** Master key hex — only returned once per server lifetime. */
  getMasterKeyOnce() {
    if (this._masterKeyShown) return null;
    this._masterKeyShown = true;
    return getMasterKeyHex();
  }

  /** Allow verification without revealing the key again. */
  verifyMasterKey(hex) {
    return verifyMasterKey(hex);
  }

  /** Return config with sensitive values masked. */
  toSafeObject() {
    const safe = {};
    for (const [section, keys] of Object.entries(SECTION_KEYS)) {
      safe[section] = {};
      for (const k of keys) {
        const val = this.get(k);
        if (val === undefined || val === null) {
          safe[section][k] = null;
        } else if (SENSITIVE_KEYS.has(k)) {
          safe[section][k] = val ? SENSITIVE_MASK : null;
        } else {
          safe[section][k] = val;
        }
      }
    }
    return safe;
  }

  /** Return values for a section with sensitive fields masked. */
  getRawSection(section) {
    const keys = SECTION_KEYS[section];
    if (!keys) return {};
    const result = {};
    for (const k of keys) {
      const val = this.get(k);
      if (SENSITIVE_KEYS.has(k) && val) {
        result[k] = SENSITIVE_MASK;
      } else {
        result[k] = val;
      }
    }
    return result;
  }

  /** Generate random keys for security section. */
  static generateSecurityDefaults() {
    return {
      JWT_SECRET: crypto.randomBytes(64).toString('hex'),
      CREDENTIALS_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
      JWT_EXPIRY: '8h',
      SESSION_TIMEOUT_MINUTES: '20',
      PASSWORD_MIN_LENGTH: '14',
      PASSWORD_REQUIRE_UPPERCASE: 'true',
      PASSWORD_REQUIRE_LOWERCASE: 'true',
      PASSWORD_REQUIRE_NUMBER: 'true',
      PASSWORD_REQUIRE_SPECIAL: 'true',
    };
  }

  getPasswordPolicy() {
    const minLength = Math.max(8, parseInt(this.get('PASSWORD_MIN_LENGTH') || '14', 10) || 14);
    return {
      minLength,
      requireUppercase: this.get('PASSWORD_REQUIRE_UPPERCASE') !== 'false',
      requireLowercase: this.get('PASSWORD_REQUIRE_LOWERCASE') !== 'false',
      requireNumber: this.get('PASSWORD_REQUIRE_NUMBER') !== 'false',
      requireSpecial: this.get('PASSWORD_REQUIRE_SPECIAL') !== 'false',
    };
  }

  // -- private helpers --------------------------------------------------------

  _importFromEnv() {
    for (const keys of Object.values(SECTION_KEYS)) {
      for (const k of keys) {
        if (process.env[k] !== undefined) {
          this._config[k] = process.env[k];
        }
      }
    }
    this._config._setupComplete = true;
  }

  _applyToProcessEnv() {
    for (const [k, v] of Object.entries(this._config)) {
      if (k.startsWith('_')) continue;
      if (v !== undefined && v !== null) {
        process.env[k] = String(v);
      }
    }
  }
}

// Singleton
const configStore = new ConfigStore();
export default configStore;
export { SECTION_KEYS, SENSITIVE_KEYS, IMMUTABLE_DB_KEYS };
