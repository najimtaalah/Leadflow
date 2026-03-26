import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

export default function Modal({ open, title, children, onClose, onConfirm, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', loading = false, danger = false, onSecondary, secondaryLabel, secondaryLoading = false }) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div
      className="modal-overlay open"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-title">
          {title}
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div>{children}</div>
        {(onConfirm || onClose) && (
          <div className="modal-actions">
            <button className="btn" onClick={onClose} disabled={loading}>{cancelLabel}</button>
            {onSecondary && (
              <button
                className="btn"
                onClick={onSecondary}
                disabled={loading || secondaryLoading}
                style={{ color: 'var(--red)', borderColor: 'var(--red)', marginRight: 'auto' }}
              >
                {secondaryLoading && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                {secondaryLabel}
              </button>
            )}
            {onConfirm && (
              <button
                className={`btn-primary${danger ? ' btn-danger' : ''}`}
                onClick={onConfirm}
                disabled={loading}
                style={danger ? { background: 'var(--red)' } : {}}
              >
                {loading && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                {confirmLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
