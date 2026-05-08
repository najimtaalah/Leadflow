#!/bin/bash
# LeadFlow Development Environment Startup Script
# Usage: ./start-dev.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Check .env exists
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example and configure it first."
  exit 1
fi

# Source .env for display
source .env 2>/dev/null || true
echo "==> Starting LeadFlow DEV on port ${PORT:-3001}..."
echo "==> DB: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "==> Node: $(node --version)"

# Start with nodemon for hot reload
npx nodemon src/server.js
