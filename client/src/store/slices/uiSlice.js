export const createUiSlice = (set) => ({
  activeView: 'home',
  isLoading: false,
  isInitialized: false,
  
  editingWidgetConfig: null,
  
  clearEditingWidgetConfig: () => set({ editingWidgetConfig: null }),
  
  setActiveView: (view) => set({ activeView: view }),
});
