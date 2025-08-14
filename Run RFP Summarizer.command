#!/bin/bash
set -euo pipefail

# Always run from the project folder
cd "/Users/TDeVries/Projects/rfp-summarizer"

# Kill anything already on 8888
lsof -ti :8888 | xargs kill -9 2>/dev/null || true

# Python env (create if missing)
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q Flask==3.0.3 Markdown==3.6 markupsafe==2.1.5 requests==2.32.3 google-auth==2.34.0

# --- Backend wiring (edit these 3 lines only if your URL is different) ---
export BACKEND_URL="https://summarize-rfp-luyf37yvga-uc.a.run.app/run"
export BACKEND_AUDIENCE="https://summarize-rfp-luyf37yvga-uc.a.run.app"
export GCP_SA_KEY_FILE="$HOME/.gcp/sa.json"
# If the SA key file exists, use auth; otherwise run in public/demo mode
if [ -f "$GCP_SA_KEY_FILE" ]; then export BACKEND_AUTH="sa"; else export BACKEND_AUTH="none"; fi

# Start the app
python3 localapp/app.py &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

# Open the pages
sleep 1
open "http://127.0.0.1:8888/health"
open "http://127.0.0.1:8888/"

wait $PID
