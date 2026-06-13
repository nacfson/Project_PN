# Go Backend Setup

## Requirements

- Go installed locally.
- Docker Desktop or Docker Engine with Docker Compose.

Run backend commands from the `backend/` directory:

```sh
cd backend
```

Check tooling:

```sh
go version
docker --version
docker compose version
```

If Homebrew `go1.26.4` fails while building test binaries, use the downloaded Go toolchain explicitly:

```sh
GOTOOLCHAIN=go1.26.0 go test ./...
```

## Local Database

Start PostgreSQL:

```sh
docker compose up -d
```

The local database uses:

```text
database: project_pn_dev
user: project_pn
password: project_pn_dev_password
host port: 5433
container port: 5432
```

The development connection string is defined in `.env.example`:

```text
DATABASE_URL=postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable
```

## Migrations

Apply migrations:

```sh
go run ./cmd/migrate up
```

Check migration version:

```sh
go run ./cmd/migrate version
```

Roll back one migration:

```sh
go run ./cmd/migrate down -steps=1
```

## API Server

Run the API:

```sh
go run ./cmd/api
```

Health endpoints:

```sh
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
```

`/healthz` checks that the service is running. `/readyz` checks PostgreSQL connectivity.

## Tests

Run unit tests:

```sh
GOTOOLCHAIN=go1.26.0 go test ./...
```

Schema acceptance tests require `DATABASE_URL` and a running local PostgreSQL instance:

```sh
docker compose up -d
DATABASE_URL=postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable GOTOOLCHAIN=go1.26.0 go test ./...
```

The MVP schema source of truth is `backend/docs/backend-schema-mvp.md`. Learning and review rules are in `backend/docs/learning-review-model.md`.
