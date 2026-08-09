#!/usr/bin/env bash
# run-loop.sh — generic runner script to execute the multi-session infinity loop.
# Usage: ./run-loop.sh [model]
# Example: ./run-loop.sh deepseek/deepseek-v4-flash
#
# Environment variables:
#   MODEL     - model ID (default: deepseek/deepseek-v4-flash)
#   PROMPT    - contract file to attach (default: loop.md)
#   THINKING  - extra flags like --thinking (default: --thinking)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODEL="${1:-${MODEL:-deepseek/deepseek-v4-flash}}"
PROMPT="${PROMPT:-loop.md}"

if [[ ! -f "$PROMPT" ]]; then
  echo "error: contract file '$PROMPT' not found in $SCRIPT_DIR" >&2
  exit 1
fi

echo "==> Starting infinity loop in $SCRIPT_DIR"
echo "    Model:  $MODEL"
echo "    File:   $PROMPT"
echo "    Press Ctrl+C to stop."
echo

# Trap Ctrl+C to exit cleanly
trap 'echo -e "\n==> Loop stopped by user."; exit 0' SIGINT SIGTERM

ITERATION=1
while true; do
  echo "--------------------------------------------------------------------------------"
  echo "==> Session Loop Iteration #$ITERATION [$(date '+%Y-%m-%d %H:%M:%S')]"
  echo "--------------------------------------------------------------------------------"

  opencode run "execute $PROMPT" \
    --model "$MODEL" \
    --file "$PROMPT" \
    --thinking || {
      echo "==> opencode session exited with code $? — pausing 2s before restart..."
    }

  ITERATION=$((ITERATION + 1))
  sleep 1
done

