import {
  createContext,
  useContext,
  useReducer,
  useRef,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import { createGameEngine } from '@pwa/game/game-engine';
import type { GameEngine, GameState, RollResult, ScoreOption } from '@pwa/game/game-engine';
import { createGameModeRegistry } from '@pwa/game/game-mode-registry';
import type { GameModeRegistry } from '@pwa/game/game-mode-registry';
import { registerKniffel } from '@pwa/game/modes/kniffel';
import { registerFreeRoll } from '@pwa/game/modes/free-roll';
import { createGameStore } from '@pwa/store/game-store';
import type { GameStore } from '@pwa/store/game-store';

// --- Reducer ---

type GameAction =
  | { type: 'STATE_CHANGE'; payload: GameState }
  | { type: 'CLEAR' };

function gameReducer(_state: GameState | null, action: GameAction): GameState | null {
  switch (action.type) {
    case 'STATE_CHANGE':
      return action.payload;
    case 'CLEAR':
      return null;
    default:
      return _state;
  }
}

// --- Registry singleton (created once) ---

function createRegistry(): GameModeRegistry {
  const registry = createGameModeRegistry();
  registerKniffel(registry);
  registerFreeRoll(registry);
  return registry;
}

// --- Context type ---

export interface GameContextValue {
  gameState: GameState | null;
  gameEngine: GameEngine | null;
  gameStore: GameStore | null;
  registry: GameModeRegistry;
  storeReady: boolean;

  startGame: (modeId: string, players: { id: string; name: string; isHost?: boolean }[], playType: string) => void;
  roll: () => RollResult;
  toggleHold: (index: number) => void;
  selectScore: (option: ScoreOption) => void;
  resetDice: (count: number) => void;
  loadGame: (gameId: string) => Promise<void>;
  applyState: (state: GameState) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

// --- Provider ---

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, dispatch] = useReducer(gameReducer, null);
  const [storeReady, setStoreReady] = useState(false);

  const registryRef = useRef<GameModeRegistry>(createRegistry());
  const engineRef = useRef<GameEngine | null>(null);
  const storeRef = useRef<GameStore | null>(null);

  // Async init of GameStore
  useEffect(() => {
    let cancelled = false;
    createGameStore()
      .then((store) => {
        if (!cancelled) {
          storeRef.current = store;
          setStoreReady(true);
        }
      })
      .catch((err) => {
        console.warn('GameStore initialization failed, persistence disabled:', err);
        if (!cancelled) {
          setStoreReady(true); // App still works without persistence
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Persist state changes to GameStore
  useEffect(() => {
    if (gameState && storeRef.current) {
      storeRef.current.save(gameState).catch((err) => {
        console.warn('Failed to persist game state:', err);
      });
    }
  }, [gameState]);

  // Wire up engine stateChange listener
  const attachEngineListeners = useCallback((engine: GameEngine) => {
    engine.on('stateChange', (newState: unknown) => {
      dispatch({ type: 'STATE_CHANGE', payload: newState as GameState });
    });
  }, []);

  // --- Actions ---

  const startGame = useCallback(
    (modeId: string, players: { id: string; name: string; isHost?: boolean }[], _playType: string) => {
      const engine = createGameEngine(registryRef.current);
      engineRef.current = engine;
      attachEngineListeners(engine);
      engine.startGame(modeId, players);
      // stateChange event fires automatically, updating React state via dispatch
    },
    [attachEngineListeners],
  );

  const roll = useCallback((): RollResult => {
    if (!engineRef.current) {
      throw new Error('Cannot roll: no active game engine');
    }
    return engineRef.current.roll();
  }, []);

  const toggleHold = useCallback((index: number) => {
    if (!engineRef.current) return;
    engineRef.current.toggleHold(index);
  }, []);

  const selectScore = useCallback((option: ScoreOption) => {
    if (!engineRef.current) return;
    engineRef.current.selectScore(option);
  }, []);

  const resetDice = useCallback((count: number) => {
    if (!engineRef.current) return;
    engineRef.current.resetDice(count);
  }, []);

  const loadGame = useCallback(async (gameId: string) => {
    if (!storeRef.current) {
      throw new Error('Cannot load game: store not initialized');
    }
    const savedState = await storeRef.current.load(gameId);
    if (!savedState) {
      throw new Error(`Game not found: ${gameId}`);
    }
    const engine = createGameEngine(registryRef.current);
    engineRef.current = engine;
    attachEngineListeners(engine);
    dispatch({ type: 'STATE_CHANGE', payload: savedState });
  }, [attachEngineListeners]);

  const applyState = useCallback((state: GameState) => {
    dispatch({ type: 'STATE_CHANGE', payload: state });
  }, []);

  const value: GameContextValue = {
    gameState,
    gameEngine: engineRef.current,
    gameStore: storeRef.current,
    registry: registryRef.current,
    storeReady,
    startGame,
    roll,
    toggleHold,
    selectScore,
    resetDice,
    loadGame,
    applyState,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// --- Hook ---

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return ctx;
}

export default GameContext;
