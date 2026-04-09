import { createContext, useContext, useCallback, useRef, useState, type ReactNode } from 'react';
import { createRoom, joinRoom, type Room, type RoomPlayer, type GameAction } from './room';

export interface MultiplayerContextValue {
  room: Room | null;
  players: RoomPlayer[];
  isOnline: boolean;
  isHost: boolean;
  localPlayerId: string | null;
  hostCreateRoom: (playerName: string) => void;
  clientJoinRoom: (roomId: string, playerName: string) => void;
  sendAction: (type: string, payload?: unknown) => void;
  onGameAction: (handler: (action: GameAction) => void) => void;
  leaveRoom: () => void;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const roomRef = useRef<Room | null>(null);
  const actionHandlersRef = useRef<((action: GameAction) => void)[]>([]);

  const handlePlayersChanged = useCallback((p: RoomPlayer[]) => setPlayers(p), []);
  const handleGameAction = useCallback((action: GameAction) => {
    for (const h of actionHandlersRef.current) h(action);
  }, []);

  const hostCreateRoom = useCallback((playerName: string) => {
    // Clean up previous room completely
    if (roomRef.current) {
      roomRef.current.destroy();
      roomRef.current = null;
    }
    actionHandlersRef.current = [];
    const r = createRoom(playerName, {
      onPlayersChanged: handlePlayersChanged,
      onGameAction: handleGameAction,
    });
    roomRef.current = r;
    setRoom(r);
    setPlayers([{ id: r.playerId, name: playerName, isHost: true }]);
  }, [handlePlayersChanged, handleGameAction]);

  const clientJoinRoom = useCallback((roomId: string, playerName: string) => {
    // Clean up previous room completely
    if (roomRef.current) {
      roomRef.current.destroy();
      roomRef.current = null;
    }
    actionHandlersRef.current = [];
    const r = joinRoom(roomId, playerName, {
      onPlayersChanged: handlePlayersChanged,
      onGameAction: handleGameAction,
    });
    roomRef.current = r;
    setRoom(r);
  }, [handlePlayersChanged, handleGameAction]);

  const sendAction = useCallback((type: string, payload?: unknown) => {
    roomRef.current?.sendAction(type, payload);
  }, []);

  const onGameAction = useCallback((handler: (action: GameAction) => void) => {
    actionHandlersRef.current.push(handler);
  }, []);

  const leaveRoom = useCallback(() => {
    roomRef.current?.destroy();
    roomRef.current = null;
    setRoom(null);
    setPlayers([]);
    actionHandlersRef.current = [];
  }, []);

  return (
    <MultiplayerContext.Provider value={{
      room, players, localPlayerId: room?.playerId ?? null,
      isOnline: !!room, isHost: room?.role === 'host',
      hostCreateRoom, clientJoinRoom, sendAction, onGameAction, leaveRoom,
    }}>
      {children}
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayer(): MultiplayerContextValue {
  const ctx = useContext(MultiplayerContext);
  if (!ctx) throw new Error('useMultiplayer must be used within MultiplayerProvider');
  return ctx;
}
