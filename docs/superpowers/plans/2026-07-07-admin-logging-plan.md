# Admin Logging Implementation Plan

> Superseded 2026-10-24. Do not implement this file.

Admin audit is one `kind:"admin"` JSON line on stderr. There is no admin log file and no `ADMIN_LOG_PATH`.

Live contract: `docs/superpowers/specs/2026-07-07-admin-logging-design.md`.

Alignment plan: `docs/superpowers/plans/2026-10-24-log-stream-alignment.md`.

Persistent logs are stdout and stderr only. Do not add a local dump.
