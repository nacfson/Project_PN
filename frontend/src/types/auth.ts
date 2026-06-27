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

export interface LanguagePair {
  target_language: string;
  definition_language: string;
}

export interface UserLanguage {
  target_language: string;
  display_language: string;
  is_active: boolean;
}

export interface AllowedLanguages {
  target_languages: string[];
  definition_languages: string[];
}

export interface LanguageOptionsResponse {
  defaults: LanguagePair;
  allowed: AllowedLanguages;
  forced: LanguagePair;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface VerifyEmailRequest {
  email: string;
}
