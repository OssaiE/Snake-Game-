#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/tmp/snake-server.log"
PID_FILE="/tmp/snake-server.pid"
PORT=8000
URL="http://localhost:${PORT}/index.html"
FILE_URL="file://${ROOT_DIR}/index.html"

cd "${ROOT_DIR}"

open_game() {
  if command -v open >/dev/null 2>&1; then
    open "$1"
  else
    echo "No 'open' command available. Open this manually: $1"
  fi
}

if [[ -f "${PID_FILE}" ]]; then
  EXISTING_PID="$(cat "${PID_FILE}")"
  if kill -0 "${EXISTING_PID}" 2>/dev/null; then
    echo "Snake server already running (PID ${EXISTING_PID}). Opening browser..."
    open_game "${URL}"
    exit 0
  fi
fi

python3 -m http.server "${PORT}" >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!
echo "${SERVER_PID}" > "${PID_FILE}"
sleep 1

if kill -0 "${SERVER_PID}" 2>/dev/null; then
  echo "Snake server running on ${URL} (PID ${SERVER_PID})"
  open_game "${URL}"
else
  echo "Server start blocked in this environment. Falling back to local file."
  open_game "${FILE_URL}"
fi
