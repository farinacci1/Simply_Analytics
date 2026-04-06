import React, { useState, useEffect, useRef } from 'react';
import { HiSparkles } from 'react-icons/hi2';
import { FiUser } from 'react-icons/fi';
import ArtifactRenderer from './AskArtifactRenderer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function ThinkingBlock({ thinking, currentStatus, isActive }) {
  const [fadingOut, setFadingOut] = useState(false);
  const [gone, setGone] = useState(false);
  const contentRef = useRef(null);
  const prevActive = useRef(isActive);

  useEffect(() => {
    if (prevActive.current && !isActive && !fadingOut) {
      setFadingOut(true);
      const timer = setTimeout(() => setGone(true), 350);
      return () => clearTimeout(timer);
    }
    prevActive.current = isActive;
  }, [isActive, fadingOut]);

  useEffect(() => {
    if (isActive && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [thinking, isActive]);

  if (gone) return null;

  return (
    <div className={`ask-thinking-block ${fadingOut ? 'ask-thinking-fadeout' : ''}`}>
      <div className="ask-thinking-header">
        <HiSparkles className="ask-thinking-icon" />
        <span className="ask-thinking-status" key={currentStatus}>
          {currentStatus || 'Processing...'}
        </span>
      </div>
      {thinking && !fadingOut && (
        <div className="ask-thinking-content" ref={contentRef}>
          <div className="ask-thinking-text">
            {thinking}
            {isActive && <span className="ask-cursor" />}
          </div>
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="ask-typing-dots">
      <span className="ask-typing-dot" />
      <span className="ask-typing-dot" />
      <span className="ask-typing-dot" />
    </span>
  );
}

function ChatMessage({ message, connectionId }) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const { content, thinking, currentStatus, phase, isStreaming: streaming } = message;
  const isThinking = streaming && (phase === 'thinking' || phase === 'waiting');
  const hasThinkingContent = !!(thinking || currentStatus);
  const showAnswer = !!content || phase === 'answering' || phase === 'done';

  return (
    <div className={`ask-msg ${isUser ? 'user' : ''}`}>
      {isAssistant && (
        <div className="ask-msg-avatar assistant">
          <HiSparkles />
        </div>
      )}

      <div className={`ask-msg-body ${isUser ? 'user-body' : ''}`}>
        {isUser ? (
          <div className="ask-user-bubble">
            {content}
          </div>
        ) : (
          <div className="ask-assistant-content">
            {hasThinkingContent && phase !== 'done' && (
              <ThinkingBlock
                thinking={thinking}
                currentStatus={currentStatus}
                isActive={isThinking}
              />
            )}

            {showAnswer ? (
              <div className="ask-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{(content || '').trimStart()}</ReactMarkdown>
                {streaming && <span className="ask-cursor" />}
              </div>
            ) : streaming && !hasThinkingContent ? (
              <TypingDots />
            ) : null}

            {message.artifacts && (
              <div className="ask-artifacts">
                {Array.isArray(message.artifacts) ? (
                  message.artifacts.map((art, i) => (
                    <ArtifactRenderer key={i} artifact={art} connectionId={connectionId} />
                  ))
                ) : (
                  <ArtifactRenderer artifact={message.artifacts} connectionId={connectionId} />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="ask-msg-avatar user">
          <FiUser />
        </div>
      )}
    </div>
  );
}

export default React.memo(ChatMessage);
