# Behavioral Analytics Contract

Project PN owns the semantic event names, versioned schema, producer code, and
meaning of metrics. Raw analytics are append-only JSON records. They may retain
learning content indefinitely, including after account deletion; access to raw
events must be restricted to named platform administrators.

## Delivery

Set `ANALYTICS_ENABLED=true` on the API and `EXPO_PUBLIC_ANALYTICS_ENABLED=true`
in a production client build. Both default to `false`. The client buffers at
most 100 events per request and sends `POST /api/analytics/events`; the API
accepts a maximum 256 KiB body, validates the batch before emitting any record,
then writes one `event.name:"analytics"` JSON line per event to stdout (including
Contract v3 required fields `time`, `level`, `msg`, `service.name`, and
`service.version`). Delivery is best effort: product actions never await
analytics and failed batches are dropped rather than persisted locally.

The API ignores a client-supplied `authenticated_user_id` and replaces it only
when a supplied browser/bearer session is validated. Anonymous events retain a
rotating app-session `anonymous_id`.

## Event envelope

Each event uses `event_version: 1` and contains `event_name`, UUID
`event_id`, RFC3339 `occurred_at`, UUID `session_id`, UUID `trace_id`, UUID
`anonymous_id`, optional trusted `authenticated_user_id`, `platform`,
`app_version`, and `properties`. Registered names are defined identically in
`packages/api/src/analytics.ts` and `backend/internal/analytics/events.go`.

Event properties may include entered words, definitions, selected meanings, and
context. They must never include access/refresh/ID tokens, passwords, secrets,
authorization headers, or cookies; nested occurrences are rejected.

## Platform collector handoff

Analytics stays one `event.name:"analytics"` JSON line on stdout, carrying `time` (RFC 3339 UTC with milliseconds), `level:"info"`, `msg:"analytics event"`, `service.name:"pn-api"`, `service.version`, and the event body fields. Admin audit is a different stream: one `event.name:"admin"` JSON line on stderr. Learning daily files stay files and are not container logs. Do not print admin or learning rows on the analytics stdout.

The platform log-history collector reads every `proj-*` stdout and stderr line. It does not keep only `event.name == "analytics"`. An analytics-only sink, if added later, may filter on that `event.name`. The current history store does not. Ordinary slog lines on stderr are collected too. Learning files are not, unless those events are also printed.

The July Vector profile that dropped non-analytics lines is not this collector. Platform operations still choose the long-term analytics sink without a producer change. Raw analytics access stays limited to named platform administrators.
