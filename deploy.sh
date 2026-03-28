#!/usr/bin/env bash
# Local: ./deploy.sh
# One-liner (needs git + docker; clone + compose up):
#   curl -fsSL https://raw.githubusercontent.com/MoYoez/waken-wa-web/main/deploy.sh | bash
#
# Optional env: WAKEN_DEPLOY_DIR, WAKEN_DIR, WAKEN_BRANCH, WAKEN_REPO_URL
set -euo pipefail

WAKEN_REPO_URL="${WAKEN_REPO_URL:-https://github.com/MoYoez/waken-wa-web.git}"
WAKEN_BRANCH="${WAKEN_BRANCH:-main}"
WAKEN_DIR="${WAKEN_DIR:-waken-wa-web}"

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    echo "error: need 'docker compose' (v2) or docker-compose (v1)." >&2
    exit 1
  fi
}

resolve_project_root() {
  if [ -n "${WAKEN_DEPLOY_DIR:-}" ]; then
    if [ ! -f "$WAKEN_DEPLOY_DIR/docker-compose.yml" ]; then
      echo "error: WAKEN_DEPLOY_DIR=$WAKEN_DEPLOY_DIR has no docker-compose.yml" >&2
      exit 1
    fi
    (cd "$WAKEN_DEPLOY_DIR" && pwd)
    return
  fi

  local script_path="${BASH_SOURCE[0]:-}"
  if [ -n "$script_path" ] && [ "$script_path" != "-" ] && [ -f "$script_path" ]; then
    local d
    d="$(cd "$(dirname "$script_path")" && pwd)"
    if [ -f "$d/docker-compose.yml" ]; then
      echo "$d"
      return
    fi
  fi

  local target
  target="$(pwd)/$WAKEN_DIR"
  if [ -f "$target/docker-compose.yml" ]; then
    echo "$target"
    return
  fi

  if ! command -v git >/dev/null 2>&1; then
    echo "error: git is required when running via curl (to clone the repo)." >&2
    echo "  Or clone manually, cd into the repo, and run: ./deploy.sh" >&2
    exit 1
  fi

  echo "Cloning $WAKEN_REPO_URL (branch $WAKEN_BRANCH) into $target ..."
  git clone --depth 1 -b "$WAKEN_BRANCH" "$WAKEN_REPO_URL" "$target"
  (cd "$target" && git submodule update --init --recursive --depth 1)
  echo "$target"
}

ROOT="$(resolve_project_root)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker is not installed or not in PATH." >&2
  exit 1
fi

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "Created .env from .env.example."
  else
    echo "error: missing .env and .env.example. Create .env with at least:" >&2
    echo "  POSTGRES_PASSWORD=..." >&2
    echo "  JWT_SECRET=..." >&2
    echo "  NEXT_PUBLIC_BASE_URL=https://your-host:3000" >&2
    exit 1
  fi
  echo ""
  echo "Edit .env: set POSTGRES_PASSWORD and JWT_SECRET (and NEXT_PUBLIC_BASE_URL for production)."
  echo "Then run again:"
  echo "  cd \"$ROOT\" && ./deploy.sh"
  echo "Or: curl ... | bash   (from any directory)"
  exit 1
fi

echo "Building and starting stack (postgres + app)..."
compose up -d --build

echo ""
echo "Done. Open http://localhost:3000 (set APP_PORT in .env to map a different host port)."
echo "Logs: docker compose logs -f app"
