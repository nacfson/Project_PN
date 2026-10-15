package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"project-pn/internal/admin"
	"project-pn/internal/auth"
)

const (
	loginCSRFNonceCookie = "__Host-pa_nonce"
	pickupCodeTTL        = 30 * time.Second
)

type pickupEntry struct {
	SessionHandle    string
	SessionExpiresAt time.Time
	ExpiresAt        time.Time
}

type authHandler struct {
	svc              *auth.Service
	gateway          *auth.GatewayClient
	verifier         *auth.JWTVerifier
	publicAppURL     string
	publicAuthOrigin string
	logger           admin.Logger

	mu          sync.Mutex
	pickupCodes map[string]pickupEntry
}

func newAuthHandler(
	svc *auth.Service,
	gateway *auth.GatewayClient,
	verifier *auth.JWTVerifier,
	publicAppURL string,
	publicAuthOrigin string,
	logger admin.Logger,
) *authHandler {
	appURL := strings.TrimRight(strings.TrimSpace(publicAppURL), "/")
	if appURL == "" {
		appURL = strings.TrimRight(strings.TrimSpace(os.Getenv("PUBLIC_APP_URL")), "/")
	}
	if appURL == "" {
		appURL = "https://pn.nacfson.cloud"
	}

	authOrigin := deriveOrigin(publicAuthOrigin)
	if authOrigin == "" {
		authOrigin = deriveOrigin(os.Getenv("PUBLIC_AUTH_ORIGIN"))
	}
	if authOrigin == "" {
		authOrigin = deriveOrigin(os.Getenv("CENTRAL_AUTH_URL"))
	}
	if authOrigin == "" {
		authOrigin = deriveOrigin(os.Getenv("AUTH_JWT_ISSUER"))
	}
	if authOrigin == "" {
		authOrigin = "https://auth.nacfson.cloud"
	}

	return &authHandler{
		svc:              svc,
		gateway:          gateway,
		verifier:         verifier,
		publicAppURL:     appURL,
		publicAuthOrigin: authOrigin,
		logger:           logger,
		pickupCodes:      make(map[string]pickupEntry),
	}
}

func deriveOrigin(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	return parsed.Scheme + "://" + parsed.Host
}

type linkedProviderResponse struct {
	Provider     string    `json:"provider"`
	Issuer       string    `json:"issuer,omitempty"`
	Subject      string    `json:"subject,omitempty"`
	SignInMethod string    `json:"sign_in_method,omitempty"`
	Email        string    `json:"email"`
	LinkedAt     time.Time `json:"linked_at"`
}

type meResponse struct {
	ID              string                   `json:"id"`
	Email           string                   `json:"email"`
	EmailVerified   bool                     `json:"email_verified"`
	EmailVerifiedAt *time.Time               `json:"email_verified_at,omitempty"`
	NativeLanguage  string                   `json:"native_language"`
	TargetLanguage  string                   `json:"target_language"`
	UILanguage      string                   `json:"ui_language"`
	ActiveLanguage  auth.UserLanguage        `json:"active_language"`
	MergeSuggestion *auth.MergeSuggestion    `json:"merge_suggestion,omitempty"`
	LinkedProviders []linkedProviderResponse `json:"linked_providers,omitempty"`
}

func (h *authHandler) languageOptions(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, h.svc.LanguageOptions())
}

// login handles GET /api/auth/login (Spec 009 BFF Step 1-2).
func (h *authHandler) login(w http.ResponseWriter, r *http.Request) {
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate login nonce")
		return
	}
	nonce := hex.EncodeToString(nonceBytes)

	http.SetCookie(w, &http.Cookie{
		Name:     loginCSRFNonceCookie,
		Value:    nonce,
		Path:     "/",
		MaxAge:   600,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})

	sum := sha256.Sum256([]byte(nonce))
	bindDigest := base64.RawURLEncoding.EncodeToString(sum[:])

	callbackURL := fmt.Sprintf("%s/api/auth/callback?pa_bind=%s", h.publicAppURL, bindDigest)
	if next := sanitizeNextPath(r.URL.Query().Get("next")); next != "" {
		callbackURL += "&next=" + url.QueryEscape(next)
	}

	redirectTarget := fmt.Sprintf("%s/oauth/start?return=%s", h.publicAuthOrigin, url.QueryEscape(callbackURL))
	http.Redirect(w, r, redirectTarget, http.StatusFound)
}

