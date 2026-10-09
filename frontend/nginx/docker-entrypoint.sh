#!/bin/sh
set -eu

# Empty values use the same defaults as an unset variable.
if [ -z "${PN_BACKEND_HOST:-}" ]; then
  export PN_BACKEND_HOST=pn-backend
else
  export PN_BACKEND_HOST
fi
if [ -z "${PN_BACKEND_PORT:-}" ]; then
  export PN_BACKEND_PORT=8080
else
  export PN_BACKEND_PORT
fi

# Render before the stock entrypoint. That hook only runs when the command
# is nginx, and the local check also needs the file for a non-nginx command.
envsubst '${PN_BACKEND_HOST} ${PN_BACKEND_PORT}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec /docker-entrypoint.sh "$@"
