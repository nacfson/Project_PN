# Notify

## Overview
Delivers re-engagement mobile push notifications via the Expo Push API and runs a background polling worker that queries `words.Service` for eligible candidates and records sent deliveries.

## Interface
- `ExpoSender`, `(*ExpoSender).Send(ctx context.Context, tokens []string, title, body string) error` `[worker.go:ExpoSender]`, `[worker.go:Send]`
- `Worker`, `(*Worker).Run(ctx context.Context)` `[worker.go:Worker]`, `[worker.go:Run]`

## Invariants
- `(*ExpoSender).Send` returns `nil` immediately without making an HTTP call when `len(tokens) == 0`, and defaults a nil `HTTPClient` to `http.DefaultClient` `[worker.go:Send]`.
- `(*Worker).Run` returns immediately if `Words == nil || Sender == nil`, defaults non-positive `Interval` to `15 * time.Minute`, executes one immediate tick before entering the ticker loop, and exits cleanly when `ctx` is cancelled `[worker.go:Run]`.
- `(*Worker).tick` only calls `Words.RecordNotificationSend` after `Sender.Send` succeeds for a candidate `[worker.go:tick]`.

## Side Effects
- Issues HTTP `POST` requests to `https://exp.host/--/api/v2/push/send` with optional `Authorization: Bearer <AccessToken>` header `[worker.go:expoPushURL]`, `[worker.go:Send]`.
- Queries notification candidates (`Words.BuildNotificationCandidates`) and records sent notifications (`Words.RecordNotificationSend`) in PostgreSQL `[worker.go:tick]`.
- Emits `slog.Error` logs on candidate build, Expo push send, or send-recording failures `[worker.go:tick]`.

## Verification
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/notify` (full suite: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`)
