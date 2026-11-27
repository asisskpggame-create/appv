#!/usr/bin/env bash
# One-command baseline check (TODO-UI step 0): type check, unit tests, production build.
# Usage: bash scripts/check.sh      (from the project folder; needs Node >= 22)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== node: $(node -v)"
if [ ! -d node_modules ]; then
  echo "== npm install"
  npm install
fi
echo "== 1/3 tsc --noEmit";  npm run lint
echo "== 2/3 npm test";      npm test
echo "== 3/3 vite build";    npm run build
echo "ALL OK"
