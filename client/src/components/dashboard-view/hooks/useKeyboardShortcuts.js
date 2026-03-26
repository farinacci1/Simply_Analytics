import { useEffect } from 'react';

/**
 * Handles keyboard shortcuts for the dashboard view.
 */
export function useKeyboardShortcuts({
  isEditMode,
  canUndo,
  canRedo,
  undo,
  redo,
  hasUnsavedChanges,
  saveDashboard,
  isSaving,
  showShortcuts,
  setShowShortcuts,
  editingWidget,
  showSettings,
  setShowSettings,
  setExitEditConfirm,
  setIsEditMode,
  handleDeselectWidget,
  handleOpenNewWidget,
  handleSaveWithAnimation,
}) {
  // Primary shortcut handler (undo/redo/save/add/escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey && e.key === 'z' && !e.shiftKey && isEditMode) {
        e.preventDefault();
        if (canUndo()) undo();
        return;
      }

      if ((cmdKey && e.key === 'z' && e.shiftKey) || (cmdKey && e.key === 'y')) {
        e.preventDefault();
        if (isEditMode && canRedo()) redo();
        return;
      }

      if (cmdKey && e.key === 's' && isEditMode) {
        e.preventDefault();
        if (hasUnsavedChanges) saveDashboard();
        return;
      }

      if ((e.key === '?' || (e.key === '/' && e.shiftKey)) && !cmdKey) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        return;
      }

      if (e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
        } else if (editingWidget) {
          handleDeselectWidget();
        }
        return;
      }

      if (e.key === 'a' && isEditMode && !editingWidget && !cmdKey) {
        e.preventDefault();
        handleOpenNewWidget();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, canUndo, canRedo, undo, redo, hasUnsavedChanges, saveDashboard, showShortcuts, editingWidget, setShowShortcuts, handleDeselectWidget, handleOpenNewWidget, handleSaveWithAnimation]);

  // Secondary shortcut handler (Ctrl+S save, Escape close modals)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isEditMode && hasUnsavedChanges && !isSaving) saveDashboard();
      }

      if (e.key === 'Escape' && !isTyping) {
        if (editingWidget) return;
        if (showSettings) {
          setShowSettings(false);
          return;
        }
        if (isEditMode && !hasUnsavedChanges) {
          setIsEditMode(false);
        } else if (isEditMode && hasUnsavedChanges) {
          setExitEditConfirm(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, hasUnsavedChanges, isSaving, saveDashboard, editingWidget, showSettings, setShowSettings, setIsEditMode, setExitEditConfirm]);
}
