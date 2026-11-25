#!/bin/sh
# Rebuild the data from the transcribed old page. Order matters: each step works on the previous step's output.
set -e
cd "$(dirname "$0")/../.."
python3 tools/migrate/migrate.py
python3 tools/migrate/merge_research.py
python3 tools/migrate/merge_followup.py
python3 tools/migrate/merge_proposals.py
python3 tools/migrate/apply_decisions.py
python3 tools/migrate/compare_legacy.py
