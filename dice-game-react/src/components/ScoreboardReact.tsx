import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { t } from '../hooks/useI18n';
import { getAvatar } from '@pwa/avatars';
import type { Player, ScoreSheet, ScoreOption } from '@pwa/game/game-engine';

const UPPER_CATEGORIES = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as const;
const LOWER_CATEGORIES = ['threeOfAKind', 'fourOfAKind', 'fullHouse', 'smallStraight', 'largeStraight', 'kniffel', 'chance'] as const;
const UPPER_BONUS_THRESHOLD = 63;
const UPPER_BONUS_VALUE = 35;

type Row = { type: 'category'; id: string } | { type: 'computed'; id: string; label: string; getValue: (c: Record<string, number | null>) => number } | { type: 'total' };

const ROWS: Row[] = [
  ...UPPER_CATEGORIES.map((id) => ({ type: 'category' as const, id })),
  { type: 'computed', id: 'upperTotal', label: 'scoreboard.upperTotal', getValue: (c) => {
    let s = 0; for (const k of UPPER_CATEGORIES) if (c[k] != null) s += c[k]!; return s;
  }},
  { type: 'computed', id: 'bonus', label: 'scoreboard.bonus', getValue: (c) => {
    let s = 0; for (const k of UPPER_CATEGORIES) if (c[k] != null) s += c[k]!; return s >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS_VALUE : 0;
  }},
  ...LOWER_CATEGORIES.map((id) => ({ type: 'category' as const, id })),
  { type: 'total' },
];

function getGrandTotal(c: Record<string, number | null>): number {
  let s = 0, u = 0;
  for (const k of [...UPPER_CATEGORIES, ...LOWER_CATEGORIES]) if (c[k] != null) s += c[k]!;
  for (const k of UPPER_CATEGORIES) if (c[k] != null) u += c[k]!;
  return u >= UPPER_BONUS_THRESHOLD ? s + UPPER_BONUS_VALUE : s;
}

export interface ScoreboardReactProps {
  players: Player[]; currentPlayerIndex: number; scores: Record<string, ScoreSheet>;
  rollsThisTurn?: number; potentialScores?: ScoreOption[]; onSelectScore?: (o: ScoreOption) => void;
}

export default function ScoreboardReact({
  players, currentPlayerIndex, scores, rollsThisTurn = 0, potentialScores = [], onSelectScore,
}: ScoreboardReactProps) {
  const activePlayer = players[currentPlayerIndex];
  const hasRolled = rollsThisTurn > 0;

  // Sort players so the active player is always first
  const sortedPlayers = useMemo(() => {
    const sorted = [...players.map((p, i) => ({ player: p, originalIndex: i }))];
    sorted.sort((a, b) => {
      if (a.originalIndex === currentPlayerIndex) return -1;
      if (b.originalIndex === currentPlayerIndex) return 1;
      return a.originalIndex - b.originalIndex;
    });
    return sorted;
  }, [players, currentPlayerIndex]);

  const getPotential = useCallback((id: string) => potentialScores.find((p) => p.id === id), [potentialScores]);
  const handleRowClick = useCallback((o: ScoreOption) => onSelectScore?.(o), [onSelectScore]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent, o: ScoreOption) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectScore?.(o); }
  }, [onSelectScore]);

  function getRowLabel(row: Row) {
    if (row.type === 'category') return t(`kniffel.${row.id}`);
    if (row.type === 'computed') return t(row.label);
    return t('scoreboard.total');
  }

  function isRowClickable(row: Row): ScoreOption | undefined {
    if (row.type !== 'category' || !hasRolled || !onSelectScore || !activePlayer) return undefined;
    if (scores[activePlayer.id]?.categories?.[row.id] != null) return undefined;
    return getPotential(row.id);
  }

  function getCellValue(row: Row, pid: string) {
    const cats = scores[pid]?.categories ?? {};
    if (row.type === 'total') return { value: scores[pid] ? getGrandTotal(cats) : 0, isFilled: false, isPotential: false };
    if (row.type === 'computed') return { value: scores[pid] ? row.getValue(cats) : 0, isFilled: false, isPotential: false };
    const val = cats[row.id];
    if (val != null) return { value: val, isFilled: true, isPotential: false };
    if (hasRolled && pid === activePlayer?.id) { const p = getPotential(row.id); if (p) return { value: p.score, isFilled: false, isPotential: true }; }
    return { value: '–', isFilled: false, isPotential: false };
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [scrolledEnd, setScrolledEnd] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      const overflows = el.scrollWidth > el.clientWidth + 1;
      setHasOverflow(overflows);
      setScrolledEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', check); ro.disconnect(); };
  }, [players.length]);

  return (
    <div className="scoreboard-wrapper">
      <table className="adaptive table scoreboard-labels">
        <thead><tr><th>{t('scoreboard.title')}</th></tr></thead>
        <tbody>
          {ROWS.map((row, i) => {
            const clickable = isRowClickable(row);
            return (
              <tr key={i} {...(clickable ? {
                'data-interactive': true, tabIndex: 0, role: 'button', className: 'scoreboard-row--clickable',
                'aria-label': `${getRowLabel(row)}: ${clickable.score} Punkte`,
                onClick: () => handleRowClick(clickable),
                onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => handleKeyDown(e, clickable),
              } : {})}>
                <td className={`scoreboard-labels__category ${row.type === 'total' ? 'scoreboard-labels__category--total' : ''} ${row.type === 'computed' ? 'scoreboard-labels__category--computed' : ''}`}>
                  {getRowLabel(row)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div ref={scrollRef} className={`scoreboard-scores ${hasOverflow ? 'scoreboard-scores--overflow' : ''} ${scrolledEnd ? 'scoreboard-scores--scrolled-end' : ''}`}>
        <table className="adaptive table">
          <thead>
            <tr>
              {sortedPlayers.map(({ player: p, originalIndex: idx }) => {
                const totalScore = scores[p.id]?.totalScore ?? 0;
                return (
                  <th key={p.id} className={`scoreboard-player-name ${idx !== currentPlayerIndex ? 'scoreboard-player-name--inactive' : ''}`}>
                    <div className="avatar">
                    <span className="player-bar__avatar" aria-hidden="true">{getAvatar(idx)}</span>
                    <span className="player-bar__name">{p.name}</span>
                    <span className="player-bar__score">{totalScore}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => {
              const clickable = isRowClickable(row);
              return (
                <tr key={i} {...(clickable ? { 'data-interactive': true, className: 'scoreboard-row--clickable', onClick: () => handleRowClick(clickable) } : {})}>
                  {sortedPlayers.map(({ player: p }) => {
                    const { value, isFilled, isPotential } = getCellValue(row, p.id);
                    if (isFilled) return <td key={p.id} className="adaptive scoreboard-cell" data-material="inverted" data-container-contrast="max">{value}</td>;
                    return <td key={p.id} className={`scoreboard-cell ${isPotential ? 'scoreboard-cell--potential' : ''} ${row.type === 'total' ? 'scoreboard-cell--total' : ''}`}>{value}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
