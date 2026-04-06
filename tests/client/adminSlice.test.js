import { describe, it, expect, beforeEach, vi } from 'vitest';
import { create } from 'zustand';

vi.mock('../../client/src/api/modules/setupApi', () => ({
  setupApi: {
    getProgress: vi.fn(),
    getMasterKey: vi.fn(),
    testDatabase: vi.fn(),
    saveConfig: vi.fn(),
    runMigrations: vi.fn(),
    createOwner: vi.fn(),
    complete: vi.fn(),
  },
}));

vi.mock('../../client/src/api/modules/adminApi', () => ({
  adminApi: {
    getConfig: vi.fn(),
    getConfigSection: vi.fn(),
    updateConfigSection: vi.fn(),
    testConnection: vi.fn(),
    runMigrations: vi.fn(),
    rotateKey: vi.fn(),
    getSystemInfo: vi.fn(),
    testMigrationTarget: vi.fn(),
    migrateData: vi.fn(),
    switchBackend: vi.fn(),
  },
}));

import { createAdminSlice } from '../../client/src/store/slices/adminSlice';
import { setupApi } from '../../client/src/api/modules/setupApi';
import { adminApi } from '../../client/src/api/modules/adminApi';

const createTestStore = () => create((...a) => createAdminSlice(...a));

