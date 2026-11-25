#!/bin/sh
# run_all.sh, then the copy of the page that is published as the artifact. Run from the repo root.
set -e
sh tools/reviews_2026_11_17/run_all.sh > /tmp/run.log 2>&1 || { tail -5 /tmp/run.log; exit 1; }
grep -n "problems\|errors,\|PROBLEM" /tmp/run.log | cut -c1-200
tail -1 /tmp/run.log
python3 design/build/bundle_publish_v21.py design/carry-journal-v28.html design/build/v28/publish | tail -1
