#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[deploy-k8s] %s\n' "$*"
}

DEPLOY_HOST="${DEPLOY_HOST:-zlUbuntu}"
REGISTRY_URL="${REGISTRY_URL:-ghcr.io/nacfson}"
NAMESPACE="${NAMESPACE:-project-pn}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
GHCR_USERNAME="${GHCR_USERNAME:-}"
GHCR_TOKEN="${GHCR_TOKEN:-}"
BACKEND_IMAGE="${REGISTRY_URL}/project-pn-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="${REGISTRY_URL}/project-pn-frontend:${IMAGE_TAG}"

[[ -n "$GHCR_USERNAME" ]] || { log "GHCR_USERNAME is required"; exit 1; }
[[ -n "$GHCR_TOKEN" ]] || { log "GHCR_TOKEN is required"; exit 1; }
case "$GHCR_USERNAME" in
  *[!A-Za-z0-9._-]*) log "GHCR_USERNAME contains unsupported characters"; exit 1 ;;
esac

# Local cleanups
cleanup() {
  rm -f "/tmp/project-pn-backend-${IMAGE_TAG}.tar.gz" "/tmp/project-pn-frontend-${IMAGE_TAG}.tar.gz"
}
trap cleanup EXIT

log "Building project-pn-backend:${IMAGE_TAG} for linux/amd64"
docker build --platform linux/amd64 -t "project-pn-backend:${IMAGE_TAG}" -f backend/Dockerfile backend

log "Building frontend web static bundle"
(
  npm install --legacy-peer-deps
  cd frontend
  EXPO_PUBLIC_API_BASE_URL= EXPO_PUBLIC_CENTRAL_AUTH_URL=https://auth.nacfson.cloud npm run web:export
)

log "Building project-pn-frontend:${IMAGE_TAG} for linux/amd64"
docker build --platform linux/amd64 -t "project-pn-frontend:${IMAGE_TAG}" -f frontend/Dockerfile.web frontend

log "Saving images to local gzip tarballs"
docker save "project-pn-backend:${IMAGE_TAG}" | gzip > "/tmp/project-pn-backend-${IMAGE_TAG}.tar.gz"
docker save "project-pn-frontend:${IMAGE_TAG}" | gzip > "/tmp/project-pn-frontend-${IMAGE_TAG}.tar.gz"

log "Uploading tarballs to remote server ${DEPLOY_HOST}"
scp "/tmp/project-pn-backend-${IMAGE_TAG}.tar.gz" "${DEPLOY_HOST}:/tmp/project-pn-backend-${IMAGE_TAG}.tar.gz"
scp "/tmp/project-pn-frontend-${IMAGE_TAG}.tar.gz" "${DEPLOY_HOST}:/tmp/project-pn-frontend-${IMAGE_TAG}.tar.gz"

log "Logging remote Docker into GHCR"
printf '%s' "$GHCR_TOKEN" | ssh "${DEPLOY_HOST}" "docker login ghcr.io --username '${GHCR_USERNAME}' --password-stdin"

log "Executing remote load, GHCR push, and rollout on ${DEPLOY_HOST}"
ssh "${DEPLOY_HOST}" "bash -s" <<EOF
  set -euo pipefail
  
  echo "==> Loading backend image"
  docker load -i /tmp/project-pn-backend-${IMAGE_TAG}.tar.gz
  rm -f /tmp/project-pn-backend-${IMAGE_TAG}.tar.gz
  
  echo "==> Loading frontend image"
  docker load -i /tmp/project-pn-frontend-${IMAGE_TAG}.tar.gz
  rm -f /tmp/project-pn-frontend-${IMAGE_TAG}.tar.gz
  
  echo "==> Tagging images for GHCR"
  docker tag project-pn-backend:${IMAGE_TAG} ${BACKEND_IMAGE}
  docker tag project-pn-frontend:${IMAGE_TAG} ${FRONTEND_IMAGE}
  
  echo "==> Pushing backend to GHCR"
  docker push ${BACKEND_IMAGE}
  
  echo "==> Pushing frontend to GHCR"
  docker push ${FRONTEND_IMAGE}
  
  echo "==> Deleting old database migration job"
  kubectl delete job project-pn-migrate -n ${NAMESPACE} --ignore-not-found=true
  
  echo "==> Running database migrations job"
  kubectl apply -f /home/nacfson/processmanager/k8s/project-pn/migrate-job.yaml
  kubectl wait --for=condition=complete --timeout=90s job/project-pn-migrate -n ${NAMESPACE}
  
  echo "==> Pointing deployments at GHCR images"
  kubectl set image deployment/project-pn-backend "*=${BACKEND_IMAGE}" -n ${NAMESPACE}
  kubectl set image deployment/project-pn-frontend "*=${FRONTEND_IMAGE}" -n ${NAMESPACE}

  echo "==> Restarting frontend and backend deployments"
  kubectl rollout restart deployment/project-pn-backend -n ${NAMESPACE}
  kubectl rollout restart deployment/project-pn-frontend -n ${NAMESPACE}
  
  echo "==> Waiting for backend rollout"
  kubectl rollout status deployment/project-pn-backend -n ${NAMESPACE} --timeout=90s
  
  echo "==> Waiting for frontend rollout"
  kubectl rollout status deployment/project-pn-frontend -n ${NAMESPACE} --timeout=90s
EOF

log "Kubernetes deployment completed successfully!"
