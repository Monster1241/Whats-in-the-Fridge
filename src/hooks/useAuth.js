import { useCallback, useEffect, useState } from 'react';
import {
  createHousehold,
  fetchSession,
  joinHousehold,
  leaveHousehold as leaveHouseholdApi,
  login,
  deleteAccount,
  logout as clearSession,
  refreshEmailVerificationSession,
  resendVerificationEmail,
  signup,
} from '../api.js';

export function useAuth() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [needsHousehold, setNeedsHousehold] = useState(false);
  const [error, setError] = useState(null);

  const applySession = useCallback((data) => {
    if (!data) {
      setUser(null);
      setNeedsVerification(false);
      setNeedsHousehold(false);
      return;
    }
    setUser(data.user);
    setNeedsVerification(Boolean(data.needsVerification));
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
          setNeedsVerification(false);
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

  const handleSignup = useCallback(
    async (email, password) => {
      setError(null);
      const data = await signup(email, password);
      applySession(data);
      return data;
    },
    [applySession],
  );

  const handleLogin = useCallback(async (email, password) => {
    setError(null);
    const data = await login(email, password);
    applySession(data);
    return data;
  }, [applySession]);

  const handleCheckVerification = useCallback(async () => {
    setError(null);
    const data = await refreshEmailVerificationSession();
    applySession(data);
    return data;
  }, [applySession]);

  const handleResendVerification = useCallback(async () => {
    setError(null);
    await resendVerificationEmail();
  }, []);

  const handleCreateHousehold = useCallback(async () => {
    setError(null);
    const data = await createHousehold();
    return data;
  }, []);

  const finishHouseholdSetup = useCallback((data) => {
    applySession(data);
    setNeedsHousehold(false);
  }, [applySession]);

  const handleJoinHousehold = useCallback(async (inviteCode) => {
    setError(null);
    const data = await joinHousehold(inviteCode);
    applySession(data);
    setNeedsHousehold(false);
    return data;
  }, [applySession]);

  const handleLogout = useCallback(async () => {
    await clearSession();
    setUser(null);
    setNeedsVerification(false);
    setNeedsHousehold(false);
    setError(null);
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    setError(null);
    await deleteAccount();
    setUser(null);
    setNeedsVerification(false);
    setNeedsHousehold(false);
  }, []);

  const handleLeaveHousehold = useCallback(async () => {
    setError(null);
    const data = await leaveHouseholdApi();
    applySession(data);
    return data;
  }, [applySession]);

  const isAuthenticated = Boolean(user);
  const isVerified = Boolean(user?.isVerified);
  const canUseApp = isAuthenticated && isVerified && Boolean(user?.householdId);

  return {
    booting,
    user,
    needsVerification,
    needsHousehold,
    isAuthenticated,
    isVerified,
    canUseApp,
    error,
    setError,
    refreshSession,
    signup: handleSignup,
    login: handleLogin,
    checkVerification: handleCheckVerification,
    resendVerificationEmail: handleResendVerification,
    createHousehold: handleCreateHousehold,
    finishHouseholdSetup,
    joinHousehold: handleJoinHousehold,
    logout: handleLogout,
    deleteAccount: handleDeleteAccount,
    leaveHousehold: handleLeaveHousehold,
  };
}
