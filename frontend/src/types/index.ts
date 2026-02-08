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
