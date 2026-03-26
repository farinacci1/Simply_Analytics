import { useState, useRef, useCallback, useEffect } from 'react';

export const TAB_COLORS = [
  null,
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

/**
 * Encapsulates all tab management state and handlers:
 * context menu, rename, delete, duplicate, color picking, and overflow navigation.
 */
export function useTabManagement({ currentDashboard, updateTab, removeTab, duplicateTab, isEditMode, setDeleteConfirm }) {
  const [tabContextMenu, setTabContextMenu] = useState({ open: false, x: 0, y: 0, tabId: null });
  const [editingTabId, setEditingTabId] = useState(null);
  const [editedTabTitle, setEditedTabTitle] = useState('');
  const [showTabColorPicker, setShowTabColorPicker] = useState(null);
  const [previewTabColor, setPreviewTabColor] = useState(null);
  const [previewCanvasColor, setPreviewCanvasColor] = useState(null);
  const tabContextMenuRef = useRef(null);
  const tabListRef = useRef(null);
  const [tabOverflow, setTabOverflow] = useState({ left: false, right: false });

  // Close tab context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tabContextMenuRef.current && !tabContextMenuRef.current.contains(e.target)) {
        setTabContextMenu({ open: false, x: 0, y: 0, tabId: null });
      }
    };
    if (tabContextMenu.open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [tabContextMenu.open]);

  // Tab list overflow detection
  const checkTabOverflow = useCallback(() => {
    if (!tabListRef.current) return;
    const el = tabListRef.current;
    const hasOverflowLeft = el.scrollLeft > 0;
    const hasOverflowRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
    setTabOverflow({ left: hasOverflowLeft, right: hasOverflowRight });
  }, []);

  useEffect(() => {
    checkTabOverflow();
    window.addEventListener('resize', checkTabOverflow);
    return () => window.removeEventListener('resize', checkTabOverflow);
  }, [currentDashboard?.tabs, checkTabOverflow]);

  const scrollTabs = (direction) => {
    if (!tabListRef.current) return;
    tabListRef.current.scrollBy({
      left: direction === 'left' ? -150 : 150,
      behavior: 'smooth'
    });
    setTimeout(checkTabOverflow, 300);
  };

  const handleTabContextMenu = (e, tabId) => {
    e.preventDefault();
    setTabContextMenu({ open: true, x: e.clientX, y: e.clientY, tabId });
  };

  const handleRenameTab = () => {
    const tab = currentDashboard?.tabs?.find(t => t.id === tabContextMenu.tabId);
    if (tab) {
      setEditingTabId(tabContextMenu.tabId);
      setEditedTabTitle(tab.title);
    }
    setTabContextMenu({ open: false, x: 0, y: 0, tabId: null });
  };

  const saveTabTitle = () => {
    if (editingTabId && editedTabTitle.trim()) {
      const tab = currentDashboard?.tabs?.find(t => t.id === editingTabId);
      if (tab && tab.title !== editedTabTitle.trim()) {
        updateTab(editingTabId, { title: editedTabTitle.trim() });
      }
    }
    setEditingTabId(null);
    setEditedTabTitle('');
  };

  const handleTabTitleKeyDown = (e) => {
    if (e.key === 'Enter') saveTabTitle();
    else if (e.key === 'Escape') {
      setEditingTabId(null);
      setEditedTabTitle('');
    }
  };

  const handleDeleteTab = () => {
    if (tabContextMenu.tabId) {
      const tabToDelete = currentDashboard?.tabs?.find(t => t.id === tabContextMenu.tabId);
      if (tabToDelete) {
        setDeleteConfirm({
          open: true,
          itemName: tabToDelete.title || 'Untitled Tab',
          itemType: 'tab',
          onConfirm: () => {
            removeTab(tabContextMenu.tabId);
            setDeleteConfirm({ open: false, itemName: '', itemType: '', onConfirm: null });
          }
        });
      }
    }
    setTabContextMenu({ open: false, x: 0, y: 0, tabId: null });
  };

  const handleDuplicateTab = () => {
    if (tabContextMenu.tabId) duplicateTab(tabContextMenu.tabId);
    setTabContextMenu({ open: false, x: 0, y: 0, tabId: null });
  };

  const handlePreviewTabColor = (color) => setPreviewTabColor(color);
  const handleApplyTabColor = () => {
    if (tabContextMenu.tabId && previewTabColor !== null) {
      updateTab(tabContextMenu.tabId, { backgroundColor: previewTabColor });
    }
    setPreviewTabColor(null);
  };

  const handlePreviewCanvasColor = (color) => setPreviewCanvasColor(color);
  const handleApplyCanvasColor = () => {
    if (tabContextMenu.tabId && previewCanvasColor !== null) {
      updateTab(tabContextMenu.tabId, { canvasColor: previewCanvasColor });
    }
    setPreviewCanvasColor(null);
  };

  const handleQuickSetTabColor = (color) => {
    if (tabContextMenu.tabId) updateTab(tabContextMenu.tabId, { backgroundColor: color });
    setPreviewTabColor(null);
    setTabContextMenu({ open: false, x: 0, y: 0, tabId: null });
  };

  const handleQuickSetCanvasColor = (color) => {
    if (tabContextMenu.tabId) updateTab(tabContextMenu.tabId, { canvasColor: color });
    setPreviewCanvasColor(null);
    setTabContextMenu({ open: false, x: 0, y: 0, tabId: null });
  };

  return {
    tabContextMenu, setTabContextMenu,
    editingTabId, setEditingTabId,
    editedTabTitle, setEditedTabTitle,
    showTabColorPicker, setShowTabColorPicker,
    previewTabColor, previewCanvasColor,
    tabContextMenuRef, tabListRef, tabOverflow,
    checkTabOverflow, scrollTabs,
    handleTabContextMenu, handleRenameTab, saveTabTitle, handleTabTitleKeyDown,
    handleDeleteTab, handleDuplicateTab,
    handlePreviewTabColor, handleApplyTabColor,
    handlePreviewCanvasColor, handleApplyCanvasColor,
    handleQuickSetTabColor, handleQuickSetCanvasColor,
  };
}