// callback handles GET /api/auth/callback (Spec 009 BFF Step 5-7).
func (h *authHandler) callback(w http.ResponseWriter, r *http.Request) {
	ticket := strings.TrimSpace(r.URL.Query().Get("ticket"))
	expectedBind := strings.TrimSpace(r.URL.Query().Get("pa_bind"))

	nonceCookie, err := r.Cookie(loginCSRFNonceCookie)
	if err != nil || strings.TrimSpace(nonceCookie.Value) == "" || expectedBind == "" {
		writeError(w, http.StatusBadRequest, "invalid login nonce")
		return
	}

	sum := sha256.Sum256([]byte(nonceCookie.Value))
	actualBind := base64.RawURLEncoding.EncodeToString(sum[:])
	if subtle.ConstantTimeCompare([]byte(actualBind), []byte(expectedBind)) != 1 {
		writeError(w, http.StatusBadRequest, "invalid login nonce")
		return
	}

	clearLoginCSRFNonceCookie(w)

	if h.gateway == nil || ticket == "" {
		http.Redirect(w, r, h.publicAppURL+"/", http.StatusFound)
		return
	}

	exch, err := h.gateway.ExchangeTicket(r.Context(), r.Host, ticket)
	if err != nil || exch == nil || exch.Audience != "project-pn" {
		if h.logger != nil && err != nil {
			h.logger.Logf("AUTH_FAILURE", "gateway ticket exchange failed from %s: %v", r.RemoteAddr, err)
		}
		http.Redirect(w, r, h.publicAppURL+"/", http.StatusFound)
		return
	}

	ident, _, err := h.gateway.ConfirmSessionHandle(r.Context(), r.Host, exch.SessionHandle)
	if err != nil || ident == nil {
		if h.logger != nil && err != nil {
			h.logger.Logf("AUTH_FAILURE", "gateway session confirmation on callback failed from %s: %v", r.RemoteAddr, err)
		}
		http.Redirect(w, r, h.publicAppURL+"/", http.StatusFound)
		return
	}

	email := ident.Email
	if h.verifier != nil && ident.Token != "" {
		if claims, verifyErr := h.verifier.Verify(r.Context(), ident.Token); verifyErr == nil && claims.Email != "" {
			email = claims.Email
		}
	}

	if _, err := h.svc.EnsurePlatformUser(r.Context(), exch.Issuer, exch.Subject, email, "google"); err != nil {
		if h.logger != nil {
			h.logger.Logf("AUTH_FAILURE", "ensure platform user on callback failed: %v", err)
		}
		http.Redirect(w, r, h.publicAppURL+"/", http.StatusFound)
		return
	}

	codeBytes := make([]byte, 16)
	if _, err := rand.Read(codeBytes); err != nil {
		http.Redirect(w, r, h.publicAppURL+"/", http.StatusFound)
		return
	}
	code := hex.EncodeToString(codeBytes)

	now := time.Now().UTC()
	expiresIn := time.Duration(exch.ExpiresIn) * time.Second
	if expiresIn <= 0 {
		expiresIn = 8 * time.Hour
	}

	h.storePickupCode(code, pickupEntry{
		SessionHandle:    exch.SessionHandle,
		SessionExpiresAt: now.Add(expiresIn),
		ExpiresAt:        now.Add(pickupCodeTTL),
	}, now)

	http.Redirect(w, r, fmt.Sprintf("%s/?code=%s", h.publicAppURL, code), http.StatusFound)
}

// session handles POST /api/auth/session (Spec 009 BFF Step 8).
func (h *authHandler) session(w http.ResponseWriter, r *http.Request) {
	// Mandatory Security Gate (CWE-770): cap request body size at 4 KB before decoding JSON
	r.Body = http.MaxBytesReader(w, r.Body, 4<<10)
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(strings.TrimSpace(body.Code)) != 32 {
		writeError(w, http.StatusBadRequest, "invalid pickup code")
		return
	}

	code := strings.TrimSpace(body.Code)
	entry, ok := h.consumePickupCode(code, time.Now().UTC())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	writeJSON(w, http.StatusOK, refreshResponse{
		Token:        entry.SessionHandle,
		RefreshToken: entry.SessionHandle,
		ExpiresAt:    entry.SessionExpiresAt,
	})
}

func (h *authHandler) storePickupCode(code string, entry pickupEntry, now time.Time) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for k, v := range h.pickupCodes {
		if now.After(v.ExpiresAt) {
			delete(h.pickupCodes, k)
		}
	}
	h.pickupCodes[code] = entry
}

func (h *authHandler) consumePickupCode(code string, now time.Time) (pickupEntry, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for k, v := range h.pickupCodes {
		if now.After(v.ExpiresAt) {
			delete(h.pickupCodes, k)
		}
	}

	entry, exists := h.pickupCodes[code]
	if !exists {
		return pickupEntry{}, false
	}
	delete(h.pickupCodes, code)
	if now.After(entry.ExpiresAt) {
		return pickupEntry{}, false
	}
	return entry, true
}

func clearLoginCSRFNonceCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     loginCSRFNonceCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}

