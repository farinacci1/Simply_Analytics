import React from 'react';
import { FiHelpCircle, FiX } from 'react-icons/fi';

export function KeyboardShortcutsPanel({ onClose }) {
  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-panel" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h3><FiHelpCircle /> Keyboard Shortcuts</h3>
          <button className="btn btn-icon" onClick={onClose}><FiX /></button>
        </div>
        <div className="shortcuts-body">
          <div className="shortcuts-section">
            <h4>General</h4>
            <div className="shortcut-row">
              <span className="shortcut-keys"><kbd>?</kbd></span>
              <span className="shortcut-desc">Toggle this panel</span>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-keys"><kbd>Esc</kbd></span>
              <span className="shortcut-desc">Close panel / Deselect widget</span>
            </div>
          </div>
          <div className="shortcuts-section">
            <h4>Editing</h4>
            <div className="shortcut-row">
              <span className="shortcut-keys"><kbd>⌘</kbd><kbd>Z</kbd></span>
              <span className="shortcut-desc">Undo</span>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-keys"><kbd>⌘</kbd><kbd>⇧</kbd><kbd>Z</kbd></span>
              <span className="shortcut-desc">Redo</span>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-keys"><kbd>⌘</kbd><kbd>S</kbd></span>
              <span className="shortcut-desc">Save dashboard</span>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-keys"><kbd>A</kbd></span>
              <span className="shortcut-desc">Add new widget</span>
            </div>
          </div>
          <div className="shortcuts-section">
            <h4>Widget Editing</h4>
            <div className="shortcut-row">
              <span className="shortcut-keys"><kbd>Delete</kbd></span>
              <span className="shortcut-desc">Delete selected widget</span>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-keys"><kbd>⌘</kbd><kbd>D</kbd></span>
              <span className="shortcut-desc">Duplicate selected widget</span>
            </div>
          </div>
        </div>
        <div className="shortcuts-footer">
          <span className="shortcuts-hint">Press <kbd>?</kbd> anytime to see shortcuts</span>
        </div>
      </div>
    </div>
  );
}
