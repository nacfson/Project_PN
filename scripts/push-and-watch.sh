#!/usr/bin/env bash
set -euo pipefail

# Push commits to main and stream the resulting image URLs to the terminal

echo "==> Pushing commits to origin main..."
git push origin main

echo ""
echo "==> Waiting for GitHub Actions image build to trigger..."
sleep 4

REPO_OWNER="nacfson"
SHORT_SHA=$(git rev-parse --short HEAD)

if command -v gh >/dev/null 2>&1; then
  RUN_ID=$(gh run list --workflow="Publish Project PN images" --branch=main --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || echo "")

  if [[ -n "$RUN_ID" ]]; then
    echo "==> Watching GitHub Actions build #${RUN_ID} in terminal..."
    gh run watch "$RUN_ID" --interval 5 || true

    echo ""
    echo "============================================================"
    echo " Image Build Complete!"
    echo "============================================================"
    echo "Backend Image:"
    echo "  Tag:    ghcr.io/${REPO_OWNER}/project-pn-backend:${SHORT_SHA}"
    echo "  Latest: ghcr.io/${REPO_OWNER}/project-pn-backend:latest"
    echo ""
    echo "Frontend Image:"
    echo "  Tag:    ghcr.io/${REPO_OWNER}/project-pn-frontend:${SHORT_SHA}"
    echo "  Latest: ghcr.io/${REPO_OWNER}/project-pn-frontend:latest"
    echo "============================================================"
    echo "Actions Run: https://github.com/${REPO_OWNER}/Project_PN/actions/runs/${RUN_ID}"
    exit 0
  fi
fi

echo "============================================================"
echo " Pushed! Expected Image URLs once Actions finishes:"
echo "  Backend:  ghcr.io/${REPO_OWNER}/project-pn-backend:${SHORT_SHA}"
echo "  Frontend: ghcr.io/${REPO_OWNER}/project-pn-frontend:${SHORT_SHA}"
echo "============================================================"
echo "View build: https://github.com/${REPO_OWNER}/Project_PN/actions"
