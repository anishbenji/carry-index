#!/usr/bin/env python3
"""Check that nothing on the old page was lost in the migration, and list every
value that changed.   python3 tools/migrate/compare_legacy.py"""
import glob, os, sys
import yaml

sys.path.insert(0, os.path.dirname(__file__))
from legacy_bags import BAGS

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CLASS = dict(st='structured', ul='ultralight', pk='packable')


def main():
    new = {}
    for p in glob.glob(os.path.join(ROOT, 'data', 'bags', '*', '*.yaml')):
        b = yaml.safe_load(open(p, encoding='utf-8'))
        new[b['model']['legacy_id']] = b
    sources = yaml.safe_load(open(os.path.join(ROOT, 'data', 'sources.yaml'), encoding='utf-8'))
    lost, changed = [], []
    for old in BAGS:
        i = old['id']
        if i not in new:
            lost.append(f'{i}: no migrated file')
            continue
        b = new[i]
        v = b['variants'][0]
        lg = b['legacy']
        if v['name'] != old['name']:
            changed.append(f'{i}: name "{old["name"]}" -> "{v["name"]}"')
        if sources[v['page']]['url'] != old['src']:
            lost.append(f'{i}: source URL differs')
        if v['volume_l'] != old['vol']:
            changed.append(f'{i}: volume {old["vol"]} -> {v["volume_l"]} L')
        if v['weight_g'] != old['g']:
            changed.append(f'{i}: weight {old["g"]} -> {v["weight_g"]} g')
        if v['price']['amount'] != old['price']:
            changed.append(f'{i}: price {old["price"]} -> {v["price"]["amount"]}')
        for k in 'hwd':
            if v['dims_cm'][k] != old['dims'][k]:
                changed.append(f'{i}: {k} {old["dims"][k]} -> {v["dims_cm"][k]} cm')
        if b['model']['build_class'] != CLASS[old['cls']]:
            lost.append(f'{i}: build class')
        weights = [x['weight_g'] for x in b['variants'] if x.get('record') != 'comparison']
        for gv in old.get('gVar', []):
            if not any(abs(w - gv['g']) <= 1 for w in weights):
                lost.append(f'{i}: weight data point {gv["g"]} g ({gv["tag"]}) has no variant')
        texts = {(c['kind'], c['text']) for c in lg.get('claims', [])}
        for kind, key in (('pro', 'pros'), ('con', 'cons')):
            for t in old[key]:
                if (kind, t) not in texts:
                    lost.append(f'{i}: {kind} missing: {t[:50]}')
        for c in lg.get('claims', []):
            if not c.get('outcome'):
                lost.append(f'{i}: {c["id"]} has no recorded outcome')
        if len(lg.get('claims', [])) != len(old['pros']) + len(old['cons']):
            lost.append(f'{i}: claim count differs')
        for key, lk in (('verdict', 'verdict'), ('priceNote', 'price_note'), ('avail', 'avail'), ('origin', 'origin'),
                        ('laptop', 'laptop'), ('fabric', 'fabric'), ('brand', 'brand')):
            if lg.get(lk) != old[key]:
                lost.append(f'{i}: legacy.{lk} not preserved')
        if not any(m['file'] == old['img'] and m['credit'] == old['credit'] for m in v.get('media', [])):
            lost.append(f'{i}: photo or credit not carried over')
        if v.get('opening') != old['open']:
            changed.append(f'{i}: opening "{old["open"]}" -> "{v.get("opening")}"')
        if str(v['laptop']['max_in']).rstrip('0').rstrip('.') not in old['laptop']:
            changed.append(f'{i}: laptop "{old["laptop"]}" -> {v["laptop"]["max_in"]}')
    print(f'{len(BAGS)} old records compared')
    print(f'lost: {len(lost)}')
    for x in lost:
        print('  LOST', x)
    print(f'changed values: {len(changed)}')
    for x in changed:
        print('  CHANGED', x)
    sys.exit(1 if lost else 0)


if __name__ == '__main__':
    main()
