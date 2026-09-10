import { useCallback, useEffect, useState } from 'react';
import {
  AUTH_SCOPE_ADMIN,
  AUTH_SCOPE_APP,
  createHousehold,
  fetchSession,
  getAuthScope,
  joinHousehold,
  leaveHousehold as leaveHouseholdApi,
  login,
  deleteAccount,
  logout as clearSession,
  refreshEmailVerificationSession,
  resendVerificationEmail,
  signup,
} from '../api.js';
import { setActiveHouseholdId } from '../inventory/offlineCache.js';

const AUTH_FLOW_TIMEOUT_MS = 25_000;
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

/**
 * @param {{ scope?: 'app' | 'admin' }} [options]
 */
export function useAuth(options = {}) {
  const scope = options.scope || getAuthScope();
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
    if (scope === AUTH_SCOPE_APP && data.user?.householdId) {
      setActiveHouseholdId(data.user.householdId);
    }
  }, [scope]);

  const refreshSession = useCallback(async () => {
    const data = await fetchSession(scope);
    applySession(data);
    return data;
  }, [applySession, scope]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await fetchSession(scope);
        if (!cancelled) applySession(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || NETWORK_TIMEOUT_MSG);
          applySession(null);
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession, scope]);

  const handleSignup = useCallback(
    async (email, password) => {
      setError(null);
      try {
        const data = await withTimeout(signup(email, password, scope), AUTH_FLOW_TIMEOUT_MS);
        applySession(data);
        return data;
      } catch (err) {
        setError(err.message || NETWORK_TIMEOUT_MSG);
        throw err;
      }
    },
    [applySession, scope],
  );

  const handleLogin = useCallback(async (email, password) => {
    setError(null);
    try {
      const data = await withTimeout(login(email, password, scope), AUTH_FLOW_TIMEOUT_MS);
      applySession(data);
      return data;
    } catch (err) {
      setError(err.message || NETWORK_TIMEOUT_MSG);
      throw err;
    }
  }, [applySession, scope]);

  const handleCheckVerification = useCallback(async () => {
    setError(null);
    const data = await refreshEmailVerificationSession(scope);
    applySession(data);
    return data;
  }, [applySession, scope]);

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
    await clearSession({ scope });
    setUser(null);
    setNeedsVerification(false);
    setNeedsHousehold(false);
    setError(null);
  }, [scope]);

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
  // Admin console does not require a household; consumer app does.
  const canUseApp =
    scope === AUTH_SCOPE_ADMIN
      ? isAuthenticated && isVerified
      : isAuthenticated && isVerified && Boolean(user?.householdId);

  return {
    booting,
    user,
    needsVerification,
    needsHousehold,
    isAuthenticated,
    isVerified,
    canUseApp,
    scope,
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
