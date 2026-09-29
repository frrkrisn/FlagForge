#!/usr/bin/env bash
# Build both the C++ backend and the React frontend in one go.
# Usage: ./scripts/build-all.sh [Debug|Release]
set -euo pipefail

BUILD_TYPE="${1:-Debug}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> [1/3] Configuring C++ (${BUILD_TYPE})"
cmake -S . -B build -DCMAKE_BUILD_TYPE="${BUILD_TYPE}"

echo "==> [2/3] Building C++ backend + tests"
cmake --build build -j
ctest --test-dir build --output-on-failure

if [ -d frontend ] && [ -f frontend/package.json ]; then
  echo "==> [3/3] Building frontend"
  cd frontend
  npm ci
  npm run build
  cd "$ROOT"
else
  echo "==> [3/3] Skipping frontend (frontend/package.json not found yet)"
fi

echo "==> Done. Run: ./build/bin/ctf_server --port 8080 --data data/runtime --web frontend/dist"
