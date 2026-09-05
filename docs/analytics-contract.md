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
then writes one `kind:"analytics"` JSON line per event to stdout. Delivery is
best effort: product actions never await analytics and failed batches are
dropped rather than persisted locally.

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

The platform infrastructure repository owns Vector deployment, sinks, storage
credentials, retention enforcement, dashboards, alerting, and raw-event access
controls. Its Project PN Vector DaemonSet profile must read only `project-pn`
pod stdout records; retain records only when `kind == "analytics"`; add
Kubernetes metadata; recursively redact/drop forbidden credential fields; use
disk buffering when policy enables it; and route through a named
`analytics_sink` abstraction. Platform operations select the concrete sink
(Kafka/Flink, object storage, Loki, or an analytical database) without producer
changes. Ordinary app, admin, and learning logs are excluded.
