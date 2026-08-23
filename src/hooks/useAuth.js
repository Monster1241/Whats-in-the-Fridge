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

const BOOT_TIMEOUT_MS = 10_000;
const AUTH_FLOW_TIMEOUT_MS = 10_000;
const NETWORK_TIMEOUT_MSG =
  'Network timeout. Please check your connection or try again.';

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} [message]
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, message = NETWORK_TIMEOUT_MSG) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

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
    const data = await withTimeout(fetchSession(), BOOT_TIMEOUT_MS);
    applySession(data);
    return data;
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await withTimeout(fetchSession(), BOOT_TIMEOUT_MS);
        if (!cancelled) applySession(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || NETWORK_TIMEOUT_MSG);
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
      try {
        const data = await withTimeout(signup(email, password), AUTH_FLOW_TIMEOUT_MS);
        applySession(data);
        return data;
      } catch (err) {
        setError(err.message || NETWORK_TIMEOUT_MSG);
        throw err;
      }
    },
    [applySession],
  );

  const handleLogin = useCallback(async (email, password) => {
    setError(null);
    try {
      const data = await withTimeout(login(email, password), AUTH_FLOW_TIMEOUT_MS);
      applySession(data);
      return data;
    } catch (err) {
      setError(err.message || NETWORK_TIMEOUT_MSG);
      throw err;
    }
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
