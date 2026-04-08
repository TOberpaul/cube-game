// Type declarations for vanilla JS modules from dice-game-pwa/js/

declare module '@pwa/game/game-engine' {
  export interface Player {
    id: string;
    name: string;
    connectionStatus: 'connected' | 'disconnected';
    isHost: boolean;
  }

  export interface ScoreSheet {
    playerId: string;
    totalScore: number;
    categories: Record<string, number | null>;
  }

  export interface DiceState {
    values: number[];
    held: boolean[];
    count: number;
  }

  export interface GameState {
    gameId: string;
    modeId: string;
    status: 'playing' | 'finished';
    players: Player[];
    currentPlayerIndex: number;
    currentRound: number;
    maxRounds: number | null;
    dice: DiceState;
    rollsThisTurn: number;
    scores: Record<string, ScoreSheet>;
    createdAt: number;
    updatedAt: number;
  }

  export interface RollResult {
    values: number[];
    rolledIndices: number[];
  }

  export interface ScoreOption {
    id: string;
    name: string;
    score: number;
  }

  export type GameEngineEvent = 'stateChange' | 'roll' | 'turnEnd' | 'gameOver' | 'playerDisconnected' | 'playerReconnected';

  export interface GameEngine {
    startGame(modeId: string, players: { id: string; name: string; isHost?: boolean }[]): GameState;
    roll(): RollResult;
    selectScore(option: ScoreOption): void;
    nextTurn(): void;
    getState(): GameState | null;
    on(event: GameEngineEvent, handler: (data: unknown) => void): void;
    toggleHold(index: number): void;
    resetDice(count: number): void;
    disconnectPlayer(playerId: string): void;
    reconnectPlayer(playerId: string): void;
  }

  export function createGameEngine(registry: GameModeRegistry, options?: { diceEngineOptions?: unknown }): GameEngine;
}

declare module '@pwa/game/game-mode-registry' {
  import type { GameState, ScoreOption } from '@pwa/game/game-engine';

  export interface ScoringStrategy {
    calculateOptions(dice: number[], state: GameState): ScoreOption[];
    applyScore(option: ScoreOption, state: GameState): GameState;
    isGameOver(state: GameState): boolean;
    getFinalScores(state: GameState): { playerId: string; name: string; totalScore: number; rank: number }[];
  }

  export interface GameModeConfig {
    id: string;
    name: string;
    diceCount: number;
    maxPlayers: number;
    maxRounds: number | null;
    rollsPerTurn: number | null;
    scoring: ScoringStrategy;
    categories?: string[];
  }

  export interface GameModeRegistry {
    register(config: GameModeConfig): void;
    get(id: string): GameModeConfig | undefined;
    getAll(): GameModeConfig[];
  }

  export function createGameModeRegistry(): GameModeRegistry;
}

declare module '@pwa/game/modes/kniffel' {
  export function registerKniffel(registry: import('@pwa/game/game-mode-registry').GameModeRegistry): void;
  export const kniffelMode: import('@pwa/game/game-mode-registry').GameModeConfig;
}

declare module '@pwa/game/modes/free-roll' {
  export function registerFreeRoll(registry: import('@pwa/game/game-mode-registry').GameModeRegistry): void;
  export const freeRollMode: import('@pwa/game/game-mode-registry').GameModeConfig;
}

declare module '@pwa/store/game-store' {
  import type { GameState } from '@pwa/game/game-engine';

  export interface GameStore {
    save(state: GameState): Promise<void>;
    load(gameId: string): Promise<GameState | null>;
    listActive(): Promise<GameState[]>;
    listFinished(): Promise<GameState[]>;
    delete(gameId: string): Promise<void>;
  }

  export function createGameStore(): Promise<GameStore>;
}

declare module '@pwa/i18n' {
  export function setLocale(locale: string): Promise<void>;
  export function t(key: string, params?: Record<string, string | number>): string;
  export function getLocale(): string;
  export function loadMessages(msgs: Record<string, string>, locale?: string): void;
}


declare module '@pwa/dice/dice-renderer' {
  export interface RollResult {
    values: number[];
    rolledIndices: number[];
  }

  export interface DiceRenderer {
    create(container: HTMLElement, count: number): Promise<void>;
    update(result: RollResult, animateRoll: boolean): Promise<void>;
    setHeld(index: number, held: boolean): void;
    destroy(): void;
  }

  export function createDiceRenderer(): DiceRenderer;
}


declare module '@pwa/dice/dice-announcer' {
  /**
   * Announces dice result to screenreaders via ARIA live region.
   * Note: This function manipulates the DOM directly (finds #dice-announcer).
   * In React, prefer using t('dice.result', { values }) directly.
   */
  export function announceDiceResult(values: number[]): void;
}

declare module '@pwa/avatars' {
  export const AVATARS: string[];
  export function getAvatar(index: number): string;
}

declare module '@pwa/multiplayer/webrtc-peer' {
  export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'failed';

  export interface SdpSignal {
    sdp: string;
    type: string;
    candidates: object[];
  }

  export interface WebRTCPeer {
    connect(config: { isHost: boolean }): Promise<void>;
    send(action: object): void;
    onMessage(handler: (action: object) => void): void;
    onConnectionChange(handler: (status: ConnectionStatus) => void): void;
    disconnect(): void;
    getStatus(): ConnectionStatus;
    getOffer(): Promise<SdpSignal>;
    setAnswer(answer: SdpSignal): Promise<void>;
    setOffer(offer: SdpSignal): Promise<void>;
    getAnswer(): Promise<SdpSignal>;
    getIceCandidates(): object[];
    getIsHost(): boolean;
  }

  export function createWebRTCPeer(): WebRTCPeer;
}

declare module '@pwa/multiplayer/sdp-payload' {
  export function validateSdpPayload(payload: object): { valid: boolean; error?: string };
  export function serializeSdpPayload(payload: { type: string; sdp: string; candidates: object[] }): string;
  export function deserializeSdpPayload(json: string): { type: string; sdp: string; candidates: object[] };
  export function compressForUrl(jsonString: string): Promise<string>;
  export function decompressFromUrl(base64url: string): Promise<string>;
}

declare module '@pwa/multiplayer/qr-code' {
  export function generateQrCode(data: string): Promise<string>;
  export function scanQrCode(videoElement: HTMLVideoElement): Promise<string>;
  export function stopScanner(): void;
  export class QrScanError extends Error {
    code: string;
    constructor(message: string, code: string);
  }
}

declare module '@pwa/multiplayer/offline-game-controller' {
  import type { WebRTCPeer } from '@pwa/multiplayer/webrtc-peer';
  import type { GameEngine } from '@pwa/game/game-engine';

  export interface OfflineGameController {
    send(type: string, payload?: object): void;
    destroy(): void;
  }

  export function createGameAction(playerId: string, type: string, payload?: object): object;
  export function createOfflineGameController(config: {
    peer: WebRTCPeer;
    gameEngine: GameEngine;
    isHost: boolean;
    playerId: string;
  }): OfflineGameController;
}

