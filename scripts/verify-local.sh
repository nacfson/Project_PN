#!/usr/bin/env bash
# Local stack + code verification for Project PN.
# Contract: specs/002-strict-local-verification/contracts/verify-local-cli.md
#
# Usage: scripts/verify-local.sh [--full]
# Exit:  0 all checks passed, 1 one or more checks failed, 2 unusable prerequisites.
#
# There is intentionally no flag to skip or downgrade a failing check.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 2

FULL=0
for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
    -h|--help)
      sed -n '2,8p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg (only --full is supported)" >&2
      exit 2
      ;;
  esac
done

if ! command -v curl >/dev/null 2>&1; then
  echo "verify-local: 'curl' is required but not installed." >&2
  exit 2
fi

PASSED=0
FAILED=0

pass() { # id detail
  printf '[PASS] %-18s %s\n' "$1" "$2"
  PASSED=$((PASSED + 1))
}

fail() { # id detail fix
  printf '[FAIL] %-18s %s\n' "$1" "$2"
  if [[ -n "${3:-}" ]]; then
    printf '       fix: %s\n' "$3"
  fi
  FAILED=$((FAILED + 1))
}

# Read KEY=value from an env file without sourcing it (no code execution).
env_value() { # file key
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//"
}

# HTTP status code, or 000 when nothing answers.
http_code() { # url [extra curl args...]
  local url="$1"
  shift
  curl -s -m 5 -o /dev/null -w '%{http_code}' "$@" "$url" 2>/dev/null || true
}

tcp_open() { # host port
  (exec 3<>"/dev/tcp/$1/$2") 2>/dev/null
}

BACKEND_ENV="backend/.env"
FRONTEND_ENV="frontend/.env"

# ---------------------------------------------------------------- env-files
missing=""
[[ -f "$BACKEND_ENV" ]] || missing="$missing $BACKEND_ENV"
[[ -f "$FRONTEND_ENV" ]] || missing="$missing $FRONTEND_ENV"
if [[ -z "$missing" ]]; then
  pass env-files "$BACKEND_ENV and $FRONTEND_ENV present"
else
  fail env-files "missing:${missing}" "cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env"
fi

# ----------------------------------------------------------- db-reachable
DATABASE_URL_VALUE="$(env_value "$BACKEND_ENV" DATABASE_URL)"
DB_HOST="localhost"
DB_PORT="5433"
if [[ -n "$DATABASE_URL_VALUE" ]]; then
  hostport="${DATABASE_URL_VALUE#*@}"
  hostport="${hostport%%/*}"
  DB_HOST="${hostport%%:*}"
  if [[ "$hostport" == *:* ]]; then
    DB_PORT="${hostport##*:}"
  fi
fi
if tcp_open "$DB_HOST" "$DB_PORT"; then
  pass db-reachable "Postgres accepting connections on ${DB_HOST}:${DB_PORT}"
else
  fail db-reachable "nothing listening on ${DB_HOST}:${DB_PORT}" \
    "docker compose -f backend/compose.yaml --env-file backend/.env up -d"
fi

# ------------------------------------------- backend-alive / backend-ready
APP_ADDR_VALUE="$(env_value "$BACKEND_ENV" APP_ADDR)"
BACKEND_PORT="${APP_ADDR_VALUE##*:}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
BACKEND_LOCAL="http://localhost:${BACKEND_PORT}"

alive_code="$(http_code "${BACKEND_LOCAL}/healthz")"
if [[ "$alive_code" == "200" ]]; then
  pass backend-alive "${BACKEND_LOCAL}/healthz returned 200"
  ready_code="$(http_code "${BACKEND_LOCAL}/readyz")"
  if [[ "$ready_code" == "200" ]]; then
    pass backend-ready "${BACKEND_LOCAL}/readyz returned 200 (database connected)"
  else
    fail backend-ready "${BACKEND_LOCAL}/readyz returned ${ready_code} (backend is up but not ready)" \
      "check the database check above, then run: cd backend && go run ./cmd/migrate up"
  fi
