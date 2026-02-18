#!/usr/bin/env bash
set -euo pipefail
cd "/Users/ossaiemmanuel/Documents/snake game V1/leaderboard-worker"
npx wrangler kv key put --binding LEADERBOARD "scores" "[]" --remote
echo "Global leaderboard reset to empty."
