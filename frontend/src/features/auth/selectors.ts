import { RootState } from '@/store/store';

export const selectAuth = (state: RootState) => state.auth;
export const selectAccessToken = (state: RootState) => state.auth.accessToken;
export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectIsAuthLoading = (state: RootState) => state.auth.isLoading;
