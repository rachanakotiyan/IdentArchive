import { useEffect, useRef } from 'react';
import { createPortal }    from 'react-dom';
import { X }               from 'lucide-react';
import './Modal.css';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Modal
 * Only for destructive actions (reject, close case, dismiss match).
 * Focus-trapped, Escape to close.
 *
 * @param {boolean} open
 * @param {Function} onClose
 * @param {string} title
 * @param {React.ReactNode} children
 * @param {React.ReactNode} footer - actions row
 */
export default function Modal({ open, onClose, title, children, footer }) {
  const modalRef = useRef(null);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;

    const focusFirst = () => {
      const els = modalRef.current?.querySelectorAll(FOCUSABLE);
      if (els?.length) els[0].focus();
    };
    focusFirst();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;

      const els = [...(modalRef.current?.querySelectorAll(FOCUSABLE) ?? [])];
      if (!els.length) return;

      const first = els[0];
      const last  = els[els.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
    >
      <div className="modal" ref={modalRef}>
        <div className="modal__header">
          <h2 className="modal__title" id="modal-title">{title}</h2>
          <button
            className="modal__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
