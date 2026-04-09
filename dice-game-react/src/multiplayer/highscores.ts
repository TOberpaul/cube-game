import { supabase } from './supabase';

export interface GlobalHighscore {
  id: string;
  player_name: string;
  score: number;
  mode: string;
  created_at: string;
}

export async function fetchGlobalHighscores(limit = 10): Promise<GlobalHighscore[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('highscores')
    .select('id, player_name, score, mode, created_at')
    .eq('mode', 'kniffel')
    .order('score', { ascending: false })
    .limit(limit);
  if (error) { console.warn('Failed to fetch global highscores:', error); return []; }
  return data ?? [];
}

export async function submitHighscore(userId: string, playerName: string, score: number, mode = 'kniffel'): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('highscores')
    .insert({ user_id: userId, player_name: playerName, score, mode });
  if (error) { console.warn('Failed to submit highscore:', error); return false; }
  return true;
}
