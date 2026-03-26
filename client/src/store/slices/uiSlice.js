export const createUiSlice = (set) => ({
  activeView: 'home',
  sidebarOpen: true,
  isLoading: false,
  isInitialized: false,
  
  editingWidgetConfig: null,
  
  setEditingWidgetConfig: (config) => set({ editingWidgetConfig: config }),
  clearEditingWidgetConfig: () => set({ editingWidgetConfig: null }),
  
  setActiveView: (view) => set({ activeView: view }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
});
