'use client';

import { useEffect, useRef, useCallback } from 'react';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
const DEBOUNCE_MS = 1000;

export function useActivityTracker(onActivity: () => void) {
  const lastActivity = useRef<number>(Date.now());

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivity.current > DEBOUNCE_MS) {
      lastActivity.current = now;
      onActivity();
    }
  }, [onActivity]);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [handleActivity]);

  return lastActivity;
}
