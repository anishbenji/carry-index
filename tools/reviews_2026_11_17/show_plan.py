#!/usr/bin/env python3
"""Print the plan files compactly for review. Usage: show_plan.py [bag ...] [--quotes]"""
import json, os, sys
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'research', 'reviews-2026-11-17', 'plan')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
q = '--quotes' in sys.argv
bags = args or ['ctb26', 'cpp2', 'tp4', 'cicada', 'dfly', 'ct15l', 'ct15p', 'ct21l', 'ct21p', 'edx', 'slite', 'wlh30']
for b in bags:
    p = json.load(open(os.path.join(R, b + '.json'), encoding='utf-8'))
    print('#####', b, p['label'])
    for a in p['add']:
        c = a['claim']
        print(f"  + {c['id']} [{c['kind']}] {c['text']!r} | {c['support']} | {c['voice']} | {c['basis']} | {c['scope']} | obs={c['observed_on']} | {a['publishers']} | fb={(c.get('from_build') or {}).get('label')} | pts={a['points']}")
        if q:
            print('      ', c['evidence']['note'])
    for w in p['widen']:
        print(f"  ~ {w['id']} {w['text']!r} | {w['support_before']} -> {w['support_after']} | {w['publishers_after']} | label {w['label_before']!r} -> {w['label_after']!r} | obs+{w['observed_on_add']}")
    for f in p['flag']:
        print(f"  ! {f['id']} {f['text']!r}")
