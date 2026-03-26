import {
  authApi, connectionApi,
  persistSession, restoreSession, clearPersistedSession, persistLastDashboard, getLastDashboard,
} from '../../api/apiClient';
import { log } from '../storeUtils';

export const createAuthSlice = (set, get) => ({
  // Connection state (kept for data explorer backward compat)
  connection: null,
  connectionId: null,
  isConnecting: false,
  connectionError: null,

  // User / Role state
  currentUser: 'john.doe@company.com',
  currentRole: 'ANALYST',
  availableRoles: ['ACCOUNTADMIN', 'SYSADMIN', 'ANALYST', 'DATA_ENGINEER', 'VIEWER'],

  // Authentication state
  isAuthenticated: false,

  // User connections
  userConnections: [],
  loadingConnections: false,

  loadUserConnections: async () => {
    set({ loadingConnections: true });
    try {
      const response = await fetch('/api/connections', {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const connections = await response.json();
        set({ userConnections: connections, loadingConnections: false });
      } else {
        set({ userConnections: [], loadingConnections: false });
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
      set({ userConnections: [], loadingConnections: false });
    }
  },

  setCurrentRole: async (role, forceChange = false) => {
    if (!forceChange && get().hasUnsavedChanges) {
      return { blocked: true, reason: 'unsaved_changes' };
    }
    
    set({ currentRole: role, currentDashboard: null, dashboards: [], hasUnsavedChanges: false });
    try {
      await authApi.switchRole(role);
      await Promise.all([
        get().loadWarehouses(),
        get().loadSemanticViews(),
        get().loadDashboards(),
      ]);
    } catch (error) {
      console.warn('Failed to switch role on server:', error);
    }
    return { blocked: false };
  },

  signIn: async (credentials) => {
    const { username, password, forceLogin } = credentials;
    set({ isConnecting: true, connectionError: null });
    try {
      const response = await authApi.login(username, password, forceLogin);
      
      if (response.success && response.requires2FA) {
        set({ isConnecting: false });
        return {
          requires2FA: true,
          pendingToken: response.pendingToken,
          userId: response.userId,
          methods: response.methods,
          gracePeriodDaysRemaining: response.gracePeriodDaysRemaining,
        };
      }
      
      if (response.success) {
        get().completeSignIn(response, username);
        return response;
      } else {
        throw new Error(response.error || 'Authentication failed');
      }
    } catch (error) {
      set({ isConnecting: false, connectionError: error.message });
      throw error;
    }
  },

  completeSignIn: (response, username) => {
    persistSession(response.user, response.token);
    
    set({
      isAuthenticated: true,
      currentUser: response.user?.username || username,
      currentRole: response.user?.role || 'viewer',
      availableRoles: ['viewer', 'creator', 'admin', 'owner'],
      isConnecting: false,
      connectionError: null,
      currentDashboard: null,
      dashboards: [],
    });
    
    const userThemePref = response.user?.theme_preference;
    if (userThemePref) {
      const currentTheme = get().theme;
      if (currentTheme !== userThemePref) {
        document.documentElement.classList.add('theme-transition');
        localStorage.setItem('theme', userThemePref);
        document.documentElement.setAttribute('data-theme', userThemePref);
        set({ theme: userThemePref });
        setTimeout(() => {
          document.documentElement.classList.remove('theme-transition');
        }, 250);
      }
    } else {
      get().saveInitialThemeToBackend();
    }
    
    if (response.gracePeriodWarning) {
      console.warn('MFA Grace Period Warning:', response.gracePeriodWarning);
    }
    
    get().loadDashboards();
    get().loadUserConnections();
  },

  complete2FASignIn: async (response) => {
    if (response.success && response.token) {
      get().completeSignIn(response, response.user?.username);
      return { success: true };
    }
    throw new Error('MFA verification failed');
  },

  signInWithKeyPair: async (credentials) => {
    const { account, username, privateKey, privateKeyPassphrase } = credentials;
    set({ isLoading: true });
    try {
      const response = await authApi.loginWithKeyPair(account, username, privateKey, privateKeyPassphrase);
      if (response.success) {
        persistSession(response.user, response.token);
        
        set({
          isAuthenticated: true,
          currentUser: response.user?.username || username,
          currentRole: response.user?.role || 'PUBLIC',
          availableRoles: response.roles || [],
          isLoading: false,
          currentDashboard: null,
          dashboards: [],
        });
        get().loadWarehouses();
        get().loadSemanticViews();
        get().loadDashboards();
        return response;
      } else {
        throw new Error(response.error || 'Authentication failed');
      }
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signInWithPAT: async (credentials) => {
    const { account, username, token } = credentials;
    set({ isLoading: true });
    try {
      const response = await authApi.loginWithPAT(account, username, token);
      if (response.success) {
        persistSession(response.user, response.token);
        
        set({
          isAuthenticated: true,
          currentUser: response.user?.username || username,
          currentRole: response.user?.role || 'PUBLIC',
          availableRoles: response.roles || [],
          isLoading: false,
          currentDashboard: null,
          dashboards: [],
        });
        get().loadWarehouses();
        get().loadSemanticViews();
        get().loadDashboards();
        return response;
      } else {
        throw new Error(response.error || 'Authentication failed');
      }
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.warn('Logout error:', error);
    }
    
    clearPersistedSession();
    
    set({ 
      isAuthenticated: false,
      currentUser: null, 
      currentRole: null,
      availableRoles: [],
      activeView: 'home',
      dashboards: [],
      currentDashboard: null,
      currentTabId: null,
      semanticModels: [],
    });
  },

  initializeApp: async () => {
    const { isInitialized } = get();
    if (isInitialized) return;

    set({ isLoading: true });

    const savedSession = restoreSession();
    if (savedSession?.token && savedSession?.user) {
      try {
        const validation = await authApi.validate();
        if (validation.valid) {
          log('Restored session for user:', savedSession.user.username);
          
          const rolesResponse = await authApi.getRoles();
          
          set({
            isInitialized: true,
            isLoading: false,
            isAuthenticated: true,
            currentUser: savedSession.user.username,
            currentRole: savedSession.user.role,
            availableRoles: rolesResponse.roles || [],
          });
          
          const dashboards = await get().loadDashboards();
          get().loadUserConnections();
          
          const { dashboardLoadError } = get();
          if (!dashboardLoadError) {
            const lastDashboardId = getLastDashboard();
            if (lastDashboardId && dashboards.some(d => d.id === lastDashboardId)) {
              get().loadDashboard(lastDashboardId);
            }
          }
          
          return;
        }
      } catch (error) {
        console.warn('Failed to restore session:', error);
        clearPersistedSession();
      }
    }

    set({
      isInitialized: true,
      isLoading: false,
      isAuthenticated: false,
    });
  },

  connectSnowflake: async (credentials) => {
    set({ isConnecting: true, connectionError: null });

    try {
      const result = await authApi.login(credentials);
      
      if (result.success) {
        persistSession(result.token, {
          username: result.user.username,
          role: result.user.role,
        });
        
        const rolesResponse = await authApi.getRoles();
        
        set({
          isConnecting: false,
          isAuthenticated: true,
          connectionId: result.connectionId,
          currentUser: result.user.username,
          currentRole: result.user.role,
          availableRoles: rolesResponse.roles || [],
        });
        
        get().loadWarehouses();
        get().loadSemanticViews();
        get().loadDashboards();
        
        return { success: true };
      } else {
        set({
          isConnecting: false,
          connectionError: result.error || 'Connection failed',
        });
        return { success: false, error: result.error };
      }
    } catch (error) {
      set({
        isConnecting: false,
        connectionError: error.message,
      });
      return { success: false, error: error.message };
    }
  },

  disconnect: async () => {
    const { connectionId } = get();
    if (connectionId) {
      try {
        await authApi.logout();
      } catch (e) {
        console.warn('Logout failed:', e);
      }
    }
    clearPersistedSession();
    set({
      isAuthenticated: false,
      connectionId: null,
      connection: null,
      currentDashboard: null,
      currentTabId: null,
      dashboards: [],
      semanticModels: [],
      databases: [],
      schemas: [],
      tables: [],
      columns: [],
      selectedDatabase: null,
      selectedSchema: null,
      selectedTable: null,
      currentUser: null,
      currentRole: null,
      activeView: 'home',
    });
  },
});
