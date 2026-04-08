import { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { createDiceRenderer } from '@pwa/dice/dice-renderer';
import type { DiceRenderer, RollResult } from '@pwa/dice/dice-renderer';

export interface DiceAreaHandle {
  update(result: RollResult, animate: boolean): Promise<void>;
  setHeld(index: number, held: boolean): void;
}

interface DiceAreaProps {
  diceCount: number;
  onDieClick: (index: number) => void;
}

const DiceArea = forwardRef<DiceAreaHandle, DiceAreaProps>(
  function DiceArea({ diceCount, onDieClick }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<DiceRenderer | null>(null);
    const onDieClickRef = useRef(onDieClick);
    const listenerRef = useRef<((e: Event) => void) | null>(null);

    useEffect(() => {
      onDieClickRef.current = onDieClick;
    }, [onDieClick]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // Clean up any previous listener first (StrictMode safety)
      if (listenerRef.current) {
        container.removeEventListener('die-click', listenerRef.current);
        listenerRef.current = null;
      }

      const renderer = createDiceRenderer();
      rendererRef.current = renderer;

      // Clear container before creating new renderer (prevents duplicate canvases)
      container.innerHTML = '';

      renderer.create(container, diceCount).catch(() => {
        console.warn('DiceRenderer: WebGL not available');
        rendererRef.current = null;
      });

      const handleDieClick = (e: Event) => {
        e.stopImmediatePropagation();
        const detail = (e as CustomEvent<{ index: number }>).detail;
        onDieClickRef.current(detail.index);
      };
      listenerRef.current = handleDieClick;
      container.addEventListener('die-click', handleDieClick);

      return () => {
        container.removeEventListener('die-click', handleDieClick);
        listenerRef.current = null;
        try { renderer.destroy(); } catch { /* ignore */ }
        rendererRef.current = null;
      };
    }, [diceCount]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= diceCount) {
        e.preventDefault();
        onDieClickRef.current(num - 1);
      }
    }, [diceCount]);

    useImperativeHandle(ref, () => ({
      update(result: RollResult, animate: boolean) {
        if (!rendererRef.current) return Promise.resolve();
        return rendererRef.current.update(result, animate);
      },
      setHeld(index: number, held: boolean) {
        rendererRef.current?.setHeld(index, held);
      },
    }), []);

    return (
      <div
        ref={containerRef}
        className="dice-area"
        role="group"
        aria-label={`Würfelbereich – Tasten 1 bis ${diceCount} zum Halten`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      />
    );
  }
);

export default DiceArea;
