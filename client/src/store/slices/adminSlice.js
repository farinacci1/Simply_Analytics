import { setupApi } from '../../api/modules/setupApi';
import { adminApi } from '../../api/modules/adminApi';
import { authApi } from '../../api/modules/authApi';

export const createAdminSlice = (set, get) => ({
  // Setup / provisioning state
  setupProgress: null,     // { steps[], currentStep, complete }
  setupMasterKey: null,
  setupMigrationLogs: [],
  setupMigrationResult: null,
  setupLoading: false,
  setupError: null,

  // Admin panel state
  adminConfig: null,
  adminSystemInfo: null,
  adminMigrationLogs: [],
  adminMigrationResult: null,
  adminLoading: false,
  adminError: null,

  // Data migration state (backend-to-backend)
  dataMigrationLogs: [],
  dataMigrationProgress: null,
  dataMigrationComplete: false,
  dataMigrationRunning: false,

  // Emergency mode DB status
  emergencyDbStatus: null,

  // Setup actions
  fetchSetupProgress: async () => {
    try {
      const progress = await setupApi.getProgress();
      set({ setupProgress: progress });
      return progress;
    } catch (err) {
      console.warn('Failed to fetch setup progress:', err.message);
      return null;
    }
  },

  fetchMasterKey: async () => {
    try {
      const data = await setupApi.getMasterKey();
      if (data.revealed) {
        set({ setupMasterKey: data.masterKey });
      }
      return data;
    } catch (err) {
      set({ setupError: err.message });
      return null;
    }
  },

  testSetupDatabase: async (config) => {
    set({ setupLoading: true, setupError: null });
    try {
      const result = await setupApi.testDatabase(config);
      set({ setupLoading: false });
      return result;
    } catch (err) {
      set({ setupLoading: false, setupError: err.message });
      return { success: false, message: err.message };
    }
  },

  saveSetupConfig: async (config) => {
    set({ setupLoading: true, setupError: null });
    try {
      const result = await setupApi.saveConfig(config);
      set({ setupLoading: false });
      return result;
    } catch (err) {
      set({ setupLoading: false, setupError: err.message });
      return { success: false };
    }
  },

  runSetupMigrations: async () => {
    set({ setupMigrationLogs: [], setupMigrationResult: null, setupLoading: true });
    await setupApi.runMigrations(
      (msg) => set((s) => ({ setupMigrationLogs: [...s.setupMigrationLogs, msg] })),
      (result) => set({ setupMigrationResult: result, setupLoading: false }),
      (errMsg) => set({ setupError: errMsg, setupLoading: false }),
    );
  },

  createSetupOwner: async (data) => {
    set({ setupLoading: true, setupError: null });
    try {
      const result = await setupApi.createOwner(data);
      set({ setupLoading: false });
      return result;
    } catch (err) {
      set({ setupLoading: false, setupError: err.message });
      return { error: err.message };
    }
  },

  completeSetup: async () => {
    set({ setupLoading: true });
    try {
      await setupApi.complete();
      set({ setupLoading: false });
      return { success: true };
    } catch (err) {
      set({ setupLoading: false, setupError: err.message });
      return { success: false };
    }
  },

  // Admin actions
  loadAdminConfig: async () => {
    set({ adminLoading: true, adminError: null });
    try {
      const config = await adminApi.getConfig();
      set({ adminConfig: config, adminLoading: false });
      return config;
    } catch (err) {
      set({ adminLoading: false, adminError: err.message });
      return null;
    }
  },

  loadAdminConfigSection: async (section) => {
    try {
      return await adminApi.getConfigSection(section);
    } catch (err) {
      set({ adminError: err.message });
      return null;
    }
  },

  updateAdminConfig: async (section, values) => {
    set({ adminLoading: true, adminError: null });
    try {
      const result = await adminApi.updateConfigSection(section, values);
      set({ adminLoading: false });
      // Reload full config to reflect changes
      const config = await adminApi.getConfig();
      set({ adminConfig: config });
      return result;
    } catch (err) {
      set({ adminLoading: false, adminError: err.message });
      return { error: err.message };
    }
  },

  testAdminConnection: async (type, overrides) => {
    set({ adminLoading: true });
    try {
      const result = await adminApi.testConnection(type, overrides);
      set({ adminLoading: false });
      return result;
    } catch (err) {
      set({ adminLoading: false });
      return { success: false, message: err.message };
    }
  },

  runAdminMigrations: async () => {
    set({ adminMigrationLogs: [], adminMigrationResult: null, adminLoading: true });
    await adminApi.runMigrations(
      (msg) => set((s) => ({ adminMigrationLogs: [...s.adminMigrationLogs, msg] })),
      (result) => set({ adminMigrationResult: result, adminLoading: false }),
      (errMsg) => set({ adminError: errMsg, adminLoading: false }),
    );
  },

  rotateAdminKey: async (keyType) => {
    set({ adminLoading: true, adminError: null });
    try {
      const result = await adminApi.rotateKey(keyType);
      set({ adminLoading: false });
      const config = await adminApi.getConfig();
      set({ adminConfig: config });
      return result;
    } catch (err) {
      set({ adminLoading: false, adminError: err.message });
      return { error: err.message };
    }
  },

  loadSystemInfo: async () => {
    try {
      const info = await adminApi.getSystemInfo();
      set({ adminSystemInfo: info });
      return info;
    } catch (err) {
      set({ adminError: err.message });
      return null;
    }
  },

  // Data migration actions
  testMigrationTarget: async (destConfig) => {
    set({ adminLoading: true, adminError: null });
    try {
      const result = await adminApi.testMigrationTarget(destConfig);
      set({ adminLoading: false });
      return result;
    } catch (err) {
      set({ adminLoading: false });
      return { success: false, message: err.message };
    }
  },

  startDataMigration: async (destConfig) => {
    set({ dataMigrationLogs: [], dataMigrationProgress: null, dataMigrationComplete: false, dataMigrationRunning: true });
    await adminApi.migrateData(
      destConfig,
      (progress) => set((s) => ({
        dataMigrationLogs: [...s.dataMigrationLogs, progress.message],
        dataMigrationProgress: progress,
      })),
      (result) => set({ dataMigrationComplete: true, dataMigrationRunning: false, dataMigrationProgress: result }),
      (errMsg) => set((s) => ({
        dataMigrationLogs: [...s.dataMigrationLogs, `ERROR: ${errMsg}`],
        dataMigrationRunning: false,
        adminError: errMsg,
      })),
    );
  },

  switchBackend: async (destConfig) => {
    set({ adminLoading: true, adminError: null });
    try {
      const result = await adminApi.switchBackend(destConfig);
      set({ adminLoading: false });
      return result;
    } catch (err) {
      set({ adminLoading: false, adminError: err.message });
      return { success: false, message: err.message };
    }
  },

  resetDataMigration: () => set({
    dataMigrationLogs: [],
    dataMigrationProgress: null,
    dataMigrationComplete: false,
    dataMigrationRunning: false,
  }),

  checkDbStatus: async () => {
    try {
      const status = await authApi.dbStatus();
      set({ emergencyDbStatus: status });
      return status;
    } catch (err) {
      set({ emergencyDbStatus: { dbReachable: false, userCount: 0, error: err.message } });
      return { dbReachable: false, userCount: 0 };
    }
  },

  emergencyCreateOwner: async (data) => {
    set({ adminLoading: true, adminError: null });
    try {
      const result = await authApi.emergencyCreateOwner(data);
      set({ adminLoading: false });
      return result;
    } catch (err) {
      set({ adminLoading: false, adminError: err.message });
      return { error: err.message };
    }
  },

  clearAdminError: () => set({ adminError: null }),
  clearSetupError: () => set({ setupError: null }),
});
