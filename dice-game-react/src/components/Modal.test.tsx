import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

// jsdom doesn't implement HTMLDialogElement.showModal/close natively,
// so we polyfill them for testing.
beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
      (this as any).open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
      (this as any).open = false;
      this.dispatchEvent(new Event('close'));
    };
  }
});

describe('Modal', () => {
  it('calls showModal when open=true', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    const dialog = container.querySelector('dialog')!;
    expect(dialog.hasAttribute('open')).toBe(true);
  });

  it('does not open dialog when open=false', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={false} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    const dialog = container.querySelector('dialog')!;
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('closes dialog when open changes from true to false', () => {
    const onClose = vi.fn();
    const { container, rerender } = render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    const dialog = container.querySelector('dialog')!;
    expect(dialog.hasAttribute('open')).toBe(true);

    rerender(
      <Modal open={false} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('calls onClose when Escape triggers native close event', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    const dialog = container.querySelector('dialog')!;

    // Simulate the native close event that Escape triggers
    dialog.dispatchEvent(new Event('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies adaptive class and data-* attributes for Design System', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    const dialog = container.querySelector('dialog')!;
    expect(dialog.classList.contains('adaptive')).toBe(true);
    expect(dialog.getAttribute('data-color')).toBe('surface');
    expect(dialog.getAttribute('data-material')).toBe('raised');
    expect(dialog.getAttribute('data-size')).toBe('m');
    expect(dialog.getAttribute('data-container-contrast')).toBe('min');
    expect(dialog.getAttribute('data-content-contrast')).toBe('max');
  });

  it('sets aria-label when provided', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} onClose={onClose} ariaLabel="Test Label">
        <p>Content</p>
      </Modal>,
    );
    const dialog = container.querySelector('dialog')!;
    expect(dialog.getAttribute('aria-label')).toBe('Test Label');
  });

  it('renders children inside the dialog', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose}>
        <p>Hello Modal</p>
      </Modal>,
    );
    expect(screen.getByText('Hello Modal')).toBeTruthy();
  });

  it('traps focus: Tab from last focusable wraps to first', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} onClose={onClose}>
        <button>First</button>
        <button>Second</button>
        <button>Last</button>
      </Modal>,
    );

    const dialog = container.querySelector('dialog')!;
    const buttons = dialog.querySelectorAll('button');
    const firstBtn = buttons[0];
    const lastBtn = buttons[buttons.length - 1];

    lastBtn!.focus();
    expect(document.activeElement).toBe(lastBtn);

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });

    expect(document.activeElement).toBe(firstBtn);
  });

  it('traps focus: Shift+Tab from first focusable wraps to last', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} onClose={onClose}>
        <button>First</button>
        <button>Second</button>
        <button>Last</button>
      </Modal>,
    );

    const dialog = container.querySelector('dialog')!;
    const buttons = dialog.querySelectorAll('button');
    const firstBtn = buttons[0];
    const lastBtn = buttons[buttons.length - 1];

    firstBtn!.focus();
    expect(document.activeElement).toBe(firstBtn);

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(lastBtn);
  });
});
