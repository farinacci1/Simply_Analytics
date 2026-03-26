export const createColorSchemeSlice = (set, get) => ({
  savedColorSchemes: [],
  colorPalettes: null,

  generateSchemeId: () => {
    return 'cs_' + crypto.randomUUID();
  },

  getDashboardColorSchemes: () => {
    const { currentDashboard } = get();
    return currentDashboard?.customColorSchemes || [];
  },

  isColorSchemeInUse: (schemeId) => {
    const { currentDashboard } = get();
    if (!currentDashboard?.tabs) return false;
    
    for (const tab of currentDashboard.tabs) {
      for (const widget of (tab.widgets || [])) {
        if (widget.config?.customScheme?.id === schemeId) {
          return true;
        }
      }
    }
    return false;
  },

  getWidgetsUsingScheme: (schemeId) => {
    const { currentDashboard } = get();
    if (!currentDashboard?.tabs) return [];
    
    const widgets = [];
    for (const tab of currentDashboard.tabs) {
      for (const widget of (tab.widgets || [])) {
        if (widget.config?.customScheme?.id === schemeId) {
          widgets.push({ widget, tabId: tab.id, tabName: tab.name });
        }
      }
    }
    return widgets;
  },

  saveColorScheme: (scheme) => {
    const { currentDashboard } = get();
    if (!currentDashboard) {
      console.warn('No dashboard loaded - cannot save color scheme');
      return null;
    }

    const existingSchemes = currentDashboard.customColorSchemes || [];
    
    const schemeWithId = {
      ...scheme,
      id: scheme.id || get().generateSchemeId(),
      createdAt: scheme.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const nameExists = existingSchemes.some(s => 
      s.id !== schemeWithId.id && 
      s.name.toLowerCase() === schemeWithId.name.toLowerCase()
    );
    
    if (nameExists) {
      let counter = 1;
      let newName = `${schemeWithId.name} (${counter})`;
      while (existingSchemes.some(s => s.name.toLowerCase() === newName.toLowerCase())) {
        counter++;
        newName = `${schemeWithId.name} (${counter})`;
      }
      schemeWithId.name = newName;
    }
    
    const existingIndex = existingSchemes.findIndex(s => s.id === schemeWithId.id);
    let updated;
    if (existingIndex >= 0) {
      updated = [...existingSchemes];
      updated[existingIndex] = schemeWithId;
    } else {
      updated = [...existingSchemes, schemeWithId];
    }
    
    set((state) => ({
      currentDashboard: {
        ...state.currentDashboard,
        customColorSchemes: updated,
      },
      hasUnsavedChanges: true,
    }));
    
    return schemeWithId;
  },

  deleteColorScheme: (schemeId) => {
    const { currentDashboard, isColorSchemeInUse, getWidgetsUsingScheme } = get();
    if (!currentDashboard) return { success: false, error: 'No dashboard loaded' };
    
    if (isColorSchemeInUse(schemeId)) {
      const widgets = getWidgetsUsingScheme(schemeId);
      const widgetNames = widgets.map(w => w.widget.title || w.widget.id).join(', ');
      return { 
        success: false, 
        error: `Cannot delete: scheme is in use by widgets: ${widgetNames}`,
        widgetsInUse: widgets,
      };
    }
    
    const existingSchemes = currentDashboard.customColorSchemes || [];
    const updated = existingSchemes.filter(s => s.id !== schemeId);
    
    set((state) => ({
      currentDashboard: {
        ...state.currentDashboard,
        customColorSchemes: updated,
      },
      hasUnsavedChanges: true,
    }));
    
    return { success: true };
  },

  loadColorSchemes: async () => {
    // Color schemes are now loaded with the dashboard — kept for backwards compatibility
  },

  getColorPalettes: () => {
    const { colorPalettes } = get();
    return colorPalettes || { palettes: {}, default: 'ocean' };
  },
});
