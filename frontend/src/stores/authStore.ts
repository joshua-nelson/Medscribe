import { useCallback, useMemo } from 'react';
import { clearAuth, setAuth, setAuthLoading } from '@/features/auth/authSlice';
import { selectAuth } from '@/features/auth/selectors';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { Provider } from '@/types';

export function useAuthStore() {
  const auth = useAppSelector(selectAuth);
  const dispatch = useAppDispatch();

  const setAuthState = useCallback(
    (token: string, user: Provider) => {
      dispatch(setAuth({ accessToken: token, user }));
    },
    [dispatch],
  );

  const clearAuthState = useCallback(() => {
    dispatch(clearAuth());
  }, [dispatch]);

  const setLoading = useCallback(
    (loading: boolean) => {
      dispatch(setAuthLoading(loading));
    },
    [dispatch],
  );

  return useMemo(
    () => ({
      ...auth,
      setAuth: setAuthState,
      clearAuth: clearAuthState,
      setLoading,
    }),
    [auth, clearAuthState, setAuthState, setLoading],
  );
}
