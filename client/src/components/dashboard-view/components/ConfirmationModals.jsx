import React from 'react';
import { FiSave } from 'react-icons/fi';
import { useAppStore } from '../../../store/appStore';

export function ExitEditConfirmModal({ onClose, loadDashboard, currentDashboard, saveDashboard, setIsEditMode }) {
  return (
    <div className="modal-overlay">
      <div className="modal exit-edit-modal">
        <div className="modal-header">
          <h2 className="modal-title"><span className="warning-icon">⚠️</span> Unsaved Changes</h2>
        </div>
        <div className="modal-body">
          <p>You have unsaved changes to this dashboard.</p>
          <p className="modal-hint">What would you like to do?</p>
        </div>
        <div className="modal-footer exit-edit-footer">
          <button className="btn btn-secondary" onClick={onClose}>Continue Editing</button>
          <button
            className="btn btn-danger"
            onClick={async () => {
              onClose();
              if (currentDashboard?.id) await loadDashboard(currentDashboard.id);
              setIsEditMode(false);
            }}
          >
            Don't Save
          </button>
          <button
            className="btn btn-save"
            onClick={async () => {
              onClose();
              await saveDashboard();
              setIsEditMode(false);
            }}
          >
            <FiSave /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export function BackConfirmModal({ onClose, currentDashboard, saveDashboard, navigate }) {
  return (
    <div className="modal-overlay">
      <div className="modal exit-edit-modal">
        <div className="modal-header">
          <h2 className="modal-title"><span className="warning-icon">⚠️</span> Unsaved Changes</h2>
        </div>
        <div className="modal-body">
          <p>You have unsaved changes to this dashboard.</p>
          <p className="modal-hint">If you leave now, your changes will be lost.</p>
        </div>
        <div className="modal-footer exit-edit-footer">
          <button className="btn btn-secondary" onClick={onClose}>Stay</button>
          <button
            className="btn btn-danger"
            onClick={() => {
              onClose();
              const store = useAppStore.getState();
              store.clearUnsavedChanges();
              const folderId = currentDashboard?.folder_id;
              const base = `/workspaces/${store.activeWorkspace?.id}/dashboards`;
              navigate(folderId ? `${base}?folder=${folderId}` : base);
            }}
          >
            Leave Without Saving
          </button>
          <button
            className="btn btn-save"
            onClick={async () => {
              onClose();
              await saveDashboard();
              const folderId = currentDashboard?.folder_id;
              const base = `/workspaces/${useAppStore.getState().activeWorkspace?.id}/dashboards`;
              navigate(folderId ? `${base}?folder=${folderId}` : base);
            }}
          >
            <FiSave /> Save & Leave
          </button>
        </div>
      </div>
    </div>
  );
}
