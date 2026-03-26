/**
 * Simply Analytics - API Client
 *
 * Re-exports modular API clients from ./modules/
 */

export { isNetworkPolicyError } from './modules/fetchCore.js';

export { dashboardApi } from './modules/dashboardApi.js';
export { semanticApi } from './modules/semanticApi.js';
export { connectionApi } from './modules/connectionApi.js';
export { queryApi } from './modules/queryApi.js';
export { authApi } from './modules/authApi.js';
export { twoFactorApi } from './modules/twoFactorApi.js';
export { userApi } from './modules/userApi.js';
export { sfConnectionApi } from './modules/sfConnectionApi.js';
export { groupApi } from './modules/groupApi.js';
export { folderApi } from './modules/folderApi.js';
export { dashboardAiApi } from './modules/dashboardAiApi.js';

export {
  startSessionMonitoring,
  stopSessionMonitoring,
  keepSessionAlive,
  persistSession,
  restoreSession,
  clearPersistedSession,
  persistLastDashboard,
  getLastDashboard,
  setSnowflakeErrorCallback,
} from './modules/sessionManager.js';

import { dashboardApi } from './modules/dashboardApi.js';
import { dashboardAiApi } from './modules/dashboardAiApi.js';
import { semanticApi } from './modules/semanticApi.js';
import { connectionApi } from './modules/connectionApi.js';
import { sfConnectionApi } from './modules/sfConnectionApi.js';
import { queryApi } from './modules/queryApi.js';
import { authApi } from './modules/authApi.js';
import { twoFactorApi } from './modules/twoFactorApi.js';
import { userApi } from './modules/userApi.js';
import { groupApi } from './modules/groupApi.js';
import { folderApi } from './modules/folderApi.js';
import {
  startSessionMonitoring,
  stopSessionMonitoring,
  keepSessionAlive,
  persistSession,
  restoreSession,
  clearPersistedSession,
  persistLastDashboard,
  getLastDashboard,
} from './modules/sessionManager.js';

const api = {
  dashboard: dashboardApi,
  dashboardAi: dashboardAiApi,
  semantic: semanticApi,
  connection: connectionApi,
  sfConnection: sfConnectionApi,
  query: queryApi,
  auth: authApi,
  twoFactor: twoFactorApi,
  user: userApi,
  group: groupApi,
  folder: folderApi,
  startSessionMonitoring,
  stopSessionMonitoring,
  keepSessionAlive,
  persistSession,
  restoreSession,
  clearPersistedSession,
  persistLastDashboard,
  getLastDashboard,
};

export default api;
