#!/usr/bin/env bash
set -euo pipefail

PORT=8000

if command -v pkill >/dev/null 2>&1; then
  pkill -f "python3 -m http.server ${PORT}" 2>/dev/null || true
fi

echo "Stopped snake server processes on port ${PORT} (if any were running)."
