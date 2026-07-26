#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[deploy-k8s] %s\n' "$*"
}

DEPLOY_HOST="wlUbuntu"
REGISTRY_URL="192.168.219.120:5000"
NAMESPACE="project-pn"

# Local cleanups
cleanup() {
  rm -f /tmp/project-pn-backend.tar.gz /tmp/project-pn-frontend.tar.gz
}
trap cleanup EXIT

log "Building project-pn-backend for linux/amd64"
docker build --platform linux/amd64 -t project-pn-backend:latest -f backend/Dockerfile backend

log "Building frontend web static bundle"
(
  cd frontend
  npm install --legacy-peer-deps
  EXPO_PUBLIC_API_BASE_URL= npm run web:export
)

log "Building project-pn-frontend for linux/amd64"
docker build --platform linux/amd64 -t project-pn-frontend:latest -f frontend/Dockerfile.web frontend

log "Saving images to local gzip tarballs"
docker save project-pn-backend:latest | gzip > /tmp/project-pn-backend.tar.gz
docker save project-pn-frontend:latest | gzip > /tmp/project-pn-frontend.tar.gz

log "Uploading tarballs to remote server ${DEPLOY_HOST}"
scp /tmp/project-pn-backend.tar.gz "${DEPLOY_HOST}:/tmp/project-pn-backend.tar.gz"
scp /tmp/project-pn-frontend.tar.gz "${DEPLOY_HOST}:/tmp/project-pn-frontend.tar.gz"

log "Executing remote load, tag, push, and rollout on ${DEPLOY_HOST}"
ssh "${DEPLOY_HOST}" "bash -s" <<EOF
  set -euo pipefail
  
  echo "==> Loading backend image"
  docker load -i /tmp/project-pn-backend.tar.gz
  rm -f /tmp/project-pn-backend.tar.gz
  
  echo "==> Loading frontend image"
  docker load -i /tmp/project-pn-frontend.tar.gz
  rm -f /tmp/project-pn-frontend.tar.gz
  
  echo "==> Tagging images for registry ${REGISTRY_URL}"
  docker tag project-pn-backend:latest ${REGISTRY_URL}/project-pn-backend:latest
  docker tag project-pn-frontend:latest ${REGISTRY_URL}/project-pn-frontend:latest
  
  echo "==> Pushing backend to local registry"
  docker push ${REGISTRY_URL}/project-pn-backend:latest
  
  echo "==> Pushing frontend to local registry"
  docker push ${REGISTRY_URL}/project-pn-frontend:latest
  
  echo "==> Deleting old database migration job"
  kubectl delete job project-pn-migrate -n ${NAMESPACE} --ignore-not-found=true
  
  echo "==> Running database migrations job"
  kubectl apply -f /home/nacfson/processmanager/k8s/project-pn/migrate-job.yaml
  kubectl wait --for=condition=complete --timeout=90s job/project-pn-migrate -n ${NAMESPACE}
  
  echo "==> Restarting frontend and backend deployments"
  kubectl rollout restart deployment/project-pn-backend -n ${NAMESPACE}
  kubectl rollout restart deployment/project-pn-frontend -n ${NAMESPACE}
  
  echo "==> Waiting for backend rollout"
  kubectl rollout status deployment/project-pn-backend -n ${NAMESPACE} --timeout=90s
  
  echo "==> Waiting for frontend rollout"
  kubectl rollout status deployment/project-pn-frontend -n ${NAMESPACE} --timeout=90s
EOF

log "Kubernetes deployment completed successfully!"
