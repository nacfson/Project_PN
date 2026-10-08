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

