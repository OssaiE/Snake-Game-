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
  local target="$1"

  if command -v open >/dev/null 2>&1 && open "${target}" >/dev/null 2>&1; then
    return 0
  fi
  if command -v open >/dev/null 2>&1 && open -a "Google Chrome" "${target}" >/dev/null 2>&1; then
    return 0
  fi
  if command -v open >/dev/null 2>&1 && open -a "Safari" "${target}" >/dev/null 2>&1; then
    return 0
  fi
  if command -v osascript >/dev/null 2>&1; then
    if osascript -e "tell application \"Google Chrome\" to open location \"${target}\"" >/dev/null 2>&1; then
      return 0
    fi
    if osascript -e "tell application \"Safari\" to open location \"${target}\"" >/dev/null 2>&1; then
      return 0
    fi
  fi

  echo "Auto-open failed. Open manually: ${target}"
  return 1
}

is_serving() {
  curl -sSf -o /dev/null "$1"
}

if [[ -f "${PID_FILE}" ]]; then
  EXISTING_PID="$(cat "${PID_FILE}")"
  if kill -0 "${EXISTING_PID}" 2>/dev/null && is_serving "${URL}"; then
    echo "Snake server already running (PID ${EXISTING_PID}). Opening browser..."
    open_game "${URL}" || true
    exit 0
  fi
  rm -f "${PID_FILE}"
fi

if is_serving "${URL}"; then
  echo "Snake server already running on ${URL}. Opening browser..."
  open_game "${URL}" || true
  exit 0
fi

python3 -m http.server "${PORT}" --bind 127.0.0.1 >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!
echo "${SERVER_PID}" > "${PID_FILE}"
sleep 1

if kill -0 "${SERVER_PID}" 2>/dev/null && is_serving "${URL}"; then
  echo "Snake server running on ${URL} (PID ${SERVER_PID})"
  open_game "${URL}" || true
else
  echo "Server start blocked in this environment. Falling back to local file."
  open_game "${FILE_URL}" || true
  rm -f "${PID_FILE}"
fi