func sanitizeNextPath(next string) string {
	next = strings.TrimSpace(next)
	if next == "" || !strings.HasPrefix(next, "/") || strings.HasPrefix(next, "//") {
		return ""
	}
	return next
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type refreshResponse struct {
	Token        string    `json:"token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

func refreshSessionHandler(central *auth.CentralClient, logger admin.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Deprecated per 001-gateway-jwt-auth contracts/auth-api-surface.md
		writeError(w, http.StatusGone, "refresh proxy deprecated; tokens are refreshed via platform gateway")
	}
}

func centralLogout(central *auth.CentralClient, logger admin.Logger, gateways ...*auth.GatewayClient) http.HandlerFunc {
	var gateway *auth.GatewayClient
	if len(gateways) > 0 {
		gateway = gateways[0]
	}
	return func(w http.ResponseWriter, r *http.Request) {
		session, ok := authSessionFromContext(r.Context())
		if !ok {
			token := bearerToken(r)
			if token == "" {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			session = authSession{method: authMethodBearer, credential: token}
		}

		if strings.HasPrefix(session.credential, "v1.") {
			if gateway == nil {
				writeError(w, http.StatusInternalServerError, "gateway auth is not configured")
				return
			}
			if err := gateway.LogoutSessionHandle(r.Context(), session.credential); err != nil {
				if logger != nil {
					logger.Logf("AUTH_FAILURE", "gateway logout failed from %s: %v", r.RemoteAddr, err)
				}
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			if logger != nil {
				logger.Logf("AUTH", "logout from %s", r.RemoteAddr)
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}

		if central == nil {
			writeError(w, http.StatusInternalServerError, "central auth is not configured")
			return
		}

		var err error
		switch session.method {
		case authMethodCookie:
			err = central.LogoutCookieSession(r.Context(), session.credential)
		case authMethodBearer:
			err = central.Logout(r.Context(), session.credential)
		default:
			err = auth.ErrInvalidToken
		}
		if err != nil {
			if logger != nil {
				logger.Logf("AUTH_FAILURE", "logout failed from %s: %v", r.RemoteAddr, err)
			}
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		if session.method == authMethodCookie {
			clearCentralSessionCookie(w, r)
		}
		if logger != nil {
			logger.Logf("AUTH", "logout from %s", r.RemoteAddr)
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *authHandler) me(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	linked, err := h.svc.ListLinkedProviders(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	linkedResp := make([]linkedProviderResponse, 0, len(linked))
	for _, item := range linked {
		linkedResp = append(linkedResp, linkedProviderResponse{
			Provider:     item.Provider,
			Issuer:       item.Issuer,
			Subject:      item.Subject,
			SignInMethod: item.SignInMethod,
			Email:        item.Email,
			LinkedAt:     item.LinkedAt,
		})
	}

	var mergeSuggestion *auth.MergeSuggestion
	suggestions, err := h.svc.MergeSuggestions(r.Context(), user.ID, user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if len(suggestions) > 0 {
		mergeSuggestion = &suggestions[0]
	}

	h.logger.Logf("AUTH", "%s identity confirmed from %s", user.Email, r.RemoteAddr)
	writeJSON(w, http.StatusOK, meResponse{
		ID:              user.ID,
		Email:           user.Email,
		EmailVerified:   user.IsEmailVerified(),
		EmailVerifiedAt: user.EmailVerifiedAt,
		NativeLanguage:  user.NativeLanguage,
		TargetLanguage:  user.TargetLanguage,
		UILanguage:      user.UILanguage,
		ActiveLanguage:  user.ActiveLanguage,
		MergeSuggestion: mergeSuggestion,
		LinkedProviders: linkedResp,
	})
}

func (h *authHandler) linkedProviders(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	linked, err := h.svc.ListLinkedProviders(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	resp := make([]linkedProviderResponse, 0, len(linked))
	for _, item := range linked {
		resp = append(resp, linkedProviderResponse{
			Provider:     item.Provider,
			Issuer:       item.Issuer,
			Subject:      item.Subject,
			SignInMethod: item.SignInMethod,
			Email:        item.Email,
			LinkedAt:     item.LinkedAt,
		})
	}
	writeJSON(w, http.StatusOK, resp)
}

type mergeRequestBody struct {
	SourceUserID string `json:"source_user_id"`
}

func (h *authHandler) createMergeRequest(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body mergeRequestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.SourceUserID) == "" {
		writeError(w, http.StatusBadRequest, "source_user_id required")
		return
	}
	requestID, err := h.svc.CreateMergeRequest(r.Context(), user.ID, body.SourceUserID, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": requestID})
}

func (h *authHandler) confirmMergeRequest(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	requestID := strings.TrimSpace(r.PathValue("id"))
	if requestID == "" {
		writeError(w, http.StatusBadRequest, "id required")
		return
	}
	if err := h.svc.ConfirmMergeRequest(r.Context(), user.ID, requestID); err != nil {
		if errors.Is(err, auth.ErrInvalidToken) {
			writeError(w, http.StatusBadRequest, "invalid merge request")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *authHandler) mergeSuggestions(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	suggestions, err := h.svc.MergeSuggestions(r.Context(), user.ID, user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, suggestions)
}
