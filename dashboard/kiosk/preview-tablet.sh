#!/usr/bin/env bash
# One command for the real tablet screen, live edits and synced calendar data.
set -euo pipefail
dashboard_dir="$(cd "$(dirname "$0")/.." && pwd)"
if pgrep -f '(^|/)scrcpy .*--window-title Android tablet — live preview' >/dev/null; then
  echo 'The tablet preview is already open. Use that window, or close it before restarting.'
  exit 0
fi
tablet="${1:-}"
if [ -z "$tablet" ]; then
  devices=()
  while read -r serial state rest; do
    [ "$state" != device ] || devices+=("$serial")
  done < <(adb devices)
  if [ "${#devices[@]}" -ne 1 ]; then
    echo 'Connect one tablet with ADB, or pass its serial: npm run dev:tablet -- <serial>' >&2
    exit 1
  fi
  tablet="${devices[0]}"
fi

dev_pid=""
preview_started=false
cleanup() {
  if $preview_started; then
    adb -s "$tablet" shell am start -a android.intent.action.VIEW \
      -d 'http://127.0.0.1:8765/' -n com.wesbos.homehq/.MainActivity >/dev/null 2>&1 || true
  fi
  if [ -n "$dev_pid" ]; then kill "$dev_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

if ! curl --fail --silent http://127.0.0.1:5173/ >/dev/null; then
  node "$dashboard_dir/node_modules/vite/bin/vite.js" "$dashboard_dir" --host 127.0.0.1 --port 5173 --strictPort &
  dev_pid=$!
  ready=false
  for attempt in {1..40}; do
    if curl --fail --silent http://127.0.0.1:5173/ >/dev/null; then ready=true; break; fi
    kill -0 "$dev_pid" 2>/dev/null || break
    sleep 0.25
  done
  if ! $ready; then echo 'Could not start the dashboard development server.' >&2; exit 1; fi
fi

adb -s "$tablet" reverse tcp:5173 tcp:5173
adb -s "$tablet" shell am start -a android.intent.action.VIEW \
  -d 'http://127.0.0.1:5173/' -n com.wesbos.homehq/.MainActivity --ez live_preview true
preview_started=true
echo 'Live tablet preview: save files to refresh. Calendar reads from the tablet. Close the mirror to return to the offline app.'
scrcpy --serial "$tablet" --no-audio --window-title 'Android tablet — live preview' --max-size 1280 --max-fps 30
