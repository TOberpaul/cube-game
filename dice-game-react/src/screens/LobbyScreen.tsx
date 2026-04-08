import { useEffect } from 'react';
import { useHashRouter } from '../hooks/useHashRouter';

/** Placeholder – lobby no longer exists; redirect to home. */
export default function LobbyScreen() {
  const { navigate } = useHashRouter();
  useEffect(() => { navigate('home'); }, [navigate]);
  return null;
}