elif [[ "$alive_code" == "000" ]]; then
  fail backend-alive "${BACKEND_LOCAL}/healthz unreachable" \
    "cd backend && set -a && source .env && set +a && go run ./cmd/api"
  fail backend-ready "not checked because backend-alive failed" ""
else
  fail backend-alive "port ${BACKEND_PORT} answered ${alive_code} on /healthz: another process may own the port (conflict)" \
    "stop the other process or change APP_ADDR in backend/.env"
  fail backend-ready "not checked because backend-alive failed" ""
fi

# ------------------------------------------------------------- client-up
CLIENT_PORT=8081
client_code="$(http_code "http://localhost:${CLIENT_PORT}")"
if [[ "$client_code" == "000" ]]; then
  if tcp_open localhost "$CLIENT_PORT"; then
    fail client-up "port ${CLIENT_PORT} is open but did not answer HTTP (conflict?)" \
      "stop the other process and run: cd frontend && npm run web"
  else
    fail client-up "nothing listening on port ${CLIENT_PORT}" "cd frontend && npm run web"
  fi
elif [[ "$client_code" =~ ^[23] ]]; then
  pass client-up "web client answered ${client_code} on port ${CLIENT_PORT}"
else
  fail client-up "port ${CLIENT_PORT} answered ${client_code}: another process may own the port (conflict)" \
    "stop the other process and run: cd frontend && npm run web"
fi

# ------------------------------------------------------ client-to-backend
CLIENT_API_URL="$(env_value "$FRONTEND_ENV" EXPO_PUBLIC_API_BASE_URL)"
CLIENT_API_URL="${CLIENT_API_URL:-http://localhost:8080}"
CLIENT_API_URL="${CLIENT_API_URL%/}"
# Dev bypass token: local verification only, never used against production.
DEV_TOKEN="mock-dev-token"
api_code="$(http_code "${CLIENT_API_URL}/api/decks" -H "Authorization: Bearer ${DEV_TOKEN}")"
case "$api_code" in
  200)
    pass client-to-backend "authenticated request to ${CLIENT_API_URL}/api/decks returned 200"
    ;;
  000)
    fail client-to-backend "${CLIENT_API_URL} (the address the client uses) is unreachable" \
      "start the backend, or fix EXPO_PUBLIC_API_BASE_URL in frontend/.env"
    ;;
  401|403)
    fail client-to-backend "reached ${CLIENT_API_URL} but got ${api_code}: this is an auth problem, not connectivity" \
      "set AUTH_DEV_BYPASS=true in backend/.env (local only) and restart the API"
    ;;
  *)
    fail client-to-backend "authenticated request to ${CLIENT_API_URL}/api/decks returned ${api_code}" \
      "check the backend logs"
    ;;
esac

# ------------------------------------------------------------------- full
run_check() { # id workdir command...
  local id="$1" dir="$2"
  shift 2
  local out
  if out="$(cd "$dir" && "$@" 2>&1)"; then
    pass "$id" "$*"
  else
    fail "$id" "command failed: $*" "re-run it directly to see the full output"
    printf '%s\n' "$out" | tail -n 15 | sed 's/^/         /'
  fi
}

if [[ "$FULL" -eq 1 ]]; then
  run_check lint "$REPO_ROOT" npm run lint:imports
  run_check typecheck-frontend "$REPO_ROOT" npm run typecheck -w frontend
  run_check typecheck-api "$REPO_ROOT" npm run typecheck -w packages/api
  run_check tests-frontend "$REPO_ROOT" npm test -w frontend
  run_check tests-api "$REPO_ROOT" npm test -w packages/api
  run_check tests-backend "$REPO_ROOT/backend" env GOTOOLCHAIN=go1.26.0 go test -p 1 ./...
fi

echo
if [[ "$FAILED" -eq 0 ]]; then
  echo "RESULT: PASS (${PASSED} passed)"
  exit 0
fi
echo "RESULT: FAIL (${FAILED} failed, ${PASSED} passed)"
exit 1
