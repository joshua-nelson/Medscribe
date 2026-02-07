import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Provider } from '@/types';

export type AuthState = {
  accessToken: string | null;
  user: Provider | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

const initialState: AuthState = {
  accessToken: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{ accessToken: string; user: Provider }>) => {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    clearAuth: (state) => {
      state.accessToken = null;
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
    },
    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setAuth, clearAuth, setAuthLoading } = authSlice.actions;
export const authReducer = authSlice.reducer;
