import React from 'react';

const TitleWidget = ({ config, title, isEditing, isEditMode }) => {
  const titleText = config?.titleText || title || 'Dashboard Title';
  const subtitle = config?.subtitle || '';
  const align = config?.titleAlign || 'left';
  const fontSize = config?.titleFontSize || 24;

  return (
    <div className="title-widget-content" style={{ textAlign: align }}>
      <div className="title-widget-heading" style={{ fontSize }}>{titleText}</div>
      {subtitle && <div className="title-widget-subtitle">{subtitle}</div>}
      {(isEditing || isEditMode) && !titleText && (
        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Click to configure title text
        </span>
      )}
    </div>
  );
};

export default TitleWidget;
