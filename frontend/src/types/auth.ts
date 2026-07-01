// DTOs mirroring backend/internal/http/auth_handler.go exactly.

export type {
  SessionResponse,
  MeResponse,
  LoginRequest,
  LanguageOptionsResponse,
  LanguagePair,
  AllowedLanguages,
} from '@project-pn/api';

export interface RegisterRequest {
  email: string;
  password: string;
  native_language?: string;
  target_language?: string;
}

export interface UserLanguage {
  target_language: string;
  display_language: string;
  is_active: boolean;
}

export interface VerifyEmailRequest {
  email: string;
}
