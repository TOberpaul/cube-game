import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { useHashRouter } from '../hooks/useHashRouter';
import { useGameContext } from '../context/GameContext';
import { t } from '@pwa/i18n';
import { ArrowLeft } from 'lucide-react';
import type { ScoreOption } from '@pwa/game/game-engine';
import DiceArea from '../components/DiceArea';
import type { DiceAreaHandle } from '../components/DiceArea';
import PlayerBar from '../components/PlayerBar';
import ScoreboardReact from '../components/ScoreboardReact';
import Modal from '../components/Modal';

export default function GameScreen() {
  const { params, navigate } = useHashRouter();
  const { gameState, gameEngine, roll, toggleHold, resetDice, selectScore, registry, startGame } = useGameContext();
  const diceAreaRef = useRef<DiceAreaHandle>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [diceAnnouncement, setDiceAnnouncement] = useState('');
  const [pendingScore, setPendingScore] = useState<ScoreOption | null>(null);

  const modeId = params.modeId || gameState?.modeId || 'free-roll';
  const isKniffel = modeId === 'kniffel';
  const isFreeRoll = modeId === 'free-roll';
  const diceCount = gameState?.dice?.count ?? 5;

  useEffect(() => {
    if (!gameState && params.modeId)
      startGame(params.modeId, [{ id: 'p1', name: 'Spieler 1', isHost: true }], params.playType || 'solo');
  }, [gameState, params.modeId, params.playType, startGame]);

  const modeConfig = registry.get(modeId);
  const rollsPerTurn: number | null = modeConfig?.rollsPerTurn ?? null;
  const rollsThisTurn = gameState?.rollsThisTurn ?? 0;
  const isFinished = gameState?.status === 'finished';
  const rollDisabled = isFinished || (rollsPerTurn !== null && rollsThisTurn >= rollsPerTurn);

  const potentialScores: ScoreOption[] = useMemo(() => {
    if (!gameState || !isKniffel || rollsThisTurn === 0 || !modeConfig?.scoring) return [];
    const scoring = modeConfig.scoring as { calculateOptions?: (d: number[], s: typeof gameState) => ScoreOption[] };
    return typeof scoring.calculateOptions === 'function' ? scoring.calculateOptions(gameState.dice.values, gameState) : [];
  }, [gameState, isKniffel, rollsThisTurn, modeConfig]);

  const handleSelectScore = useCallback((o: ScoreOption) => {
    setPendingScore(o);
  }, []);

  const confirmScore = useCallback(() => {
    if (!pendingScore) return;
    selectScore(pendingScore);
    setPendingScore(null);
    scrollContainerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [pendingScore, selectScore]);

  const cancelScore = useCallback(() => {
    setPendingScore(null);
  }, []);

  const handleRoll = useCallback(async () => {
    if (rollDisabled) return;
    if (navigator.vibrate) navigator.vibrate(50);
    const engineState = gameEngine?.getState();
    const heldBefore = engineState?.dice?.held ? [...engineState.dice.held] : [];
    const result = roll();
    setDiceAnnouncement(t('dice.result', { values: result.values.join(', ') }));
    if (diceAreaRef.current) {
      await diceAreaRef.current.update(result, true);
      for (let i = 0; i < heldBefore.length; i++) if (heldBefore[i]) diceAreaRef.current.setHeld(i, true);
    }
    if (isKniffel && rollsPerTurn !== null && rollsThisTurn + 1 >= rollsPerTurn) {
      const page = scrollContainerRef.current?.querySelector<HTMLElement>('[data-snap-page="scoreboard"]');
      if (page) scrollContainerRef.current!.scrollTo({ left: page.offsetLeft, behavior: 'smooth' });
    }
  }, [rollDisabled, roll, isKniffel, rollsPerTurn, rollsThisTurn, gameEngine]);

  const handleDieClick = useCallback((index: number) => {
    const es = gameEngine?.getState();
    if (!es || es.status !== 'playing' || es.rollsThisTurn === 0) return;
    toggleHold(index);
    diceAreaRef.current?.setHeld(index, !es.dice.held[index]);
  }, [gameEngine, toggleHold]);

  const prevRollsRef = useRef(0);
  useEffect(() => {
    if (!gameState || !diceAreaRef.current) return;
    if (gameState.rollsThisTurn === 0 && prevRollsRef.current > 0)
      for (let i = 0; i < gameState.dice.held.length; i++) diceAreaRef.current.setHeld(i, false);
    prevRollsRef.current = gameState.rollsThisTurn;
  }, [gameState?.rollsThisTurn]);

  const rollLabel = rollsPerTurn !== null ? `${t('game.roll')} (${rollsThisTurn}/${rollsPerTurn})` : t('game.roll');

  return (
    <>
      <h1 className="sr-only">{t('game.title')}</h1>

      <div ref={scrollContainerRef} className="scroll-snap-x">
        {/* Page 1: Dice */}
        <section className="snap-page" data-snap-page="dice" aria-label={t('a11y.diceArea')}>
          <div className="game-topbar">
            <button className="adaptive button button--icon-only" data-interactive="" data-material="transparent"
              aria-label="Zurück" onClick={() => navigate('home')}>
              <ArrowLeft className="icon" size={20} />
            </button>
            {isKniffel && gameState && (
              <span className="game-topbar__round">
                {gameState.maxRounds
                  ? t('game.round', { current: gameState.currentRound, max: gameState.maxRounds })
                  : t('game.roundUnlimited', { current: gameState.currentRound })}
              </span>
            )}
            {isFreeRoll && rollsThisTurn > 0 && gameState && (
              <span className="game-topbar__round" role="status">
                Summe: {gameState.dice.values.reduce((a, b) => a + b, 0)}
              </span>
            )}
          </div>

          {gameState && (
              <PlayerBar players={gameState.players} currentPlayerIndex={gameState.currentPlayerIndex} scores={gameState.scores} />
          )}

          <DiceArea ref={diceAreaRef} diceCount={diceCount} onDieClick={handleDieClick} />

          <div className="game-controls">
            <button className="adaptive button button--full-width" data-interactive=""
              data-material="inverted" data-container-contrast="max" data-size="l"
              disabled={rollDisabled} onClick={handleRoll}>
              {isFinished ? t('game.quit') : rollLabel}
            </button>

            {isFinished && (
              <button className="adaptive button button--full-width" data-interactive="" data-material="filled"
                onClick={() => navigate('result', { gameId: gameState?.gameId })}>{t('result.title')}</button>
            )}

            {isFreeRoll && (
              <div className="game-dice-count-section">
                <span className="game-dice-count__label">{t('game.diceCount')}</span>
                <div className="game-dice-count" role="group" aria-label={t('game.diceCount')}>
                  {[1, 2, 3, 4, 5, 6].map((c) => (
                    <button key={c} className="adaptive button" data-interactive=""
                      data-material={c === diceCount ? 'inverted' : 'filled'} data-size="s"
                      aria-pressed={c === diceCount} onClick={() => resetDice(c)}>{c}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Page 2: Scoreboard */}
        {isKniffel && (
          <section className="snap-page snap-page--scroll" data-snap-page="scoreboard" aria-label={t('a11y.scoreboardArea')}>
            {gameState && (
              <ScoreboardReact players={gameState.players} currentPlayerIndex={gameState.currentPlayerIndex}
                scores={gameState.scores} rollsThisTurn={gameState.rollsThisTurn}
                potentialScores={potentialScores} onSelectScore={handleSelectScore} />
            )}
          </section>
        )}
      </div>

      <div id="dice-announcer" className="sr-only" aria-live="polite" aria-atomic="true" role="status">
        {diceAnnouncement}
      </div>

      <Modal open={!!pendingScore} onClose={cancelScore}
        title={pendingScore ? t(`kniffel.${pendingScore.id}`) : ''}>
        {pendingScore && (
          <div className="score-confirm">
            <p className="score-confirm__value">{pendingScore.score} Punkte</p>
            <div className="score-confirm__actions">
              <button className="adaptive button button--full-width" data-interactive="" data-material="filled"
                onClick={cancelScore}>Abbrechen</button>
              <button className="adaptive button button--full-width" data-interactive=""
                data-material="inverted" data-container-contrast="max"
                onClick={confirmScore}>Eintragen</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
