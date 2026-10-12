#!/bin/sh
set -eu

# Empty values use the same defaults as an unset variable.
if [ -z "${PN_BACKEND_HOST:-}" ]; then
  PN_BACKEND_HOST=pn-backend
fi
if [ -z "${PN_BACKEND_PORT:-}" ]; then
  PN_BACKEND_PORT=8080
fi
export PN_BACKEND_HOST PN_BACKEND_PORT

render_server_conf() {
  envsubst '${PN_BACKEND_HOST} ${PN_BACKEND_PORT}' \
    < /etc/nginx/templates/default.conf.template \
    > "$1"
}

can_write_dir() {
  probe="$1/.pn-nginx-write-test"
  if touch "$probe" 2>/dev/null; then
    rm -f "$probe"
    return 0
  fi
  return 1
}

# /etc/nginx/conf.d, /var/log/nginx, and /run are on the root filesystem.
# A read-only root (Kubernetes readOnlyRootFilesystem, docker --read-only)
# rejects those writes, so the process exits before it can proxy to the backend.
# Prefer /tmp when an emptyDir is mounted there; /dev/shm stays writable with
# no extra volume.
pick_runtime_dir() {
  for parent in /tmp /dev/shm; do
    if can_write_dir "$parent"; then
      runtime="$parent/nginx"
      mkdir -p \
        "$runtime/conf.d" \
        "$runtime/client_temp" \
        "$runtime/proxy_temp" \
        "$runtime/fastcgi_temp" \
        "$runtime/uwsgi_temp" \
        "$runtime/scgi_temp"
      if id nginx >/dev/null 2>&1; then
        chown -R nginx:nginx "$runtime"
      fi
      chmod 755 "$runtime" "$runtime/conf.d"
      chmod 1777 \
        "$runtime/client_temp" \
        "$runtime/proxy_temp" \
        "$runtime/fastcgi_temp" \
        "$runtime/uwsgi_temp" \
        "$runtime/scgi_temp"
      printf '%s\n' "$runtime"
      return 0
    fi
  done
  echo "frontend nginx: no writable directory for proxy config, pid, or temp files (/tmp and /dev/shm are read-only)" >&2
  return 1
}

if can_write_dir /etc/nginx/conf.d; then
  render_server_conf /etc/nginx/conf.d/default.conf
fi

RUNTIME="$(pick_runtime_dir)"
render_server_conf "$RUNTIME/conf.d/default.conf"

cat > "$RUNTIME/nginx.conf" <<EOF
user nginx;
worker_processes auto;
error_log /dev/stderr notice;
pid ${RUNTIME}/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';
    access_log /dev/stdout main;
    sendfile on;
    keepalive_timeout 65;

    client_body_temp_path ${RUNTIME}/client_temp;
    proxy_temp_path ${RUNTIME}/proxy_temp;
    fastcgi_temp_path ${RUNTIME}/fastcgi_temp;
    uwsgi_temp_path ${RUNTIME}/uwsgi_temp;
    scgi_temp_path ${RUNTIME}/scgi_temp;

    include ${RUNTIME}/conf.d/*.conf;
}
EOF

# Skip the stock entrypoint. It rewrites /etc/nginx/conf.d and starts nginx
# with pid and log paths on the read-only root filesystem.
if [ "${1:-}" = "nginx" ]; then
  shift
  exec nginx -c "$RUNTIME/nginx.conf" "$@"
fi

exec "$@"
