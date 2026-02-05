export interface Provider {
  id: string;
  email: string;
  name: string;
  specialty: string | null;
}

export interface AuthResponse {
  id: string;
  email: string;
  name: string;
  specialty: string | null;
  accessToken: string;
}

export interface AuthState {
  accessToken: string | null;
  user: Provider | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (token: string, user: Provider) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}
