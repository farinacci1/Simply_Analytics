import React from 'react';
import { FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';

export function TabBar({
  currentDashboard,
  currentTabId,
  setCurrentTab,
  addTab,
  isEditMode,
  tabListRef,
  tabOverflow,
  checkTabOverflow,
  scrollTabs,
  editingTabId,
  editedTabTitle,
  setEditedTabTitle,
  setEditingTabId,
  saveTabTitle,
  handleTabTitleKeyDown,
  handleTabContextMenu,
}) {
  return (
    <div className="tab-bar">
      {(tabOverflow.left || tabOverflow.right) && (
        <button className="tab-nav-btn" onClick={() => scrollTabs('left')} disabled={!tabOverflow.left} title="Previous tabs">
          <FiChevronLeft />
        </button>
      )}

      <div className={`tab-list-wrapper ${tabOverflow.left ? 'has-overflow-left' : ''} ${tabOverflow.right ? 'has-overflow-right' : ''}`}>
        <div className="tab-list" ref={tabListRef} onScroll={checkTabOverflow}>
          {currentDashboard.tabs
            ?.filter(tab => isEditMode || (tab.widgets && tab.widgets.length > 0))
            .map((tab) => (
              <div
                key={tab.id}
                className={`tab-item ${tab.id === currentTabId ? 'active' : ''} ${tab.backgroundColor ? 'has-color' : ''}`}
                style={{
                  '--tab-bg-color': tab.backgroundColor || 'transparent',
                  '--tab-color': tab.backgroundColor || 'var(--accent-primary)'
                }}
                onClick={() => setCurrentTab(tab.id)}
                onContextMenu={isEditMode ? (e) => handleTabContextMenu(e, tab.id) : undefined}
                onDoubleClick={isEditMode ? () => { setEditingTabId(tab.id); setEditedTabTitle(tab.title); } : undefined}
              >
                {editingTabId === tab.id ? (
                  <input
                    type="text"
                    className="tab-title-input"
                    value={editedTabTitle}
                    onChange={(e) => setEditedTabTitle(e.target.value)}
                    onBlur={saveTabTitle}
                    onKeyDown={handleTabTitleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span className="tab-title">{tab.title}</span>
                )}
              </div>
            ))}
          {isEditMode && (
            <button className="tab-add-btn" onClick={() => addTab()} title="Add new sheet">
              <FiPlus />
            </button>
          )}
        </div>
      </div>

      {(tabOverflow.left || tabOverflow.right) && (
        <button className="tab-nav-btn" onClick={() => scrollTabs('right')} disabled={!tabOverflow.right} title="More tabs">
          <FiChevronRight />
        </button>
      )}
    </div>
  );
}
