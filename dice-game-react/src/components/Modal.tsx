import { useRef, useEffect, useCallback, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, title, children, footer, ariaLabel }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) dialogRef.current?.close();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const els = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (els.length === 0) { e.preventDefault(); return; }
    const first = els[0]!;
    const last = els[els.length - 1]!;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, []);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="adaptive modal"
      data-material="filled"
      aria-label={ariaLabel || title}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="modal__header">
        <h3 className="adaptive headline" data-level="4">{title}</h3>
        <button className="adaptive button button--icon-only" data-interactive="" data-material="transparent"
          aria-label="Schließen" onClick={onClose}>
          <X className="icon" size={20} />
        </button>
      </div>
      <div className="modal__body">
        {children}
      </div>
      {footer && (
        <div className="modal__footer">
          {footer}
        </div>
      )}
    </dialog>
  );
}
