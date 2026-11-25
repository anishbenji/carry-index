#!/bin/sh
# Rebuild everything of the 17 Nov 2026 pass from the backup, the decisions and the merged research files.
# Run from the repo root:  sh tools/reviews_2026_11_17/run_all.sh
set -e
python3 tools/reviews_2026_11_17/make_plans.py
python3 tools/reviews_2026_11_17/apply_plans.py
python3 tools/factcheck_2026_11_17/apply_fixes.py
python3 tools/validate.py --today 2026-11-17
python3 design/build/build_v28.py
python3 tools/reviews_2026_11_17/check_v28.py
python3 tools/summary_lines.py > reports/summary-lines.md
python3 tools/applied_doc.py
python3 tools/review_list.py > reports/claims-to-review.md
python3 tools/extra_reports.py
python3 tools/reviews_2026_11_17/make_report.py
