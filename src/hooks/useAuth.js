import { useCallback, useEffect, useState } from 'react';
import {
  createHousehold,
  fetchSession,
  joinHousehold,
  login,
  logout as clearToken,
  signup,
} from '../api.js';

export function useAuth() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [needsHousehold, setNeedsHousehold] = useState(false);
  const [error, setError] = useState(null);

  const applySession = useCallback((data) => {
    if (!data) {
      setUser(null);
      setNeedsHousehold(false);
      return;
    }
    setUser(data.user);
    setNeedsHousehold(Boolean(data.needsHousehold));
  }, []);

  const refreshSession = useCallback(async () => {
    const data = await fetchSession();
    applySession(data);
    return data;
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await fetchSession();
        if (!cancelled) applySession(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not restore session.');
          setUser(null);
          setNeedsHousehold(false);
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const handleSignup = useCallback(async (email, password) => {
    setError(null);
    const data = await signup(email, password);
    applySession(data);
    return data;
  }, [applySession]);

  const handleLogin = useCallback(async (email, password) => {
    setError(null);
    const data = await login(email, password);
    applySession(data);
    return data;
  }, [applySession]);

  const handleCreateHousehold = useCallback(async () => {
    setError(null);
    const data = await createHousehold();
    applySession(data);
    setNeedsHousehold(false);
    return data;
  }, [applySession]);

  const handleJoinHousehold = useCallback(async (inviteCode) => {
    setError(null);
    const data = await joinHousehold(inviteCode);
    applySession(data);
    setNeedsHousehold(false);
    return data;
  }, [applySession]);

  const handleLogout = useCallback(() => {
    clearToken();
    setUser(null);
    setNeedsHousehold(false);
    setError(null);
  }, []);

  return {
    booting,
    user,
    needsHousehold,
    isAuthenticated: Boolean(user),
    canUseApp: Boolean(user?.householdId),
    error,
    setError,
    refreshSession,
    signup: handleSignup,
    login: handleLogin,
    createHousehold: handleCreateHousehold,
    joinHousehold: handleJoinHousehold,
    logout: handleLogout,
  };
}
