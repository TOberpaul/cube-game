import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { useHashRouter } from '../hooks/useHashRouter';
import { useGameContext } from '../context/GameContext';
import { useMultiplayer } from '../multiplayer/MultiplayerContext';
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
  const { gameState, gameEngine, roll, toggleHold, resetDice, selectScore, registry, startGame, applyState } = useGameContext();
  const { isOnline, isHost, sendAction, onGameAction, localPlayerId } = useMultiplayer();
  const diceAreaRef = useRef<DiceAreaHandle>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [diceAnnouncement, setDiceAnnouncement] = useState('');
  const [pendingScore, setPendingScore] = useState<ScoreOption | null>(null);
  const restoringRef = useRef(false);

  const modeId = params.modeId || gameState?.modeId || 'free-roll';
  const isKniffel = modeId === 'kniffel';
  const isFreeRoll = modeId === 'free-roll';
  const diceCount = gameState?.dice?.count ?? 5;

  // Is it the local player's turn?
  const isMyTurn = !isOnline || (gameState?.players[gameState.currentPlayerIndex]?.id === localPlayerId);

  const { gameStore, storeReady } = useGameContext();

  // On reload: try to restore last active game from store before creating a new one
  useEffect(() => {
    if (gameState || !params.modeId || restoringRef.current) return;
    if (!storeReady || !gameStore) {
      // Store not ready yet, wait
      return;
    }
    restoringRef.current = true;
    gameStore.listActive().then((active: unknown[]) => {
      const games = active as { modeId: string; players: { id: string; name: string; isHost?: boolean }[] }[];
      const match = games.find((g) => g.modeId === params.modeId);
      if (match) {
        applyState(match as Parameters<typeof applyState>[0]);
      } else {
        startGame(params.modeId!, [{ id: 'p1', name: 'Spieler 1', isHost: true }], params.playType || 'solo');
      }
    }).catch(() => {
      startGame(params.modeId!, [{ id: 'p1', name: 'Spieler 1', isHost: true }], params.playType || 'solo');
    });
  }, [gameState, params.modeId, params.playType, startGame, storeReady, gameStore, applyState]);

  // Online sync: Host broadcasts state changes, clients apply them
  const syncInitialized = useRef(false);
  // Use refs for stable access in callbacks
  const rollRef = useRef(roll);
  const toggleHoldRef = useRef(toggleHold);
  const selectScoreRef = useRef(selectScore);
  const gameEngineRef = useRef(gameEngine);
  const sendActionRef = useRef(sendAction);
  const applyStateRef = useRef(applyState);
  const diceAreaRefStable = diceAreaRef;

  useEffect(() => { rollRef.current = roll; }, [roll]);
  useEffect(() => { toggleHoldRef.current = toggleHold; }, [toggleHold]);
  useEffect(() => { selectScoreRef.current = selectScore; }, [selectScore]);
  useEffect(() => { gameEngineRef.current = gameEngine; }, [gameEngine]);
  useEffect(() => { sendActionRef.current = sendAction; }, [sendAction]);
  useEffect(() => { applyStateRef.current = applyState; }, [applyState]);

  useEffect(() => {
    if (!isOnline || syncInitialized.current) return;
    syncInitialized.current = true;

    if (isHost) {
      onGameAction((action) => {
        if (action.type === 'roll') {
          try {
            const result = rollRef.current();
            const newState = gameEngineRef.current?.getState();
            sendActionRef.current('state-update', { state: newState, diceResult: result });
          } catch (e) {
            console.warn('Online roll failed:', e);
          }
        } else if (action.type === 'toggle-hold') {
          toggleHoldRef.current(action.payload as number);
          sendActionRef.current('state-update', { state: gameEngineRef.current?.getState() });
        } else if (action.type === 'select-score') {
          selectScoreRef.current(action.payload as ScoreOption);
          sendActionRef.current('state-update', { state: gameEngineRef.current?.getState() });
        }
      });
    } else {
      onGameAction((action) => {
        if (action.type === 'state-update' && action.payload) {
          const { state, diceResult } = action.payload as { state: unknown; diceResult?: { values: number[]; rolledIndices: number[] } };
          if (state) applyStateRef.current(state as Parameters<typeof applyState>[0]);
          if (diceResult && diceAreaRefStable.current) {
            diceAreaRefStable.current.update(diceResult, true);
          }
        }
      });
    }
  }, [isOnline, isHost, onGameAction]);
  const modeConfig = registry.get(modeId);
  const rollsPerTurn: number | null = modeConfig?.rollsPerTurn ?? null;
  const rollsThisTurn = gameState?.rollsThisTurn ?? 0;
  const isFinished = gameState?.status === 'finished';
  const rollDisabled = isFinished || (rollsPerTurn !== null && rollsThisTurn >= rollsPerTurn) || !isMyTurn;

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

    if (isOnline && !isHost) {
      sendAction('select-score', pendingScore);
    } else {
      selectScore(pendingScore);
      if (isOnline && isHost) {
        sendAction('state-update', { state: gameEngine?.getState() });
      }
    }
    setPendingScore(null);
    scrollContainerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [pendingScore, selectScore, isOnline, isHost, sendAction, gameEngine]);

  const cancelScore = useCallback(() => {
    setPendingScore(null);
  }, []);

  const handleRoll = useCallback(async () => {
    if (rollDisabled || !isMyTurn) return;
    if (navigator.vibrate) navigator.vibrate(50);

    if (isOnline && !isHost) {
      sendAction('roll');
      return;
    }

    const engineState = gameEngine?.getState();
    const heldBefore = engineState?.dice?.held ? [...engineState.dice.held] : [];
    const result = roll();
    setDiceAnnouncement(t('dice.result', { values: result.values.join(', ') }));
    if (diceAreaRef.current) {
      await diceAreaRef.current.update(result, true);
      for (let i = 0; i < heldBefore.length; i++) if (heldBefore[i]) diceAreaRef.current.setHeld(i, true);
    }
    if (isOnline && isHost) {
      sendAction('state-update', { state: gameEngine?.getState(), diceResult: result });
    }
    if (isKniffel && rollsPerTurn !== null && rollsThisTurn + 1 >= rollsPerTurn) {
      const page = scrollContainerRef.current?.querySelector<HTMLElement>('[data-snap-page="scoreboard"]');
      if (page) scrollContainerRef.current!.scrollTo({ left: page.offsetLeft, behavior: 'smooth' });
    }
  }, [rollDisabled, isMyTurn, isOnline, isHost, roll, isKniffel, rollsPerTurn, rollsThisTurn, gameEngine, sendAction]);

  const handleDieClick = useCallback((index: number) => {
    if (!isMyTurn) return;

    if (isOnline && !isHost) {
      sendAction('toggle-hold', index);
      return;
    }

    const es = gameEngine?.getState();
    if (!es || es.status !== 'playing' || es.rollsThisTurn === 0) return;
    const wasHeld = es.dice.held[index];
    toggleHold(index);
    diceAreaRef.current?.setHeld(index, !wasHeld);
    if (isOnline && isHost) {
      sendAction('state-update', { state: gameEngine?.getState() });
    }
  }, [gameEngine, toggleHold, isMyTurn, isOnline, isHost, sendAction]);

  const prevRollsRef = useRef(0);
  useEffect(() => {
    if (!gameState || !diceAreaRef.current) return;
    if (gameState.rollsThisTurn === 0 && prevRollsRef.current > 0)
      for (let i = 0; i < gameState.dice.held.length; i++) diceAreaRef.current.setHeld(i, false);
    prevRollsRef.current = gameState.rollsThisTurn;
  }, [gameState?.rollsThisTurn]);

  // Sync held visuals from state (important for online clients)
  const prevHeldRef = useRef<boolean[]>([]);
  useEffect(() => {
    if (!gameState || !diceAreaRef.current) return;
    const held = gameState.dice.held;
    for (let i = 0; i < held.length; i++) {
      if (held[i] !== prevHeldRef.current[i]) {
        diceAreaRef.current.setHeld(i, held[i]);
      }
    }
    prevHeldRef.current = [...held];
  }, [gameState?.dice?.held]);

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
        title={pendingScore ? t(`kniffel.${pendingScore.id}`) : ''}
        footer={pendingScore && (
          <button className="adaptive button button--full-width" data-interactive=""
            data-material="inverted" data-container-contrast="max"
            onClick={confirmScore}>Eintragen</button>
        )}>
        {pendingScore && (
          <div className="score-confirm">
            <p className="score-confirm__value">{pendingScore.score} Punkte</p>
          </div>
        )}
      </Modal>
    </>
  );
}
