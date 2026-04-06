import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiDatabase, FiLock, FiKey, FiServer, FiUsers, FiShield,
  FiRefreshCw, FiSave, FiAlertTriangle, FiCheck, FiCopy,
  FiPlay, FiArrowLeft, FiArrowRight,
  FiLoader, FiUser, FiGlobe,
} from 'react-icons/fi';
import { useAppStore } from '../store/appStore';
import '../styles/AdminPanel.css';

const NORMAL_TABS = [
  { id: 'database', label: 'Database', icon: FiDatabase },
  { id: 'security', label: 'Security', icon: FiLock },
  { id: 'sso', label: 'SSO / SAML', icon: FiGlobe },
  { id: 'scim', label: 'SCIM', icon: FiUsers },
  { id: 'system', label: 'System', icon: FiServer },
];

const PROVISION_TABS = [
  { id: 'database', label: 'Database', icon: FiDatabase },
  { id: 'security', label: 'Security', icon: FiLock },
  { id: 'migrations', label: 'Migrations', icon: FiPlay },
  { id: 'owner', label: 'Create Owner', icon: FiUser },
];

function generateHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const {
    currentRole, signOut,
    // Admin config (normal mode)
    adminConfig, adminSystemInfo, adminLoading, adminError,
    loadAdminConfig, loadAdminConfigSection, updateAdminConfig,
    testAdminConnection, runAdminMigrations, rotateAdminKey,
    loadSystemInfo, adminMigrationLogs, adminMigrationResult,
    clearAdminError,
    // Setup / provisioning
    setupProgress, fetchSetupProgress,
    fetchMasterKey, setupMasterKey,
    testSetupDatabase,
    saveSetupConfig, runSetupMigrations,
    createSetupOwner, completeSetup,
    setupMigrationLogs, setupMigrationResult,
    setupLoading, setupError, clearSetupError,
    // Data migration
    dataMigrationLogs, dataMigrationComplete, dataMigrationRunning,
    testMigrationTarget, startDataMigration, switchBackend,
    resetDataMigration,
    emergencyMode,
    emergencyDbStatus, checkDbStatus, emergencyCreateOwner,
  } = useAppStore();

  const isProvisioning = currentRole === 'bootstrap_admin';

  const tabs = isProvisioning ? PROVISION_TABS : NORMAL_TABS;
  const [tab, setTab] = useState(tabs[0].id);

  // Normal-mode state
  const [editValues, setEditValues] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [confirmRotate, setConfirmRotate] = useState(null);
  const [rotateResult, setRotateResult] = useState(null);
  const [saveResult, setSaveResult] = useState(null);
  const logRef = useRef(null);

  // Provisioning state
  const [dbBackend, setDbBackend] = useState('postgres');
  const [pgHost, setPgHost] = useState('');
  const [pgPort, setPgPort] = useState('5432');
  const [pgDb, setPgDb] = useState('');
  const [pgUser, setPgUser] = useState('');
  const [pgPass, setPgPass] = useState('');
  const [sfAccount, setSfAccount] = useState('');
  const [sfUser, setSfUser] = useState('');
  const [sfAuthType, setSfAuthType] = useState('password');
  const [sfPassword, setSfPassword] = useState('');
  const [sfWarehouse, setSfWarehouse] = useState('SIMPLY_WH');
  const [sfDatabase, setSfDatabase] = useState('SIMPLY_ANALYTICS');
  const [sfSchema, setSfSchema] = useState('APP');
  const [sfRole, setSfRole] = useState('SIMPLY_SVC_ROLE');
  const [dbTestResult, setDbTestResult] = useState(null);
  const [jwtSecret, setJwtSecret] = useState(() => generateHex(64));
  const [encKey, setEncKey] = useState(() => generateHex(32));
  const [jwtExpiry, setJwtExpiry] = useState('8h');
  const [ownerUsername, setOwnerUsername] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerConfirm, setOwnerConfirm] = useState('');
  const [ownerResult, setOwnerResult] = useState(null);
  const [masterKeyCopied, setMasterKeyCopied] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  // Data migration state
  const [showMigrationWizard, setShowMigrationWizard] = useState(false);
  const [destBackend, setDestBackend] = useState('postgres');
  const [destHost, setDestHost] = useState('');
  const [destPort, setDestPort] = useState('5432');
  const [destDb, setDestDb] = useState('');
  const [destUser, setDestUser] = useState('');
  const [destPass, setDestPass] = useState('');
  const [destSfAccount, setDestSfAccount] = useState('');
  const [destSfUser, setDestSfUser] = useState('');
  const [destSfAuthType, setDestSfAuthType] = useState('password');
  const [destSfPassword, setDestSfPassword] = useState('');
  const [destSfWarehouse, setDestSfWarehouse] = useState('');
  const [destSfRole, setDestSfRole] = useState('');
  const [destSfDatabase, setDestSfDatabase] = useState('');
  const [destSfSchema, setDestSfSchema] = useState('APP');
  const [destTestResult, setDestTestResult] = useState(null);
  const [confirmMigrate, setConfirmMigrate] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [switchResult, setSwitchResult] = useState(null);
  const migrationLogRef = useRef(null);

  // Emergency owner creation state
  const [emOwnerUsername, setEmOwnerUsername] = useState('');
  const [emOwnerEmail, setEmOwnerEmail] = useState('');
  const [emOwnerPassword, setEmOwnerPassword] = useState('');
  const [emOwnerConfirm, setEmOwnerConfirm] = useState('');
  const [emOwnerResult, setEmOwnerResult] = useState(null);
  const [emOwnerComplete, setEmOwnerComplete] = useState(false);

  const dbIsReachable = emergencyDbStatus?.dbReachable;
  const dbIsEmpty = dbIsReachable && emergencyDbStatus?.userCount === 0;
  const existingOwner = emergencyDbStatus?.owner;
  const canCreateEmOwner = emOwnerUsername && emOwnerEmail && emOwnerPassword && emOwnerPassword.length >= 8 && emOwnerPassword === emOwnerConfirm;

  // Load on mount
  useEffect(() => {
    if (isProvisioning) {
      fetchSetupProgress();
      fetchMasterKey();
    } else if (emergencyMode) {
      checkDbStatus();
      loadAdminConfig();
    } else {
      loadAdminConfig();
    }
  }, []);

  // Pre-fill owner fields when existing owner is detected
  useEffect(() => {
    if (existingOwner && !emOwnerUsername && !emOwnerEmail) {
      setEmOwnerUsername(existingOwner.username);
      setEmOwnerEmail(existingOwner.email);
    }
  }, [existingOwner]);

  // Auto-navigate to current provisioning step
  useEffect(() => {
    if (isProvisioning && setupProgress) {
      const current = PROVISION_TABS[setupProgress.currentStep];
      if (current) setTab(current.id);
    }
  }, [setupProgress]);

  // Normal mode: load section data when tab changes
  useEffect(() => {
    if (!isProvisioning && tab !== 'system') {
      handleLoadSection(tab);
    }
    if (!isProvisioning && tab === 'system') {
      loadSystemInfo();
      handleLoadSection('server');
    }
  }, [tab, isProvisioning]);

  // Auto-scroll migration logs
  useEffect(() => {
    logRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [setupMigrationLogs, adminMigrationLogs]);

  useEffect(() => {
    migrationLogRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dataMigrationLogs]);

  // --- Normal mode helpers ---
  const handleLoadSection = async (section) => {
    const data = await loadAdminConfigSection(section);
    if (data) setEditValues(data);
    setTestResult(null);
    setSaveResult(null);
  };

  const handleFieldChange = (key, value) => {
    setEditValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaveResult(null);
    const section = tab === 'system' ? 'server' : tab;
    const result = await updateAdminConfig(section, editValues);
    if (result?.success) {
      setSaveResult({ type: 'success', message: `Saved. Changed: ${result.changedKeys?.join(', ') || 'none'}` });
    } else {
      setSaveResult({ type: 'error', message: result?.error || 'Failed to save' });
    }
  };

  const handleTestDb = async () => {
    setTestResult(null);
    const result = await testAdminConnection('database', editValues);
    setTestResult(result);
  };




  const handleRotate = async (keyType) => {
    setConfirmRotate(null);
    setRotateResult(null);
    const result = await rotateAdminKey(keyType);
    setRotateResult(result);
  };

  // --- Provisioning helpers ---
  const stepIndex = useCallback((id) => PROVISION_TABS.findIndex(t => t.id === id), []);
  const isStepDone = useCallback((id) => {
    if (!setupProgress) return false;
    const s = setupProgress.steps.find(s => s.id === id);
    return s?.done || false;
  }, [setupProgress]);
  const isStepAccessible = useCallback((id) => {
    const idx = stepIndex(id);
    if (idx === 0) return true;
    const prev = PROVISION_TABS[idx - 1];
    return isStepDone(prev.id);
  }, [stepIndex, isStepDone]);

  const handleProvisionTestDb = async () => {
    setDbTestResult(null);
    const config = dbBackend === 'postgres'
      ? { backend: 'postgres', host: pgHost, port: pgPort, database: pgDb, user: pgUser, password: pgPass }
      : { backend: 'snowflake', sfAccount, sfUser, sfAuthType, sfPassword, sfWarehouse, sfDatabase, sfSchema, sfRole };
    const result = await testSetupDatabase(config);
    setDbTestResult(result);
  };



  const handleSaveAndMigrate = async () => {
    const config = {
      METADATA_BACKEND: dbBackend,
      ...(dbBackend === 'postgres' ? {
        POSTGRES_HOST: pgHost, POSTGRES_PORT: pgPort, POSTGRES_DB: pgDb,
        POSTGRES_USER: pgUser, POSTGRES_PASSWORD: pgPass,
      } : {
        SF_SERVICE_ACCOUNT: sfAccount, SF_SERVICE_USER: sfUser,
        SF_SERVICE_AUTH_TYPE: sfAuthType, SF_SERVICE_PASSWORD: sfPassword,
        SF_SERVICE_WAREHOUSE: sfWarehouse, SF_SERVICE_DATABASE: sfDatabase,
        SF_SERVICE_SCHEMA: sfSchema, SF_SERVICE_ROLE: sfRole,
      }),
      DISABLE_REDIS: 'true',
      JWT_SECRET: jwtSecret,
      CREDENTIALS_ENCRYPTION_KEY: encKey,
      JWT_EXPIRY: jwtExpiry,
      NODE_ENV: 'production',
      PORT: '3001',
      CORS_ORIGINS: window.location.origin,
      FRONTEND_URL: window.location.origin,
    };
    await saveSetupConfig(config);
    setTab('migrations');
    await runSetupMigrations();
    fetchSetupProgress();
  };

  const handleCreateOwner = async () => {
    if (ownerPassword !== ownerConfirm) {
      setOwnerResult({ error: 'Passwords do not match' });
      return;
    }
    const result = await createSetupOwner({
      username: ownerUsername,
      email: ownerEmail,
      password: ownerPassword,
      displayName: ownerUsername,
    });
    setOwnerResult(result);
    if (result?.success) {
      await completeSetup();
      setSetupComplete(true);
      fetchSetupProgress();
    }
  };

  const handleFinishSetup = () => {
    signOut();
    navigate('/');
  };

  const handleEmergencyCreateOwner = async () => {
    if (emOwnerPassword !== emOwnerConfirm) {
      setEmOwnerResult({ error: 'Passwords do not match' });
      return;
    }
    const result = await emergencyCreateOwner({
      username: emOwnerUsername,
      email: emOwnerEmail,
      password: emOwnerPassword,
      displayName: emOwnerUsername,
    });
    setEmOwnerResult(result);
    if (result?.success) setEmOwnerComplete(true);
  };

  const handleCopyKey = () => {
    if (setupMasterKey) {
      navigator.clipboard.writeText(setupMasterKey);
      setMasterKeyCopied(true);
      setTimeout(() => setMasterKeyCopied(false), 2000);
    }
  };

  // Data migration handlers
  const buildDestConfig = () => {
    if (destBackend === 'postgres') {
      return { backend: 'postgres', host: destHost, port: destPort, database: destDb, user: destUser, password: destPass };
    }
    return {
      backend: 'snowflake',
      account: destSfAccount,
      user: destSfUser,
      authType: destSfAuthType,
      password: destSfPassword,
      warehouse: destSfWarehouse,
      role: destSfRole,
      database: destSfDatabase,
      schema: destSfSchema,
    };
  };

  const handleTestDestination = async () => {
    setDestTestResult(null);
    const result = await testMigrationTarget(buildDestConfig());
    setDestTestResult(result);
  };

  const handleStartMigration = async () => {
    setConfirmMigrate(false);
    await startDataMigration(buildDestConfig());
  };

  const handleSwitchBackend = async () => {
    setConfirmSwitch(false);
    const result = await switchBackend(buildDestConfig());
    setSwitchResult(result);
  };

  const handleResetMigration = () => {
    resetDataMigration();
    setShowMigrationWizard(false);
    setDestTestResult(null);
    setConfirmMigrate(false);
    setConfirmSwitch(false);
    setSwitchResult(null);
    setDestHost('');
    setDestDb('');
    setDestUser('');
    setDestPass('');
    setDestSfAccount('');
    setDestSfUser('');
    setDestSfAuthType('password');
    setDestSfPassword('');
    setDestSfWarehouse('');
    setDestSfRole('');
    setDestSfDatabase('');
    setDestSfSchema('APP');
  };

  const canTestDest = destBackend === 'postgres'
    ? destHost && destDb && destUser && destPass
    : destSfAccount && destSfUser && destSfPassword && destSfDatabase && destSfWarehouse;

  const canNextDb = dbBackend === 'postgres'
    ? pgHost && pgDb && pgUser && pgPass
    : sfAccount && sfUser;
  const canNextOwner = ownerUsername && ownerEmail && ownerPassword && ownerPassword.length >= 8 && ownerPassword === ownerConfirm;

  const formatUptime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  };
  const formatBytes = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <div className="admin-header-content">
          <div>
            <h1>{isProvisioning ? 'Initial Setup' : emergencyMode ? 'Emergency Administration' : 'Administration'}</h1>
            <p>{isProvisioning ? 'Configure your Simply Analytics deployment' : emergencyMode ? (dbIsReachable ? 'Authenticated via master key. Manage your owner account below.' : 'Database may be unreachable. Only configuration changes are available.') : 'Server configuration and management'}</p>
          </div>
        </div>
      </header>

      {emergencyMode && !emergencyDbStatus && (
        <div className="admin-emergency-banner info">
          <FiLoader className="spinner" />
          <div>Checking database status...</div>
        </div>
      )}
      {emergencyMode && emergencyDbStatus && (
        <div className={`admin-emergency-banner${dbIsReachable ? ' info' : ''}`}>
          {dbIsReachable ? <FiDatabase /> : <FiAlertTriangle />}
          <div>
            {dbIsEmpty ? (
              <><strong>No Users Found</strong> — The database is reachable but empty. Create an owner account below, then sign out and sign in normally.</>
            ) : dbIsReachable ? (
              <><strong>Owner Recovery</strong> — The database is reachable. You can reset the owner account credentials below, then sign out and sign in normally.</>
            ) : (
              <><strong>Emergency Mode</strong> — You are authenticated via master key because the database is unreachable. Update your database credentials below, then sign out and back in normally.</>
            )}
          </div>
        </div>
      )}

      {/* Master key banner (provisioning only, shown once) */}
      {isProvisioning && setupMasterKey && (
        <div className="provisioning-banner">
          <h2><FiKey /> Master Encryption Key</h2>
          <p>Your configuration file is encrypted with this key. Save it securely — it will not be shown again.</p>
          <div className="admin-master-key-box">
            <div className="admin-master-key-value">{setupMasterKey}</div>
            <button className="admin-btn admin-btn-secondary" onClick={handleCopyKey}>
              {masterKeyCopied ? <><FiCheck /> Copied</> : <><FiCopy /> Copy</>}
            </button>
          </div>
          <div className="admin-master-key-warning">
            <FiAlertTriangle />
            <span>If this key is lost, you will need to re-run setup from scratch.</span>
          </div>
        </div>
      )}

      {/* Provisioning stepper */}
      {isProvisioning && setupProgress && !setupComplete && (
        <div className="provisioning-stepper">
          {PROVISION_TABS.map((s, i) => {
            const done = isStepDone(s.id);
            const active = tab === s.id;
            const accessible = isStepAccessible(s.id);
            return (
              <React.Fragment key={s.id}>
                {i > 0 && <div className={`provisioning-step-connector ${isStepDone(PROVISION_TABS[i - 1].id) ? 'done' : ''}`} />}
                <div
                  className={`provisioning-step ${done ? 'done' : ''} ${active ? 'active' : ''} ${accessible ? 'clickable' : ''}`}
                  onClick={() => accessible && setTab(s.id)}
                >
                  <div className="provisioning-step-dot">
                    {done ? '\u2713' : i + 1}
                  </div>
                  <span>{s.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Tabs (normal mode — also shown in emergency when DB is reachable for config access) */}
      {!isProvisioning && !(emergencyMode && !dbIsReachable) && !emOwnerComplete && (
        <div className="admin-tabs">
          {NORMAL_TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`admin-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <Icon /> {t.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="admin-content">

      {/* ===================== EMERGENCY OWNER MANAGEMENT ===================== */}
      {emergencyMode && dbIsReachable && !emOwnerComplete && (
        <div className="admin-section-wrapper">
          <div className="admin-section-header">
            <div>
              <h2><FiUser /> {existingOwner ? 'Reset Owner Account' : 'Create Owner Account'}</h2>
              <p>{existingOwner
                ? `Current owner: ${existingOwner.username} (${existingOwner.email}). Update the credentials below to regain access.`
                : 'The database has no users. Create the initial owner account to get started.'}</p>
            </div>
          </div>
          <div className="admin-section-card">
            <div className="admin-field"><label>Username</label><input value={emOwnerUsername} onChange={e => setEmOwnerUsername(e.target.value)} placeholder={existingOwner?.username || ''} /></div>
            <div className="admin-field"><label>Email</label><input type="email" value={emOwnerEmail} onChange={e => setEmOwnerEmail(e.target.value)} placeholder={existingOwner?.email || ''} /></div>
            <div className="admin-field-row">
              <div className="admin-field"><label>{existingOwner ? 'New Password' : 'Password'}</label><input type="password" value={emOwnerPassword} onChange={e => setEmOwnerPassword(e.target.value)} /></div>
              <div className="admin-field"><label>Confirm Password</label><input type="password" value={emOwnerConfirm} onChange={e => setEmOwnerConfirm(e.target.value)} /></div>
            </div>

            {emOwnerPassword && emOwnerPassword.length < 8 && <div className="admin-result error">Password must be at least 8 characters</div>}
            {emOwnerConfirm && emOwnerPassword !== emOwnerConfirm && <div className="admin-result error">Passwords do not match</div>}
            {emOwnerResult?.error && <div className="admin-result error">{emOwnerResult.error}</div>}

            <div className="admin-btn-row">
              <div />
              <button className="admin-btn admin-btn-primary" disabled={!canCreateEmOwner || adminLoading} onClick={handleEmergencyCreateOwner}>
                {adminLoading ? <><FiLoader className="spinner" /> Saving...</> : <><FiCheck /> {existingOwner ? 'Reset Owner Account' : 'Create Owner Account'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {emergencyMode && emOwnerComplete && (
        <div className="admin-section-wrapper">
          <div className="admin-section-card">
            <div className="provisioning-complete-card">
              <div className="provisioning-complete-icon"><FiCheck /></div>
              <h2>{emOwnerResult?.action === 'reset' ? 'Owner Account Reset' : 'Owner Account Created'}</h2>
              <p>Sign out and log in with your {emOwnerResult?.action === 'reset' ? 'updated' : 'new'} owner credentials.</p>
              <button className="admin-btn admin-btn-success" onClick={handleFinishSetup}>
                Sign Out & Sign In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SETUP COMPLETE CARD ===================== */}
      {setupComplete && (
        <div className="admin-section-wrapper">
          <div className="admin-section-card">
            <div className="provisioning-complete-card">
              <div className="provisioning-complete-icon"><FiCheck /></div>
              <h2>Setup Complete</h2>
              <p>Your Simply Analytics instance is ready. You'll be signed out so you can log in with your new owner account.</p>
              <button className="admin-btn admin-btn-success" onClick={handleFinishSetup}>
                Sign In as Owner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== DATABASE TAB ===================== */}
      {tab === 'database' && !setupComplete && (
        <div className="admin-section-wrapper">
          <div className="admin-section-header">
            <div>
              <h2><FiDatabase /> Database Connection</h2>
              <p>{isProvisioning ? 'Choose your metadata backend and provide connection details.' : `Metadata backend: ${adminConfig?.database?.METADATA_BACKEND || 'postgres'}`}</p>
            </div>
          </div>
          <div className="admin-section-card">

          {isProvisioning ? (
            <>
              <div className="admin-backend-selector">
                <div className={`admin-backend-option ${dbBackend === 'postgres' ? 'selected' : ''}`} onClick={() => setDbBackend('postgres')}>
                  <h4>PostgreSQL</h4>
                  <p>Recommended for most deployments</p>
                </div>
                <div className={`admin-backend-option ${dbBackend === 'snowflake' ? 'selected' : ''}`} onClick={() => setDbBackend('snowflake')}>
                  <h4>Snowflake</h4>
                  <p>Use Snowflake hybrid tables</p>
                </div>
              </div>
              {dbBackend === 'postgres' ? (
                <>
                  <div className="admin-field-row">
                    <div className="admin-field"><label>Host</label><input value={pgHost} onChange={e => setPgHost(e.target.value)} /></div>
                    <div className="admin-field"><label>Port</label><input value={pgPort} onChange={e => setPgPort(e.target.value)} /></div>
                  </div>
                  <div className="admin-field"><label>Database</label><input value={pgDb} onChange={e => setPgDb(e.target.value)} /></div>
                  <div className="admin-field-row">
                    <div className="admin-field"><label>Username</label><input value={pgUser} onChange={e => setPgUser(e.target.value)} /></div>
                    <div className="admin-field"><label>Password</label><input type="password" value={pgPass} onChange={e => setPgPass(e.target.value)} /></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="admin-field"><label>Account Identifier</label><input value={sfAccount} onChange={e => setSfAccount(e.target.value)} placeholder="org-account" /></div>
                  <div className="admin-field-row">
                    <div className="admin-field"><label>Service User</label><input value={sfUser} onChange={e => setSfUser(e.target.value)} /></div>
                    <div className="admin-field">
                      <label>Auth Type</label>
                      <select value={sfAuthType} onChange={e => setSfAuthType(e.target.value)}>
                        <option value="password">Password</option>
                        <option value="keypair">Key Pair</option>
                        <option value="pat">PAT</option>
                      </select>
                    </div>
                  </div>
                  {sfAuthType === 'password' && (
                    <div className="admin-field"><label>Password</label><input type="password" value={sfPassword} onChange={e => setSfPassword(e.target.value)} /></div>
                  )}
                  <div className="admin-field-row">
                    <div className="admin-field"><label>Warehouse</label><input value={sfWarehouse} onChange={e => setSfWarehouse(e.target.value)} /></div>
                    <div className="admin-field"><label>Role</label><input value={sfRole} onChange={e => setSfRole(e.target.value)} /></div>
                  </div>
                  <div className="admin-field-row">
                    <div className="admin-field"><label>Database</label><input value={sfDatabase} onChange={e => setSfDatabase(e.target.value)} /></div>
                    <div className="admin-field"><label>Schema</label><input value={sfSchema} onChange={e => setSfSchema(e.target.value)} /></div>
                  </div>
                </>
              )}

              <div className="admin-btn-row">
                <button className="admin-btn admin-btn-secondary" onClick={handleProvisionTestDb} disabled={setupLoading || !canNextDb}>
                  {setupLoading ? <><FiLoader className="spinner" /> Testing...</> : <><FiRefreshCw /> Test Connection</>}
                </button>
                <button className="admin-btn admin-btn-primary" disabled={!canNextDb} onClick={() => setTab('security')}>
                  Next <FiArrowRight />
                </button>
              </div>
              {dbTestResult && <div className={`admin-result ${dbTestResult.success ? 'success' : 'error'}`}>{dbTestResult.success ? <FiCheck /> : <FiAlertTriangle />}{dbTestResult.message}</div>}
            </>
          ) : (
            <>
              {editValues.METADATA_BACKEND === 'postgres' || !editValues.METADATA_BACKEND ? (
                <>
                  <div className="admin-field-row">
                    <div className="admin-field"><label>Host</label><input value={editValues.POSTGRES_HOST || ''} readOnly className="admin-input-readonly" /></div>
                    <div className="admin-field"><label>Port</label><input value={editValues.POSTGRES_PORT || ''} readOnly className="admin-input-readonly" /></div>
                  </div>
                  <div className="admin-field"><label>Database</label><input value={editValues.POSTGRES_DB || ''} readOnly className="admin-input-readonly" /></div>
                  <div className="admin-hint">Host, port, and database can only be changed via the Migration Wizard below.</div>
                  <div className="admin-field-row">
                    <div className="admin-field"><label>Username</label><input value={editValues.POSTGRES_USER || ''} onChange={e => handleFieldChange('POSTGRES_USER', e.target.value)} /></div>
                    <div className="admin-field"><label>Password</label><input type="password" value={editValues.POSTGRES_PASSWORD || ''} onChange={e => handleFieldChange('POSTGRES_PASSWORD', e.target.value)} /></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="admin-field"><label>Account</label><input value={editValues.SF_SERVICE_ACCOUNT || ''} readOnly className="admin-input-readonly" /></div>
                  <div className="admin-field-row">
                    <div className="admin-field"><label>Database</label><input value={editValues.SF_SERVICE_DATABASE || ''} readOnly className="admin-input-readonly" /></div>
                    <div className="admin-field"><label>Schema</label><input value={editValues.SF_SERVICE_SCHEMA || ''} readOnly className="admin-input-readonly" /></div>
                  </div>
                  <div className="admin-field-row">
                    <div className="admin-field"><label>Warehouse</label><input value={editValues.SF_SERVICE_WAREHOUSE || ''} readOnly className="admin-input-readonly" /></div>
                    <div className="admin-field"><label>Role</label><input value={editValues.SF_SERVICE_ROLE || ''} readOnly className="admin-input-readonly" /></div>
                  </div>
                  <div className="admin-hint">Account, database, schema, warehouse, and role can only be changed via the Migration Wizard below.</div>
                  <div className="admin-field-row">
                    <div className="admin-field"><label>User</label><input value={editValues.SF_SERVICE_USER || ''} onChange={e => handleFieldChange('SF_SERVICE_USER', e.target.value)} /></div>
                    <div className="admin-field"><label>Auth Type</label><input value={editValues.SF_SERVICE_AUTH_TYPE || ''} onChange={e => handleFieldChange('SF_SERVICE_AUTH_TYPE', e.target.value)} /></div>
                  </div>
                </>
              )}
              <div className="admin-btn-row">
                <button className="admin-btn admin-btn-secondary" onClick={handleTestDb} disabled={adminLoading}><FiRefreshCw /> Test Connection</button>
                <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={adminLoading}><FiSave /> Save Changes</button>
              </div>
              {testResult && <div className={`admin-result ${testResult.success ? 'success' : 'error'}`}>{testResult.success ? <FiCheck /> : <FiAlertTriangle />}{testResult.message}</div>}
              {saveResult && <div className={`admin-result ${saveResult.type}`}>{saveResult.type === 'success' ? <FiCheck /> : <FiAlertTriangle />}{saveResult.message}</div>}

              <div className="admin-divider" />
              <div className="admin-subsection-title"><FiRefreshCw /> Schema Updates</div>
              <div className="admin-subsection-subtitle">Run schema migrations to apply any pending database updates.</div>
              <button className="admin-btn admin-btn-primary" onClick={runAdminMigrations} disabled={adminLoading}>
                {adminLoading ? <><FiLoader className="spinner" /> Running...</> : <><FiPlay /> Run Schema Migrations</>}
              </button>
              {adminMigrationLogs.length > 0 && (
                <div className="admin-migration-log">
                  {adminMigrationLogs.map((line, i) => <div key={i} className="log-line">{line}</div>)}
                  <div ref={logRef} />
                </div>
              )}
              {adminMigrationResult && (
                <div className={`admin-result ${adminMigrationResult.success ? 'success' : 'error'}`}>
                  {adminMigrationResult.success ? <><FiCheck /> Schema is up to date</> : <><FiAlertTriangle /> Errors: {adminMigrationResult.errors?.join(', ')}</>}
                </div>
              )}

              <div className="admin-divider" />
              <div className="admin-subsection-title"><FiDatabase /> Database Migration</div>
              <div className="admin-subsection-subtitle">
                Migrate all data to a different database instance or backend type. Your current database will not be modified.
              </div>

              {!showMigrationWizard ? (
                <button className="admin-btn admin-btn-secondary" onClick={() => setShowMigrationWizard(true)}>
                  <FiPlay /> Start Migration Wizard
                </button>
              ) : (
                <div className="admin-migration-wizard">
                  <div className="admin-backend-selector">
                    <div className={`admin-backend-option ${destBackend === 'postgres' ? 'selected' : ''}`} onClick={() => { if (!dataMigrationRunning) setDestBackend('postgres'); }}>
                      <h4>PostgreSQL</h4>
                      <p>Migrate to a PostgreSQL instance</p>
                    </div>
                    <div className={`admin-backend-option ${destBackend === 'snowflake' ? 'selected' : ''}`} onClick={() => { if (!dataMigrationRunning) setDestBackend('snowflake'); }}>
                      <h4>Snowflake</h4>
                      <p>Migrate to a Snowflake account</p>
                    </div>
                  </div>

                  {destBackend === 'postgres' && (
                    <>
                      <div className="admin-field-row">
                        <div className="admin-field"><label>Destination Host</label><input value={destHost} onChange={e => setDestHost(e.target.value)} placeholder="e.g. new-db.example.com" disabled={dataMigrationRunning} /></div>
                        <div className="admin-field"><label>Port</label><input value={destPort} onChange={e => setDestPort(e.target.value)} disabled={dataMigrationRunning} /></div>
                      </div>
                      <div className="admin-field"><label>Database Name</label><input value={destDb} onChange={e => setDestDb(e.target.value)} placeholder="simply_analytics" disabled={dataMigrationRunning} /></div>
                      <div className="admin-field-row">
                        <div className="admin-field"><label>Username</label><input value={destUser} onChange={e => setDestUser(e.target.value)} disabled={dataMigrationRunning} /></div>
                        <div className="admin-field"><label>Password</label><input type="password" value={destPass} onChange={e => setDestPass(e.target.value)} disabled={dataMigrationRunning} /></div>
                      </div>
                    </>
                  )}

                  {destBackend === 'snowflake' && (
                    <>
                      <div className="admin-field-row">
                        <div className="admin-field"><label>Account</label><input value={destSfAccount} onChange={e => setDestSfAccount(e.target.value)} placeholder="e.g. xy12345.us-east-1" disabled={dataMigrationRunning} /></div>
                        <div className="admin-field">
                          <label>Auth Type</label>
                          <select value={destSfAuthType} onChange={e => setDestSfAuthType(e.target.value)} disabled={dataMigrationRunning}>
                            <option value="password">Password</option>
                            <option value="pat">Personal Access Token</option>
                          </select>
                        </div>
                      </div>
                      <div className="admin-field-row">
                        <div className="admin-field"><label>User</label><input value={destSfUser} onChange={e => setDestSfUser(e.target.value)} disabled={dataMigrationRunning} /></div>
                        <div className="admin-field"><label>{destSfAuthType === 'pat' ? 'Token' : 'Password'}</label><input type="password" value={destSfPassword} onChange={e => setDestSfPassword(e.target.value)} disabled={dataMigrationRunning} /></div>
                      </div>
                      <div className="admin-field-row">
                        <div className="admin-field"><label>Database</label><input value={destSfDatabase} onChange={e => setDestSfDatabase(e.target.value)} placeholder="SIMPLY_ANALYTICS" disabled={dataMigrationRunning} /></div>
                        <div className="admin-field"><label>Schema</label><input value={destSfSchema} onChange={e => setDestSfSchema(e.target.value)} placeholder="APP" disabled={dataMigrationRunning} /></div>
                      </div>
                      <div className="admin-field-row">
                        <div className="admin-field"><label>Warehouse</label><input value={destSfWarehouse} onChange={e => setDestSfWarehouse(e.target.value)} placeholder="SIMPLY_WH" disabled={dataMigrationRunning} /></div>
                        <div className="admin-field"><label>Role</label><input value={destSfRole} onChange={e => setDestSfRole(e.target.value)} placeholder="SIMPLY_SVC_ROLE" disabled={dataMigrationRunning} /></div>
                      </div>
                    </>
                  )}

                  <div className="admin-btn-row">
                    <button className="admin-btn admin-btn-secondary" onClick={handleTestDestination} disabled={!canTestDest || adminLoading || dataMigrationRunning}>
                      {adminLoading ? <><FiLoader className="spinner" /> Testing...</> : <><FiRefreshCw /> Test Destination</>}
                    </button>
                    <button className="admin-btn admin-btn-primary" onClick={() => setConfirmMigrate(true)} disabled={!canTestDest || dataMigrationRunning || dataMigrationComplete}>
                      <FiPlay /> Start Migration
                    </button>
                    <button className="admin-btn admin-btn-secondary" onClick={handleResetMigration} disabled={dataMigrationRunning}>
                      Cancel
                    </button>
                  </div>

                  {destTestResult && (
                    <div className={`admin-result ${destTestResult.success ? 'success' : 'error'}`}>{destTestResult.message}</div>
                  )}

                  {dataMigrationLogs.length > 0 && (
                    <div className="admin-migration-log">
                      {dataMigrationLogs.map((line, i) => (
                        <div key={i} className={`log-line ${line.startsWith('ERROR') ? 'log-error' : ''}`}>{line}</div>
                      ))}
                      <div ref={migrationLogRef} />
                    </div>
                  )}

                  {dataMigrationComplete && (
                    <div className="admin-migration-complete">
                      {dataMigrationProgress?.success ? (
                        <>
                          <div className="admin-result success">Migration verified. All data has been copied and confirmed in the destination database.</div>
                          <p style={{ margin: '12px 0', color: 'var(--text-secondary)' }}>
                            Would you like to switch to the new database now? Your current database will remain intact as a backup.
                          </p>
                          <div className="admin-btn-row">
                            <button className="admin-btn admin-btn-success" onClick={() => setConfirmSwitch(true)}>
                              Switch to New Database
                            </button>
                            <button className="admin-btn admin-btn-secondary" onClick={handleResetMigration}>
                              Keep Current Database
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="admin-result error">Migration completed with verification warnings. Row count mismatches were detected.</div>
                          {dataMigrationProgress?.warnings?.map((w, i) => (
                            <div key={i} className="admin-result error" style={{ marginTop: 4 }}>{w}</div>
                          ))}
                          <p style={{ margin: '12px 0', color: 'var(--text-secondary)' }}>
                            The destination database may be incomplete. Investigate the mismatches above before retrying. Your current database is unchanged.
                          </p>
                          <div className="admin-btn-row">
                            <button className="admin-btn admin-btn-secondary" onClick={handleResetMigration}>
                              Dismiss
                            </button>
                          </div>
                        </>
                      )}
                      {switchResult && (
                        <div className={`admin-result ${switchResult.success ? 'success' : 'error'}`}>
                          {switchResult.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          </div>
        </div>
      )}

      {/* ===================== SECURITY TAB ===================== */}
      {tab === 'security' && !setupComplete && (
        <div className="admin-section-wrapper">
          <div className="admin-section-header">
            <div>
              <h2><FiLock /> Security Keys</h2>
              <p>{isProvisioning ? 'Cryptographic keys have been auto-generated. You can regenerate them if needed.' : 'JWT signing and credential encryption'}</p>
            </div>
          </div>
          <div className="admin-section-card">

          {isProvisioning ? (
            <>
              <div className="admin-field">
                <label>JWT Signing Secret</label>
                <div className="admin-field-row">
                  <input value={jwtSecret} readOnly style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />
                  <button className="admin-btn admin-btn-secondary" onClick={() => setJwtSecret(generateHex(64))} style={{ whiteSpace: 'nowrap' }}>Regenerate</button>
                </div>
              </div>
              <div className="admin-field">
                <label>Credential Encryption Key (AES-256)</label>
                <div className="admin-field-row">
                  <input value={encKey} readOnly style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />
                  <button className="admin-btn admin-btn-secondary" onClick={() => setEncKey(generateHex(32))} style={{ whiteSpace: 'nowrap' }}>Regenerate</button>
                </div>
              </div>
              <div className="admin-field">
                <label>JWT Token Expiry</label>
                <select value={jwtExpiry} onChange={e => setJwtExpiry(e.target.value)}>
                  <option value="1h">1 hour</option>
                  <option value="4h">4 hours</option>
                  <option value="8h">8 hours</option>
                  <option value="24h">24 hours</option>
                </select>
              </div>
              <div className="admin-btn-row">
                <button className="admin-btn admin-btn-secondary" onClick={() => setTab('database')}><FiArrowLeft /> Back</button>
                <button className="admin-btn admin-btn-primary" onClick={handleSaveAndMigrate} disabled={setupLoading}>
                  {setupLoading ? <><FiLoader className="spinner" /> Saving...</> : <><FiSave /> Save & Run Migrations</>}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="admin-field">
                <label>JWT Expiry</label>
                <select value={editValues.JWT_EXPIRY || '8h'} onChange={e => handleFieldChange('JWT_EXPIRY', e.target.value)}>
                  <option value="1h">1 hour</option>
                  <option value="4h">4 hours</option>
                  <option value="8h">8 hours</option>
                  <option value="24h">24 hours</option>
                </select>
              </div>
              <div className="admin-field"><label>Session Timeout (minutes, inactivity)</label><input value={editValues.SESSION_TIMEOUT_MINUTES || '20'} onChange={e => handleFieldChange('SESSION_TIMEOUT_MINUTES', e.target.value)} placeholder="20" /></div>
              <div className="admin-divider" />
              <div className="admin-subsection-title"><FiKey /> Key Rotation</div>
              <div className="admin-subsection-subtitle">Rotating keys is irreversible. JWT rotation signs out all users.</div>
              <div className="admin-btn-row">
                <button className="admin-btn admin-btn-danger" onClick={() => setConfirmRotate('jwt')}><FiRefreshCw /> Rotate JWT Secret</button>
                <button className="admin-btn admin-btn-danger" onClick={() => setConfirmRotate('encryption')}><FiRefreshCw /> Rotate Encryption Key</button>
              </div>
              {rotateResult && <div className={`admin-result ${rotateResult.success ? 'success' : 'error'}`}>{rotateResult.success ? <FiCheck /> : <FiAlertTriangle />}{rotateResult.message || rotateResult.error}</div>}
            </>
          )}
          </div>
        </div>
      )}

      {tab === 'security' && !setupComplete && !isProvisioning && (
        <div className="admin-section-wrapper">
          <div className="admin-section-header">
            <div>
              <h2><FiShield /> Password Policy</h2>
              <p>Default rules for all non-SSO password creation and changes</p>
            </div>
          </div>
          <div className="admin-section-card">
            <div className="admin-policy-grid">
              <div className="admin-policy-field">
                <label>Minimum Length</label>
                <div className="admin-length-input">
                  <input
                    type="number"
                    min={8}
                    max={128}
                    value={editValues.PASSWORD_MIN_LENGTH || '14'}
                    onChange={e => {
                      const v = parseInt(e.target.value, 10);
                      handleFieldChange('PASSWORD_MIN_LENGTH', String(isNaN(v) ? 14 : Math.max(8, v)));
                    }}
                  />
                  <span className="admin-length-suffix">characters</span>
                </div>
                <span className="admin-field-hint">Cannot be less than 8</span>
              </div>
              <div className="admin-policy-field">
                <label>Character Requirements</label>
                <div className="admin-toggle-list">
                  <label className="admin-toggle-row">
                    <span>Uppercase letter (A–Z)</span>
                    <input type="checkbox" className="admin-toggle" checked={editValues.PASSWORD_REQUIRE_UPPERCASE !== 'false'} onChange={e => handleFieldChange('PASSWORD_REQUIRE_UPPERCASE', e.target.checked ? 'true' : 'false')} />
                  </label>
                  <label className="admin-toggle-row">
                    <span>Lowercase letter (a–z)</span>
                    <input type="checkbox" className="admin-toggle" checked={editValues.PASSWORD_REQUIRE_LOWERCASE !== 'false'} onChange={e => handleFieldChange('PASSWORD_REQUIRE_LOWERCASE', e.target.checked ? 'true' : 'false')} />
                  </label>
                  <label className="admin-toggle-row">
                    <span>Number (0–9)</span>
                    <input type="checkbox" className="admin-toggle" checked={editValues.PASSWORD_REQUIRE_NUMBER !== 'false'} onChange={e => handleFieldChange('PASSWORD_REQUIRE_NUMBER', e.target.checked ? 'true' : 'false')} />
                  </label>
                  <label className="admin-toggle-row">
                    <span>Special character (!@#$...)</span>
                    <input type="checkbox" className="admin-toggle" checked={editValues.PASSWORD_REQUIRE_SPECIAL !== 'false'} onChange={e => handleFieldChange('PASSWORD_REQUIRE_SPECIAL', e.target.checked ? 'true' : 'false')} />
                  </label>
                </div>
              </div>
            </div>
            <div className="admin-btn-row">
              <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={adminLoading}><FiSave /> Save Changes</button>
            </div>
            {saveResult && <div className={`admin-result ${saveResult.type}`}>{saveResult.type === 'success' ? <FiCheck /> : <FiAlertTriangle />}{saveResult.message}</div>}
          </div>
        </div>
      )}

      {tab === 'security' && !setupComplete && !isProvisioning && (
        <div className="admin-section-wrapper">
          <div className="admin-section-header">
            <div>
              <h2><FiShield /> MFA Policy</h2>
              <p>Multi-factor authentication settings for TOTP (authenticator apps) and passkeys</p>
            </div>
          </div>
          <div className="admin-section-card">
            <span className="admin-field-hint" style={{ marginBottom: '1rem', display: 'block' }}>
              <strong>TOTP</strong> (authenticator app codes) works from any URL. <strong>Passkeys</strong> are locked to the configured domain — users who access from multiple URLs should use TOTP.
              All fields below default from your Frontend URL and only need to be set if your deployment domain differs.
            </span>
            <div className="admin-field">
              <label>Application Name</label>
              <input value={editValues.APP_NAME || ''} onChange={e => handleFieldChange('APP_NAME', e.target.value)} placeholder="Simply Analytics" />
              <span className="admin-field-hint">Displayed in authenticator apps and browser passkey prompts</span>
            </div>
            <div className="admin-field">
              <label>Passkey Domain</label>
              <input value={editValues.WEBAUTHN_RP_ID || ''} onChange={e => handleFieldChange('WEBAUTHN_RP_ID', e.target.value)} placeholder="Defaults to hostname from Frontend URL" />
              <span className="admin-field-hint">Must match the domain users access the app from. Passkeys are locked to this domain.</span>
            </div>
            <div className="admin-field">
              <label>Allowed Origins</label>
              <input value={editValues.WEBAUTHN_ORIGIN || ''} onChange={e => handleFieldChange('WEBAUTHN_ORIGIN', e.target.value)} placeholder="Defaults to Frontend URL" />
              <span className="admin-field-hint">Comma-separated URLs where passkeys are accepted (e.g. https://app.com, https://app.com:8080)</span>
            </div>
            <div className="admin-btn-row">
              <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={adminLoading}><FiSave /> Save Changes</button>
            </div>
            {saveResult && <div className={`admin-result ${saveResult.type}`}>{saveResult.type === 'success' ? <FiCheck /> : <FiAlertTriangle />}{saveResult.message}</div>}
          </div>
        </div>
      )}

      {/* ===================== MIGRATIONS STEP (provisioning only) ===================== */}
      {tab === 'migrations' && isProvisioning && !setupComplete && (
        <div className="admin-section-wrapper">
          <div className="admin-section-header">
            <div>
              <h2><FiPlay /> Running Migrations</h2>
              <p>Creating database schema and tables...</p>
            </div>
          </div>
          <div className="admin-section-card">

          {setupMigrationLogs.length > 0 && (
            <div className="admin-migration-log">
              {setupMigrationLogs.map((line, i) => <div key={i} className="log-line">{line}</div>)}
              <div ref={logRef} />
            </div>
          )}
          {setupMigrationResult && (
            <div className={`admin-result ${setupMigrationResult.success ? 'success' : 'error'}`}>
              {setupMigrationResult.success ? 'Migrations completed successfully' : `Migration errors: ${setupMigrationResult.errors?.join(', ')}`}
            </div>
          )}
          <div className="admin-btn-row">
            <div />
            <button className="admin-btn admin-btn-primary" disabled={!setupMigrationResult?.success} onClick={() => setTab('owner')}>
              Next <FiArrowRight />
            </button>
          </div>
          </div>
        </div>
      )}

      {/* ===================== CREATE OWNER TAB (provisioning only) ===================== */}
      {tab === 'owner' && isProvisioning && !setupComplete && (
        <div className="admin-section-wrapper">
          <div className="admin-section-header">
            <div>
              <h2><FiUser /> Create Owner Account</h2>
              <p>This will be the system owner with full admin access. After creation, the bootstrap admin (admin/admin123) will be permanently disabled.</p>
            </div>
          </div>
          <div className="admin-section-card">

          <div className="admin-field"><label>Username</label><input value={ownerUsername} onChange={e => setOwnerUsername(e.target.value)} /></div>
          <div className="admin-field"><label>Email</label><input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} /></div>
          <div className="admin-field-row">
            <div className="admin-field"><label>Password</label><input type="password" value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)} /></div>
            <div className="admin-field"><label>Confirm Password</label><input type="password" value={ownerConfirm} onChange={e => setOwnerConfirm(e.target.value)} /></div>
          </div>

          {ownerPassword && ownerPassword.length < 8 && <div className="admin-result error">Password must be at least 8 characters</div>}
          {ownerConfirm && ownerPassword !== ownerConfirm && <div className="admin-result error">Passwords do not match</div>}
          {ownerResult?.error && <div className="admin-result error">{ownerResult.error}</div>}

          <div className="admin-btn-row">
            <button className="admin-btn admin-btn-secondary" onClick={() => setTab('migrations')}><FiArrowLeft /> Back</button>
            <button className="admin-btn admin-btn-primary" disabled={!canNextOwner || setupLoading} onClick={handleCreateOwner}>
              {setupLoading ? <><FiLoader className="spinner" /> Creating...</> : <><FiCheck /> Create Account & Finish</>}
            </button>
          </div>
          </div>
        </div>
      )}

      {/* ===================== SSO TAB (normal only) ===================== */}
      {tab === 'sso' && !isProvisioning && (
        <div className="admin-section-wrapper">
          <div className="admin-section-header">
            <div>
              <h2><FiGlobe /> SSO / SAML Configuration</h2>
              <p>Single sign-on via SAML 2.0</p>
            </div>
          </div>
          <div className="admin-section-card">
            <div className="admin-toggle-wrapper"><label>Enable SSO</label><input type="checkbox" className="admin-toggle" checked={editValues.SSO_ENABLED === 'true'} onChange={e => handleFieldChange('SSO_ENABLED', e.target.checked ? 'true' : 'false')} /></div>
            <div className="admin-field"><label>SAML Entrypoint URL</label><input value={editValues.SAML_ENTRYPOINT || ''} onChange={e => handleFieldChange('SAML_ENTRYPOINT', e.target.value)} placeholder="https://your-idp.example.com/sso/saml" /></div>
            <div className="admin-field"><label>SAML Issuer</label><input value={editValues.SAML_ISSUER || ''} onChange={e => handleFieldChange('SAML_ISSUER', e.target.value)} /></div>
            <div className="admin-field"><label>SAML Certificate (PEM)</label><input value={editValues.SAML_CERT || ''} onChange={e => handleFieldChange('SAML_CERT', e.target.value)} /></div>
            <div className="admin-field"><label>SAML Callback URL</label><input value={editValues.SAML_CALLBACK_URL || ''} onChange={e => handleFieldChange('SAML_CALLBACK_URL', e.target.value)} /></div>

            <div className="admin-divider" />
            <div className="admin-subsection-title"><FiKey /> Snowflake OAuth</div>
            <div className="admin-field"><label>OAuth Client ID</label><input value={editValues.SNOWFLAKE_OAUTH_CLIENT_ID || ''} onChange={e => handleFieldChange('SNOWFLAKE_OAUTH_CLIENT_ID', e.target.value)} /></div>
            <div className="admin-field"><label>OAuth Client Secret</label><input type="password" value={editValues.SNOWFLAKE_OAUTH_CLIENT_SECRET || ''} onChange={e => handleFieldChange('SNOWFLAKE_OAUTH_CLIENT_SECRET', e.target.value)} /></div>
            <div className="admin-field"><label>OAuth Redirect URI</label><input value={editValues.SNOWFLAKE_OAUTH_REDIRECT_URI || ''} onChange={e => handleFieldChange('SNOWFLAKE_OAUTH_REDIRECT_URI', e.target.value)} placeholder="http://localhost:3001/api/auth/callback" /></div>
            <div className="admin-field"><label>Snowflake Account</label><input value={editValues.SNOWFLAKE_ACCOUNT || ''} onChange={e => handleFieldChange('SNOWFLAKE_ACCOUNT', e.target.value)} placeholder="your-account.snowflakecomputing.com" /></div>

            <div className="admin-btn-row"><button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={adminLoading}><FiSave /> Save Changes</button></div>
            {saveResult && <div className={`admin-result ${saveResult.type}`}>{saveResult.type === 'success' ? <FiCheck /> : <FiAlertTriangle />}{saveResult.message}</div>}
          </div>
        </div>
      )}

      {/* ===================== SCIM TAB (normal only) ===================== */}
      {tab === 'scim' && !isProvisioning && (
        <div className="admin-section-wrapper">
          <div className="admin-section-header">
            <div>
              <h2><FiUsers /> SCIM Provisioning</h2>
              <p>Automated user provisioning via SCIM 2.0</p>
            </div>
          </div>
          <div className="admin-section-card">
            <div className="admin-toggle-wrapper"><label>Enable SCIM</label><input type="checkbox" className="admin-toggle" checked={editValues.SCIM_ENABLED === 'true'} onChange={e => handleFieldChange('SCIM_ENABLED', e.target.checked ? 'true' : 'false')} /></div>
            <div className="admin-field"><label>SCIM Bearer Token</label><input type="password" value={editValues.SCIM_BEARER_TOKEN || ''} onChange={e => handleFieldChange('SCIM_BEARER_TOKEN', e.target.value)} /></div>
            <div className="admin-btn-row"><button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={adminLoading}><FiSave /> Save Changes</button></div>
            {saveResult && <div className={`admin-result ${saveResult.type}`}>{saveResult.type === 'success' ? <FiCheck /> : <FiAlertTriangle />}{saveResult.message}</div>}
          </div>
        </div>
      )}

      {/* ===================== SYSTEM TAB (normal only) ===================== */}
      {tab === 'system' && !isProvisioning && (
        <>
        {adminSystemInfo && (
        <div className="admin-section-wrapper">
          <div className="admin-section-header">
            <div>
              <h2><FiServer /> System Information</h2>
              <p>Server health and runtime details</p>
            </div>
            <button className="admin-btn admin-btn-secondary" onClick={loadSystemInfo}><FiRefreshCw /> Refresh</button>
          </div>
          <div className="admin-section-card">
            <div className="admin-system-grid">
              <div className="admin-system-stat"><div className="stat-label">Uptime</div><div className="stat-value">{formatUptime(adminSystemInfo.uptime)}</div></div>
              <div className="admin-system-stat"><div className="stat-label">Node Version</div><div className="stat-value">{adminSystemInfo.nodeVersion}</div></div>
              <div className="admin-system-stat"><div className="stat-label">Metadata Backend</div><div className="stat-value">{adminSystemInfo.metadataBackend}</div></div>
              <div className="admin-system-stat"><div className="stat-label">Active Sessions</div><div className="stat-value">{adminSystemInfo.activeSessions}</div></div>
              <div className="admin-system-stat"><div className="stat-label">Session Timeout</div><div className="stat-value">{adminSystemInfo.sessionTimeoutMinutes || 20} min (inactivity)</div></div>
              <div className="admin-system-stat"><div className="stat-label">Heap Used</div><div className="stat-value">{formatBytes(adminSystemInfo.memoryUsage?.heapUsed || 0)}</div></div>
              <div className="admin-system-stat"><div className="stat-label">Platform</div><div className="stat-value">{adminSystemInfo.platform} ({adminSystemInfo.arch})</div></div>
              <div className="admin-system-stat"><div className="stat-label">Server Time</div><div className="stat-value">{new Date(adminSystemInfo.serverTime).toLocaleTimeString()}</div></div>
            </div>
          </div>
        </div>
        )}

        <div className="admin-section-wrapper">
          <div className="admin-section-header">
            <div>
              <h2><FiServer /> Server Configuration</h2>
              <p>URLs, CORS, and runtime settings. Changes take effect immediately.</p>
            </div>
          </div>
          <div className="admin-section-card">
            <div className="admin-field">
              <label>Frontend URL</label>
              <input value={editValues.FRONTEND_URL || ''} onChange={e => handleFieldChange('FRONTEND_URL', e.target.value)} placeholder="https://analytics.company.com" />
              <span className="admin-field-hint">The URL users access the app from. Also used for WebAuthn, SAML redirects, and CORS.</span>
            </div>
            <div className="admin-field">
              <label>CORS Origins</label>
              <input value={editValues.CORS_ORIGINS || ''} onChange={e => handleFieldChange('CORS_ORIGINS', e.target.value)} placeholder="https://analytics.company.com" />
              <span className="admin-field-hint">Comma-separated list of allowed origins for API requests</span>
            </div>
            <div className="admin-field-row">
              <div className="admin-field">
                <label>API Port</label>
                <input value={editValues.PORT || '3001'} onChange={e => handleFieldChange('PORT', e.target.value)} placeholder="3001" />
              </div>
              <div className="admin-field">
                <label>Rate Limit (requests / 15 min)</label>
                <input type="number" value={editValues.RATE_LIMIT_MAX || '1000'} onChange={e => handleFieldChange('RATE_LIMIT_MAX', e.target.value)} />
              </div>
            </div>
            <div className="admin-toggle-wrapper">
              <label>Verbose Logging</label>
              <input type="checkbox" className="admin-toggle" checked={editValues.VERBOSE_LOGS === 'true'} onChange={e => handleFieldChange('VERBOSE_LOGS', e.target.checked ? 'true' : 'false')} />
            </div>
            <div className="admin-btn-row"><button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={adminLoading}><FiSave /> Save Changes</button></div>
            {saveResult && <div className={`admin-result ${saveResult.type}`}>{saveResult.type === 'success' ? <FiCheck /> : <FiAlertTriangle />}{saveResult.message}</div>}
          </div>
        </div>
        </>
      )}

      {/* Error display */}
      {(adminError || setupError) && !setupComplete && (
        <div className="admin-result error"><FiAlertTriangle />{adminError || setupError}</div>
      )}
      </div>

      {/* Rotation confirmation modal (normal mode) */}
      {confirmRotate && (
        <div className="admin-confirm-overlay" onClick={() => setConfirmRotate(null)}>
          <div className="admin-confirm-box" onClick={e => e.stopPropagation()}>
            <h3><FiAlertTriangle /> Rotate {confirmRotate === 'jwt' ? 'JWT Secret' : 'Encryption Key'}?</h3>
            <p>
              {confirmRotate === 'jwt'
                ? 'This will invalidate all active sessions. Every user will need to sign in again.'
                : 'This will re-encrypt all stored Snowflake credentials with a new key.'}
            </p>
            <div className="admin-confirm-actions">
              <button className="admin-btn admin-btn-secondary" onClick={() => setConfirmRotate(null)}>Cancel</button>
              <button className="admin-btn admin-btn-danger" onClick={() => handleRotate(confirmRotate)}><FiRefreshCw /> Rotate</button>
            </div>
          </div>
        </div>
      )}

      {confirmMigrate && (
        <div className="admin-confirm-overlay" onClick={() => setConfirmMigrate(false)}>
          <div className="admin-confirm-box" onClick={e => e.stopPropagation()}>
            <h3><FiDatabase /> Start Database Migration?</h3>
            <p>
              This will copy all data from the current database to <strong>{destDb}</strong> on <strong>{destHost}</strong>.
              The current database will not be modified. The destination must be empty.
            </p>
            <div className="admin-confirm-actions">
              <button className="admin-btn admin-btn-secondary" onClick={() => setConfirmMigrate(false)}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleStartMigration}><FiPlay /> Start Migration</button>
            </div>
          </div>
        </div>
      )}

      {confirmSwitch && (
        <div className="admin-confirm-overlay" onClick={() => setConfirmSwitch(false)}>
          <div className="admin-confirm-box" onClick={e => e.stopPropagation()}>
            <h3><FiDatabase /> Switch to New Database?</h3>
            <p>
              The server will be reconfigured to use <strong>{destDb}</strong> on <strong>{destHost}</strong> as
              the metadata backend. This takes effect immediately. Your old database is preserved as a backup.
            </p>
            <div className="admin-confirm-actions">
              <button className="admin-btn admin-btn-secondary" onClick={() => setConfirmSwitch(false)}>Cancel</button>
              <button className="admin-btn admin-btn-success" onClick={handleSwitchBackend}><FiCheck /> Switch Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
