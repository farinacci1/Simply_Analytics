import React from 'react';
import { FiUpload, FiDownload, FiCopy, FiCheck, FiAlertCircle, FiCode } from 'react-icons/fi';

export function YamlTab({
  yamlContent,
  yamlCopied,
  importError,
  importSuccess,
  pendingYamlImport,
  fileInputRef,
  handleCopyYaml,
  handleDownloadYaml,
  handleFileUpload,
}) {
  return (
    <div className="settings-section yaml-section">
      <p className="section-description">
        Export the dashboard configuration as YAML or import from a file.
        <strong className="yaml-live-notice"> The preview below reflects the current state including any unsaved changes.</strong>
      </p>

      {/* Import/Export buttons */}
      <div className="yaml-actions">
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".yaml,.yml" style={{ display: 'none' }} />
        <button type="button" className="btn btn-secondary yaml-btn" onClick={() => fileInputRef.current?.click()}>
          <FiUpload /> Import YAML
        </button>
        <button type="button" className="btn btn-secondary yaml-btn" onClick={handleDownloadYaml}>
          <FiDownload /> Export YAML
        </button>
        <button type="button" className="btn btn-secondary yaml-btn" onClick={handleCopyYaml}>
          {yamlCopied ? (
            <>
              <FiCheck /> Copied!
            </>
          ) : (
            <>
              <FiCopy /> Copy to Clipboard
            </>
          )}
        </button>
      </div>

      {/* Status messages */}
      {importError && (
        <div className="yaml-message error">
          <FiAlertCircle /> {importError}
        </div>
      )}
      {importSuccess && pendingYamlImport && (
        <div className="yaml-message success">
          <FiCheck /> YAML parsed successfully! Click "Save Settings" to apply changes.
        </div>
      )}

      {/* YAML Preview */}
      <div className="yaml-preview-container">
        <div className="yaml-preview-header">
          <span className="yaml-preview-title">
            <FiCode /> Dashboard YAML Preview
          </span>
          <span className="yaml-live-badge">Live Preview</span>
        </div>
        <pre className="yaml-preview">
          <code>{yamlContent || '# Loading...'}</code>
        </pre>
      </div>

      <div className="yaml-info">
        <h4>About YAML Import/Export</h4>
        <ul>
          <li>
            <strong>Export:</strong> Download the current dashboard configuration including all tabs, widgets, and settings.
          </li>
          <li>
            <strong>Import:</strong> Upload a YAML file to replace the current dashboard configuration. Changes will be applied locally and must be
            saved.
          </li>
          <li>
            <strong>Live Preview:</strong> The preview above shows the current state in real-time, including any unsaved edits you've made.
          </li>
        </ul>
      </div>
    </div>
  );
}
