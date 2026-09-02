package httpapi

import (
	"fmt"
	"html/template"
	"net/http"
	"net/url"
	"strings"

	"github.com/nacfson/central-auth/internal/config"
)

var loginPageTmpl = template.Must(template.New("login").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in — Project PN</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f1419; color: #e7ecf3; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
    .card { background: #1a2332; border-radius: 16px; padding: 32px; width: 100%; max-width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,.35); }
    h1 { margin: 0 0 8px; font-size: 1.5rem; }
    p { color: #9aa8b8; margin: 0 0 24px; line-height: 1.5; }
    .google-btn { display: block; width: 100%; padding: 12px 16px; border: none; border-radius: 8px; background: #fff; color: #1f1f1f; font-weight: 600; font-size: 1rem; cursor: pointer; text-align: center; text-decoration: none; box-sizing: border-box; }
    .google-btn:hover { background: #f0f0f0; }
    .google-btn.disabled { opacity: .5; pointer-events: none; }
    .divider { display: flex; align-items: center; gap: 12px; margin: 24px 0; color: #6b7a8d; font-size: .875rem; }
    .divider::before, .divider::after { content: ""; flex: 1; height: 1px; background: #2d3a4d; }
    label { display: block; font-size: .875rem; margin-bottom: 6px; color: #9aa8b8; }
    input[type=email] { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #2d3a4d; background: #0f1419; color: #e7ecf3; font-size: 1rem; box-sizing: border-box; margin-bottom: 12px; }
    .email-btn { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #3d5a80; background: transparent; color: #e7ecf3; font-size: 1rem; cursor: pointer; }
    .email-btn:hover { background: #243044; }
    .message { margin-top: 16px; padding: 12px; border-radius: 8px; font-size: .875rem; }
    .success { background: #1a3d2e; color: #8fd4a8; }
    .error { background: #3d1a1a; color: #f0a0a0; }
    .hint { font-size: .75rem; color: #6b7a8d; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Project PN</h1>
    <p>A word is global, but memory is personal.</p>
    {{if .GoogleConfigured}}
    <a class="google-btn" href="{{.GoogleURL}}">Sign in with Google</a>
    {{else}}
    <span class="google-btn disabled">Sign in with Google</span>
    <p class="hint">Google sign-in is not configured for this build.</p>
    {{end}}
    <div class="divider">or continue with email</div>
    <form method="POST" action="/login/magic-link">
      <input type="hidden" name="rd" value="{{.RedirectURL}}" />
      <label for="email">Email address</label>
      <input id="email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" />
      <button class="email-btn" type="submit">Send magic link</button>
    </form>
    {{if .Message}}<div class="message {{.MessageClass}}">{{.Message}}</div>{{end}}
  </div>
</body>
</html>`))

type loginPageData struct {
	GoogleConfigured bool
	GoogleURL        string
	RedirectURL      string
	Message          string
	MessageClass     string
}

func renderLoginPage(w http.ResponseWriter, cfg config.Config, rd, message, messageClass string) {
	googleURL := ""
	if cfg.GoogleConfigured() {
		q := url.Values{}
		q.Set("rd", rd)
		googleURL = cfg.PublicBaseURL + "/auth/google?" + q.Encode()
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = loginPageTmpl.Execute(w, loginPageData{
		GoogleConfigured: cfg.GoogleConfigured(),
		GoogleURL:        googleURL,
		RedirectURL:      rd,
		Message:          message,
		MessageClass:     messageClass,
	})
}

func loginRedirectURL(r *http.Request) string {
	rd := strings.TrimSpace(r.URL.Query().Get("rd"))
	if rd == "" {
		return "/"
	}
	return rd
}

func magicLinkFormEmail(r *http.Request) string {
	if err := r.ParseForm(); err != nil {
		return ""
	}
	return strings.TrimSpace(r.FormValue("email"))
}

func magicLinkFormRedirect(r *http.Request) string {
	if err := r.ParseForm(); err != nil {
		return loginRedirectURL(r)
	}
	rd := strings.TrimSpace(r.FormValue("rd"))
	if rd == "" {
		return "/"
	}
	return rd
}

func buildPublicCallbackURL(cfg config.Config, rawToken, rd string) string {
	q := url.Values{}
	q.Set("token", rawToken)
	if rd != "" {
		q.Set("rd", rd)
	}
	return fmt.Sprintf("%s/auth/callback?%s", cfg.PublicBaseURL, q.Encode())
}
