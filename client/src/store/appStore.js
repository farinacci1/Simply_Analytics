import { create } from 'zustand';
import { createAuthSlice } from './slices/authSlice';
import { createThemeSlice } from './slices/themeSlice';
import { createUiSlice } from './slices/uiSlice';
import { createDataBrowserSlice } from './slices/dataBrowserSlice';
import { createSemanticSlice } from './slices/semanticSlice';
import { createDashboardSlice } from './slices/dashboardSlice';
import { createColorSchemeSlice } from './slices/colorSchemeSlice';

export const useAppStore = create((...a) => ({
  ...createAuthSlice(...a),
  ...createThemeSlice(...a),
  ...createUiSlice(...a),
  ...createDataBrowserSlice(...a),
  ...createSemanticSlice(...a),
  ...createDashboardSlice(...a),
  ...createColorSchemeSlice(...a),
}));
