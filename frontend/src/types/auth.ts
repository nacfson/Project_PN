// DTOs mirroring backend/internal/http/auth_handler.go exactly.

export interface SessionResponse {
  token: string;
  expires_at: string;
}

export interface MeResponse {
  id: string;
  email: string;
  email_verified: boolean;
  email_verified_at?: string | null;
  native_language: string;
  target_language: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  native_language?: string;
  target_language?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface MagicLinkRequest {
  email: string;
}

export interface ExchangeRequest {
  code: string;
}
