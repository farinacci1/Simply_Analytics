import { useState, useRef, useEffect } from 'react';
import { FiSend, FiSquare } from 'react-icons/fi';

const MAX_LENGTH = 4000;
const WARN_THRESHOLD = 3600;

export default function ChatInput({ onSend, disabled, placeholder, onStop, isStreaming }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [value]);

  const handleChange = (e) => {
    const v = e.target.value;
    if (v.length <= MAX_LENGTH) setValue(v);
  };

  const handleSubmit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const remaining = MAX_LENGTH - value.length;
  const showCounter = value.length >= WARN_THRESHOLD;
  const isOver = remaining <= 0;

  return (
    <div className="ask-input-card">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled && !isStreaming}
        rows={1}
        maxLength={MAX_LENGTH}
        className="ask-textarea"
      />
      <div className="ask-input-actions">
        {showCounter && (
          <span className={`ask-char-count ${isOver ? 'over' : ''}`}>
            {remaining}
          </span>
        )}
        {isStreaming ? (
          <button onClick={onStop} className="ask-btn-stop" title="Stop generating">
            <FiSquare className="ask-btn-icon" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || disabled || isOver}
            className="ask-btn-send"
            title="Send message"
          >
            <FiSend className="ask-btn-icon" />
          </button>
        )}
      </div>
    </div>
  );
}
