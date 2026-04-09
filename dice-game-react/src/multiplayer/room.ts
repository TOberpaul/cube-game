/**
 * Supabase Realtime room for online multiplayer.
 * Uses Broadcast for game actions and Presence for player tracking.
 */
import { supabase, isSupabaseAvailable } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RoomRole = 'host' | 'client';

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
}

export interface GameAction {
  type: string;
  payload?: unknown;
  senderId: string;
  timestamp: number;
}

export interface RoomCallbacks {
  onPlayerJoin?: (player: RoomPlayer) => void;
  onPlayerLeave?: (playerId: string) => void;
  onGameAction?: (action: GameAction) => void;
  onPlayersChanged?: (players: RoomPlayer[]) => void;
}

export interface Room {
  roomId: string;
  role: RoomRole;
  playerId: string;
  channel: RealtimeChannel;
  sendAction: (type: string, payload?: unknown) => void;
  getPlayers: () => RoomPlayer[];
  destroy: () => void;
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function generatePlayerId(): string {
  return crypto.randomUUID?.() ?? `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSupabase() {
  if (!supabase || !isSupabaseAvailable) throw new Error('Supabase not configured');
  return supabase;
}

function setupChannel(channel: RealtimeChannel, playerId: string, playerName: string, isHost: boolean, callbacks: RoomCallbacks, playersRef: { current: RoomPlayer[] }) {
  const localPlayer: RoomPlayer = { id: playerId, name: playerName, isHost };
  let tracked = false;

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState<{ id: string; name: string; isHost: boolean }>();
    const remotePlayers = Object.values(state).flat().map((p) => ({
      id: p.id, name: p.name, isHost: p.isHost,
    }));
    // If we haven't been tracked yet or aren't in the list, ensure we're included
    const hasLocal = remotePlayers.some((p) => p.id === playerId);
    playersRef.current = hasLocal ? remotePlayers : [localPlayer, ...remotePlayers];
    callbacks.onPlayersChanged?.(playersRef.current);
  });

  channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
    for (const p of leftPresences) {
      const left = p as unknown as RoomPlayer;
      // Don't report self as leaving
      if (left.id !== playerId) {
        callbacks.onPlayerLeave?.(left.id);
      }
    }
  });

  channel.on('broadcast', { event: 'game-action' }, ({ payload }) => {
    callbacks.onGameAction?.(payload as GameAction);
  });

  const trackPresence = async () => {
    try {
      await channel.track({ id: playerId, name: playerName, isHost });
      tracked = true;
    } catch (e) {
      console.warn('Presence track failed, retrying...', e);
      setTimeout(trackPresence, 2000);
    }
  };

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await trackPresence();
    } else if (status === 'CHANNEL_ERROR') {
      console.warn('Channel error, will retry...');
    }
  });
}

function makeRoom(roomId: string, role: RoomRole, playerId: string, channel: RealtimeChannel, playersRef: { current: RoomPlayer[] }): Room {
  const sb = getSupabase();
  return {
    roomId, role, playerId, channel,
    sendAction(type: string, payload?: unknown) {
      channel.send({
        type: 'broadcast', event: 'game-action',
        payload: { type, payload, senderId: playerId, timestamp: Date.now() },
      });
    },
    getPlayers: () => [...playersRef.current],
    destroy() { sb.removeChannel(channel); },
  };
}

export function createRoom(playerName: string, callbacks: RoomCallbacks = {}): Room {
  const sb = getSupabase();
  const roomId = generateRoomId();
  const playerId = generatePlayerId();
  const playersRef = { current: [{ id: playerId, name: playerName, isHost: true }] as RoomPlayer[] };

  const channel = sb.channel(`room:${roomId}`, {
    config: { broadcast: { self: false }, presence: { key: playerId } },
  });

  setupChannel(channel, playerId, playerName, true, callbacks, playersRef);
  return makeRoom(roomId, 'host', playerId, channel, playersRef);
}

export function joinRoom(roomId: string, playerName: string, callbacks: RoomCallbacks = {}): Room {
  const sb = getSupabase();
  const playerId = generatePlayerId();
  const playersRef = { current: [] as RoomPlayer[] };

  const channel = sb.channel(`room:${roomId}`, {
    config: { broadcast: { self: false }, presence: { key: playerId } },
  });

  setupChannel(channel, playerId, playerName, false, callbacks, playersRef);
  return makeRoom(roomId, 'client', playerId, channel, playersRef);
}
