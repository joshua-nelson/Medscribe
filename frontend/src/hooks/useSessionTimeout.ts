'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useActivityTracker } from './useActivityTracker';
import { useAuth } from './useAuth';
import { useAuthStore } from '@/stores/authStore';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_THRESHOLD_MS = 25 * 60 * 1000; // 25 minutes

export function useSessionTimeout() {
  const { logout, refresh } = useAuth();
  const { isAuthenticated } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const lastActivityRef = useRef<number>(Date.now());
  const warningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);

    if (warningIntervalRef.current) {
      clearInterval(warningIntervalRef.current);
      warningIntervalRef.current = null;
    }
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }
  }, []);

  const handleActivity = useCallback(() => {
    if (!showWarning) {
      resetTimers();
    }
  }, [showWarning, resetTimers]);

  useActivityTracker(handleActivity);

  const stayLoggedIn = useCallback(async () => {
    try {
      await refresh();
      resetTimers();
    } catch {
      logout();
    }
  }, [refresh, logout, resetTimers]);

  useEffect(() => {
    if (!isAuthenticated) {
      resetTimers();
      return;
    }

    const checkTimeout = () => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= SESSION_TIMEOUT_MS) {
        logout();
        return;
      }

      if (elapsed >= WARNING_THRESHOLD_MS && !showWarning) {
        setShowWarning(true);
        const remaining = Math.ceil((SESSION_TIMEOUT_MS - elapsed) / 1000);
        setSecondsRemaining(remaining);

        warningIntervalRef.current = setInterval(() => {
          const newElapsed = Date.now() - lastActivityRef.current;
          const newRemaining = Math.ceil((SESSION_TIMEOUT_MS - newElapsed) / 1000);

          if (newRemaining <= 0) {
            logout();
          } else {
            setSecondsRemaining(newRemaining);
          }
        }, 1000);
      }
    };

    const intervalId = setInterval(checkTimeout, 1000);

    return () => {
      clearInterval(intervalId);
      if (warningIntervalRef.current) {
        clearInterval(warningIntervalRef.current);
      }
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
      }
    };
  }, [isAuthenticated, showWarning, logout, resetTimers]);

  return {
    showWarning,
    secondsRemaining,
    stayLoggedIn,
    logout,
  };
}