describe('adminSlice', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
    vi.clearAllMocks();
  });

  it('initialises with default state', () => {
    const s = store.getState();
    expect(s.setupProgress).toBeNull();
    expect(s.setupMasterKey).toBeNull();
    expect(s.setupMigrationLogs).toEqual([]);
    expect(s.setupLoading).toBe(false);
    expect(s.setupError).toBeNull();
    expect(s.adminConfig).toBeNull();
    expect(s.adminSystemInfo).toBeNull();
    expect(s.adminLoading).toBe(false);
    expect(s.adminError).toBeNull();
    expect(s.dataMigrationLogs).toEqual([]);
    expect(s.dataMigrationComplete).toBe(false);
    expect(s.dataMigrationRunning).toBe(false);
  });

  describe('setup actions', () => {
    it('fetchSetupProgress stores progress', async () => {
      const progress = { steps: [{ id: 'database', done: true }], currentStep: 1 };
      setupApi.getProgress.mockResolvedValue(progress);

      const result = await store.getState().fetchSetupProgress();
      expect(result).toEqual(progress);
      expect(store.getState().setupProgress).toEqual(progress);
    });

    it('fetchSetupProgress handles failure gracefully', async () => {
      setupApi.getProgress.mockRejectedValue(new Error('Network error'));
      const result = await store.getState().fetchSetupProgress();
      expect(result).toBeNull();
    });

    it('fetchMasterKey stores key when revealed', async () => {
      setupApi.getMasterKey.mockResolvedValue({ revealed: true, masterKey: 'abc123' });
      await store.getState().fetchMasterKey();
      expect(store.getState().setupMasterKey).toBe('abc123');
    });

    it('fetchMasterKey does not store key when not revealed', async () => {
      setupApi.getMasterKey.mockResolvedValue({ revealed: false });
      await store.getState().fetchMasterKey();
      expect(store.getState().setupMasterKey).toBeNull();
    });

    it('testSetupDatabase returns result and manages loading state', async () => {
      setupApi.testDatabase.mockResolvedValue({ success: true, message: 'Connected' });

      const result = await store.getState().testSetupDatabase({ backend: 'postgres' });
      expect(result).toEqual({ success: true, message: 'Connected' });
      expect(store.getState().setupLoading).toBe(false);
    });

    it('testSetupDatabase handles errors', async () => {
      setupApi.testDatabase.mockRejectedValue(new Error('Connection refused'));

      const result = await store.getState().testSetupDatabase({ backend: 'postgres' });
      expect(result.success).toBe(false);
      expect(store.getState().setupError).toBe('Connection refused');
      expect(store.getState().setupLoading).toBe(false);
    });

    it('saveSetupConfig calls the API and manages loading', async () => {
      setupApi.saveConfig.mockResolvedValue({ success: true });

      const result = await store.getState().saveSetupConfig({ JWT_SECRET: 'abc' });
      expect(result).toEqual({ success: true });
      expect(store.getState().setupLoading).toBe(false);
    });

    it('createSetupOwner returns success on valid data', async () => {
      setupApi.createOwner.mockResolvedValue({ success: true });
      const result = await store.getState().createSetupOwner({ username: 'admin', password: 'pass' });
      expect(result.success).toBe(true);
    });

    it('createSetupOwner returns error message on failure', async () => {
      setupApi.createOwner.mockRejectedValue(new Error('Username taken'));
      const result = await store.getState().createSetupOwner({ username: 'admin' });
      expect(result.error).toBe('Username taken');
    });

    it('completeSetup calls the API', async () => {
      setupApi.complete.mockResolvedValue({});
      const result = await store.getState().completeSetup();
      expect(result.success).toBe(true);
    });
  });

  describe('admin actions', () => {
    it('loadAdminConfig stores config', async () => {
      const config = { database: { POSTGRES_HOST: 'localhost' } };
      adminApi.getConfig.mockResolvedValue(config);

      const result = await store.getState().loadAdminConfig();
      expect(result).toEqual(config);
      expect(store.getState().adminConfig).toEqual(config);
      expect(store.getState().adminLoading).toBe(false);
    });

    it('loadAdminConfig sets error on failure', async () => {
      adminApi.getConfig.mockRejectedValue(new Error('Unauthorized'));
      await store.getState().loadAdminConfig();
      expect(store.getState().adminError).toBe('Unauthorized');
    });

    it('loadAdminConfigSection returns section data', async () => {
      const section = { POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5432' };
      adminApi.getConfigSection.mockResolvedValue(section);

      const result = await store.getState().loadAdminConfigSection('database');
      expect(result).toEqual(section);
    });

    it('updateAdminConfig saves and reloads config', async () => {
      adminApi.updateConfigSection.mockResolvedValue({ success: true, changedKeys: ['JWT_EXPIRY'] });
      adminApi.getConfig.mockResolvedValue({ security: { JWT_EXPIRY: '4h' } });

      const result = await store.getState().updateAdminConfig('security', { JWT_EXPIRY: '4h' });
      expect(result.success).toBe(true);
      expect(store.getState().adminConfig).toEqual({ security: { JWT_EXPIRY: '4h' } });
    });

    it('testAdminConnection returns result', async () => {
      adminApi.testConnection.mockResolvedValue({ success: true, message: 'OK' });

      const result = await store.getState().testAdminConnection('database', {});
      expect(result.success).toBe(true);
      expect(store.getState().adminLoading).toBe(false);
    });

    it('testAdminConnection handles errors', async () => {
      adminApi.testConnection.mockRejectedValue(new Error('Timeout'));
      const result = await store.getState().testAdminConnection('database', {});
      expect(result.success).toBe(false);
      expect(result.message).toBe('Timeout');
    });

    it('rotateAdminKey calls API and reloads config', async () => {
      adminApi.rotateKey.mockResolvedValue({ success: true, message: 'Rotated' });
      adminApi.getConfig.mockResolvedValue({ security: {} });

      const result = await store.getState().rotateAdminKey('jwt');
      expect(result.success).toBe(true);
      expect(adminApi.getConfig).toHaveBeenCalled();
    });

    it('loadSystemInfo stores system info', async () => {
      const info = { uptime: 3600, nodeVersion: 'v20.0.0', activeSessions: 5 };
      adminApi.getSystemInfo.mockResolvedValue(info);

      const result = await store.getState().loadSystemInfo();
      expect(result).toEqual(info);
      expect(store.getState().adminSystemInfo).toEqual(info);
    });
  });

  describe('data migration actions', () => {
    it('testMigrationTarget returns result', async () => {
      adminApi.testMigrationTarget.mockResolvedValue({ success: true, message: 'Reachable' });
      const result = await store.getState().testMigrationTarget({ host: 'newdb' });
      expect(result.success).toBe(true);
    });

    it('switchBackend calls API', async () => {
      adminApi.switchBackend.mockResolvedValue({ success: true, message: 'Switched' });
      const result = await store.getState().switchBackend({ host: 'newdb' });
      expect(result.success).toBe(true);
    });

    it('switchBackend handles error', async () => {
      adminApi.switchBackend.mockRejectedValue(new Error('Failed'));
      const result = await store.getState().switchBackend({ host: 'bad' });
      expect(result.success).toBe(false);
      expect(store.getState().adminError).toBe('Failed');
    });

    it('resetDataMigration clears all migration state', () => {
      store.setState({
        dataMigrationLogs: ['log1'],
        dataMigrationProgress: { step: 'users' },
        dataMigrationComplete: true,
        dataMigrationRunning: false,
      });

      store.getState().resetDataMigration();

      const s = store.getState();
      expect(s.dataMigrationLogs).toEqual([]);
      expect(s.dataMigrationProgress).toBeNull();
      expect(s.dataMigrationComplete).toBe(false);
      expect(s.dataMigrationRunning).toBe(false);
    });
  });

  describe('error clearing', () => {
    it('clearAdminError resets adminError', () => {
      store.setState({ adminError: 'some error' });
      store.getState().clearAdminError();
      expect(store.getState().adminError).toBeNull();
    });

    it('clearSetupError resets setupError', () => {
      store.setState({ setupError: 'setup failure' });
      store.getState().clearSetupError();
      expect(store.getState().setupError).toBeNull();
    });
  });
});
