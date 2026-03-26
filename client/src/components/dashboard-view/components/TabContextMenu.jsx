import React from 'react';
import { FiEdit3, FiGrid, FiTrash2, FiX } from 'react-icons/fi';
import { TAB_COLORS } from '../hooks/useTabManagement';

export function TabContextMenu({
  currentDashboard,
  tabContextMenu,
  tabContextMenuRef,
  handleRenameTab,
  handleDuplicateTab,
  handleDeleteTab,
  previewTabColor,
  previewCanvasColor,
  handlePreviewTabColor,
  handleApplyTabColor,
  handlePreviewCanvasColor,
  handleApplyCanvasColor,
  handleQuickSetTabColor,
  handleQuickSetCanvasColor,
}) {
  const selectedTab = currentDashboard.tabs?.find(t => t.id === tabContextMenu.tabId);

  return (
    <div
      ref={tabContextMenuRef}
      className="tab-context-menu"
      style={{ left: tabContextMenu.x, bottom: window.innerHeight - tabContextMenu.y + 10 }}
    >
      <button onClick={handleRenameTab}><FiEdit3 /> Rename</button>
      <button onClick={handleDuplicateTab}><FiGrid /> Duplicate</button>
      <div className="context-menu-divider" />

      {/* Tab Color */}
      <div className="color-picker-section">
        <span className="color-picker-label">Tab Color</span>
        <div className="color-picker-grid">
          {TAB_COLORS.map((color, idx) => (
            <button
              key={idx}
              className={`color-swatch ${color === null ? 'no-color' : ''} ${selectedTab?.backgroundColor === color ? 'selected' : ''}`}
              style={{ backgroundColor: color || 'transparent' }}
              onClick={() => handleQuickSetTabColor(color)}
              title={color || 'No color'}
            >
              {color === null && <FiX />}
            </button>
          ))}
        </div>
        <div className="color-picker-custom">
          <input
            type="color"
            value={previewTabColor || selectedTab?.backgroundColor || '#3b82f6'}
            onChange={(e) => handlePreviewTabColor(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="color-input"
          />
          <span className="color-preview-text" style={{ color: previewTabColor || selectedTab?.backgroundColor || '#888' }}>
            {previewTabColor || selectedTab?.backgroundColor || 'Custom'}
          </span>
          {previewTabColor && <button className="color-apply-btn" onClick={handleApplyTabColor}>Apply</button>}
        </div>
      </div>

      {/* Canvas Background */}
      <div className="color-picker-section">
        <span className="color-picker-label">Canvas Background</span>
        <div className="color-picker-grid">
          {TAB_COLORS.map((color, idx) => (
            <button
              key={idx}
              className={`color-swatch ${color === null ? 'no-color' : ''} ${selectedTab?.canvasColor === color ? 'selected' : ''}`}
              style={{ backgroundColor: color || 'transparent' }}
              onClick={() => handleQuickSetCanvasColor(color)}
              title={color || 'No color'}
            >
              {color === null && <FiX />}
            </button>
          ))}
        </div>
        <div className="color-picker-custom">
          <input
            type="color"
            value={previewCanvasColor || selectedTab?.canvasColor || '#3b82f6'}
            onChange={(e) => handlePreviewCanvasColor(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="color-input"
          />
          <span className="color-preview-text" style={{ color: previewCanvasColor || selectedTab?.canvasColor || '#888' }}>
            {previewCanvasColor || selectedTab?.canvasColor || 'Custom'}
          </span>
          {previewCanvasColor && <button className="color-apply-btn" onClick={handleApplyCanvasColor}>Apply</button>}
        </div>
      </div>

      <div className="context-menu-divider" />
      <button onClick={handleDeleteTab} className="danger" disabled={currentDashboard.tabs?.length <= 1}>
        <FiTrash2 /> Delete
      </button>
    </div>
  );
}
