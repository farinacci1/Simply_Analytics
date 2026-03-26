import { userApi } from '../../api/apiClient';

export const createThemeSlice = (set, get) => ({
  theme: localStorage.getItem('theme') || 'light',
  
  setTheme: async (theme) => {
    document.documentElement.classList.add('theme-transition');
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 250);
    
    if (get().isAuthenticated) {
      try {
        await userApi.updateTheme(theme);
      } catch (err) {
        console.warn('Failed to save theme preference:', err.message);
      }
    }
  },
  
  toggleTheme: async () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.add('theme-transition');
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    set({ theme: newTheme });
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 250);
    
    if (get().isAuthenticated) {
      try {
        await userApi.updateTheme(newTheme);
      } catch (err) {
        console.warn('Failed to save theme preference:', err.message);
      }
    }
  },
  
  loadThemeFromBackend: async () => {
    try {
      const { theme } = await userApi.getTheme();
      if (theme) {
        document.documentElement.classList.add('theme-transition');
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
        setTimeout(() => {
          document.documentElement.classList.remove('theme-transition');
        }, 250);
      }
    } catch (err) {
      console.warn('Failed to load theme preference:', err.message);
    }
  },
  
  saveInitialThemeToBackend: async () => {
    const currentTheme = get().theme;
    try {
      await userApi.updateTheme(currentTheme);
    } catch (err) {
      console.warn('Failed to save initial theme preference:', err.message);
    }
  },
});
