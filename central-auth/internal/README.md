# Central Auth Internal Packages

## Overview
Internal Go packages implementing configuration loading, PostgreSQL pooling, HTTP routing, Google OAuth, session persistence, and opaque token utilities for the `central-auth` service.

## Subdirectories & Boundaries
- [config](./config/README.md) - Environment variable loader, duration parser, and Google/admin helper predicates (`Config`, `Load`).
- [db](./db/README.md) - PostgreSQL `pgxpool` connection pool opener and ping verifier (`Open`).
- [httpapi](./httpapi/README.md) - Chi HTTP router, hosted login page template, OAuth endpoints, bearer/cookie session API, and internal cookie-session endpoint (`NewRouter`, `Server`).
- [oauth](./oauth/README.md) - Google OAuth 2.0 state management, token exchange, UserInfo verification, and user/identity provisioning (`GoogleService`).
- [session](./session/README.md) - PostgreSQL-backed session creation, access/cookie validation with sliding expiry, refresh-token rotation, and revocation (`Service`).
- [token](./token/README.md) - 256-bit `crypto/rand` opaque token generation and SHA-256 hex hashing (`Generate`, `Hash`).
