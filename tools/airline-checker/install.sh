#!/bin/zsh
# One-time setup on the Mac: installs Playwright's Chromium and schedules the daily batch.
# Run from anywhere:  zsh ~/Downloads/the-carry-index/tools/airline-checker/install.sh
set -e
DIR="${0:A:h}"
cd "$DIR"
source ~/.nvm/nvm.sh 2>/dev/null || true
command -v node >/dev/null || { echo "node not found (install via nvm first)"; exit 1; }
npm install --no-fund --no-audit
npx playwright install chromium
node test/extract.test.mjs

NODE="$(command -v node)"
PLIST="$HOME/Library/LaunchAgents/com.carryindex.airline-checker.plist"
mkdir -p "$DIR/reports" "$DIR/state"
sed -e "s#__DIR__#$DIR#g" -e "s#__NODE__#$NODE#g" "$DIR/com.carryindex.airline-checker.plist" > "$PLIST"
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Scheduled: daily at 11:23, plus at login if that day's run was missed."
echo "First batch now:"
"$NODE" check.mjs
