import { useState, useRef } from 'react';

/**
 * Manages inline dashboard title editing with auto-save.
 */
export function useTitleEditor({ currentDashboard, updateDashboard, isEditMode }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef(null);
  const titleSaveTimerRef = useRef(null);

  const handleTitleDoubleClick = () => {
    if (!isEditMode || !currentDashboard) return;
    setEditedTitle(currentDashboard.name);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 10);
  };

  const saveTitleChange = (newTitle) => {
    if (titleSaveTimerRef.current) {
      clearTimeout(titleSaveTimerRef.current);
      titleSaveTimerRef.current = null;
    }
    if (currentDashboard && newTitle && newTitle.trim() && newTitle.trim() !== currentDashboard.name) {
      updateDashboard(currentDashboard.id, { name: newTitle.trim() });
    }
    setEditingTitle(false);
    setEditedTitle('');
  };

  const handleTitleChange = (e) => {
    const newValue = e.target.value;
    setEditedTitle(newValue);
    if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
    titleSaveTimerRef.current = setTimeout(() => saveTitleChange(newValue), 1500);
  };

  const handleTitleBlur = () => saveTitleChange(editedTitle);

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') saveTitleChange(editedTitle);
    else if (e.key === 'Escape') cancelTitleEdit();
  };

  const cancelTitleEdit = () => {
    setEditingTitle(false);
    setEditedTitle('');
    if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
  };

  return {
    editingTitle, editedTitle, titleInputRef,
    handleTitleDoubleClick, handleTitleChange, handleTitleBlur,
    handleTitleKeyDown, cancelTitleEdit,
  };
}
