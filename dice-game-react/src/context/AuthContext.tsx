import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../multiplayer/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  displayName: string | null;
  nickname: string;
  avatarUrl: string | null;
  setNickname: (name: string) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNicknameState] = useState(() => localStorage.getItem('dice-game-nickname') || '');

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    // Check if URL contains auth callback tokens (from OAuth redirect)
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      // Let Supabase extract the tokens from the URL fragment
      // Then clean up the URL to restore normal hash routing
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        setLoading(false);
        // Restore hash to home after auth
        window.location.hash = '#home';
      });
    } else {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        setLoading(false);
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const setNickname = useCallback((name: string) => {
    setNicknameState(name);
    localStorage.setItem('dice-game-nickname', name);
  }, []);

  // Auto-set nickname from Google name on first login
  useEffect(() => {
    if (user && !nickname) {
      const googleName = user.user_metadata?.full_name;
      if (googleName) setNickname(googleName);
    }
  }, [user, nickname, setNickname]);

  const displayName = nickname || user?.user_metadata?.full_name || user?.email || null;
  const avatarUrl = user?.user_metadata?.avatar_url || null;

  return (
    <AuthContext.Provider value={{ user, session, loading, displayName, nickname, avatarUrl, setNickname, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
