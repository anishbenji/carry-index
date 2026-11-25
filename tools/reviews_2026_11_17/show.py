#!/usr/bin/env python3
"""Compact view of one merged research file. Usage: show.py <bag> [sources|points|dropped|notes|ctx] [full]"""
import json, sys, os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'research', 'reviews-2026-11-17')
bag = sys.argv[1]
what = sys.argv[2] if len(sys.argv) > 2 else 'all'
full = len(sys.argv) > 3
d = json.load(open(os.path.join(R, 'merged', bag + '.json'), encoding='utf-8'))
if what in ('sources', 'all'):
    print('== SOURCES', bag)
    for s in d['sources']:
        print(f"{s['key']} usable={s['usable']} same_build={s.get('same_build')} kind={s['kind']} pub={s['publisher']!r} on_file={s.get('on_file_id')} opened={s.get('researcher_opened_with')}/{s.get('checker_opened_with')}")
        print(f"    url={s['url']}")
        print(f"    title={s.get('title')!r} author={s.get('author')!r} published={s.get('published')}")
        print(f"    covers={s.get('covers')}")
        print(f"    discloses={s.get('discloses')}")
        if s.get('problem'): print(f"    PROBLEM={s['problem']}")
if what in ('points', 'all'):
    print('== POINTS', bag)
    for p in d['points']:
        print(f"[{p['index']}] {p['kind']} | {p['topic']} | {p['text']!r} | build={p['build']} | n={p['n_publishers']} {p['publishers']} | matches={p.get('matches_claim')} conflicts={p.get('conflicts_with')} | carries={p.get('carries_over')} | fpi={p.get('first_pass_index')} | {p['verdict']}")
        if p.get('carries_over_why'): print(f"    carries_why: {p['carries_over_why']}")
        print(f"    checker: {p.get('checker_reason')}")
        for e in p['evidence']:
            q = e['quote'] if full else e['quote'][:230]
            print(f"    - {e['source']} [{e.get('quote_found')}/{e.get('supports')}] ({e.get('where')}): {q}")
if what in ('dropped', 'all'):
    print('== DROPPED')
    for p in d['dropped']:
        print(f"[{p['index']}] {p['kind']} {p['text']!r} build={p.get('build')} : {p.get('why')}")
if what in ('notes', 'all'):
    print('== DISAGREEMENTS')
    for x in d['disagreements']: print(' *', x)
    print('== CHECKER NOTES\n', d.get('checker_notes'))
    print('== RESEARCH NOTES\n', d.get('research_notes'))
    print('== rechecked', d.get('rechecked'), 'sources_used', d.get('sources_used'))
if what == 'ctx':
    c = json.load(open(os.path.join(R, 'ctx', bag + '.json'), encoding='utf-8'))
    print(c['file'], '|', c['label'], '|', c['sourcing_line'])
    for v in c['variants']: print('  variant', v['id'], '|', v['name'], '|', v['record'], v['shell'])
    for r in c['reviews_on_file']: print('  review', r['id'], '|', r['publisher'], '|', r['kind'], '|', r['covers'][:160], '|', r['used_for'])
    for cl in c['claims']: print('  claim', cl['id'], cl['kind'], '|', cl['text'], '|', cl['voice'], '|', cl['support'], '|', cl['basis'], '|', cl['sources'], '|', cl['status'], '|', cl.get('about'), '|', cl.get('from_build'))
    for f in c.get('maker_says', []): print('  maker', f)
