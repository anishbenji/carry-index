"""Second batch of airlines added 13 Nov 2026 (pages found with a Google site: search, read on the airline's own site).
Writes verified/verified-E.json and merges notes into notes.json. Run from data/airlines: python3 add_airlines_2026-11-13b.py ."""
import json, sys, os
ROOT = sys.argv[1]
T = '2026-11-13'

def P(d=None, l=None, kg=None, us=False, allowed=True):
    return {'dims_cm': d, 'linear_cm': l, 'weight_kg': kg, 'underSeatOnly': us, 'allowed': allowed}

def C(d=None, l=None, kg=None):
    return {'dims_cm': d, 'linear_cm': l, 'weight_kg': kg}

A = [
 ('Trinity Airways', ['Asia'], C([55, 40, 20], 115), P([40, 30, 15]), 10,
  'https://www.trinityairways.com/app/serviceInfo/contents/1148',
  '세 변의 합이 115cm(45in)이내 ※ 최대크기 가로 40cm × 세로 20cm x 높이 55cm 이내 (손잡이, 바퀴 포함) … 총 무게 10kg 이내',
  {'gen': ["Formerly T'way Air (twayair.com redirects here)", 'Business: 2 bags, 10 kg each, 20 kg total']}),
 ('AJet', ['Europe', 'Middle East'], C([55, 40, 23], None, 8), P([40, 30, 15], None, 4, True), None,
  'https://ajet.com/en/corporate/rules-and-conditions/baggage',
  'one (1) cabin bag with dimensions and weight not exceeding 55x40x23 cm and 8 kg is also permitted',
  {'co': ['International Basic package: no cabin bag, only the under-seat bag; Ecojet, Flex and Premium include it'],
   'gen': ['Suit cover 114×60×11 cm counts as the cabin bag']}),
 ('Tigerair Taiwan', ['Asia'], C([54, 38, 23]), P(), 10,
  'https://www.tigerairtw.com/en/welcome-on-board/baggage',
  'one piece of hand baggage (size less than 54cm x 38cm x 23cm … ) and one personal belonging (such as handbags, computer bags, or duty-free goods) with combined weight must not exceed 10 kg',
  {'pi': ['Handbag, laptop bag or duty-free; no size given']}),
 ('FlySafair', ['Africa'], C([56, 36, 23], None, 7), P([40, 20, 15], None, None, True), None,
  'https://www.flysafair.co.za/travel-tools/extras/luggage-policy',
  'Your carry-on bag should not weigh more than 7kg … The dimensions should not exceed 56cm x 36cm x 23cm. … This personal item should not exceed 40cm x 15cm x 20cm',
  {'pi': ['A slimline laptop bag or a handbag, not both'], 'gen': ['Carry-on included on all fares, Lite too']}),
 ('Iberia Express', ['Europe'], C([56, 40, 25], None, 10), P(), None,
  'https://www.iberiaexpress.com/en/general-info/passenger-information/before-you-go/baggage/hand-baggage',
  'The maximum size of the baggage up to 10kg is 56 cm x 40 cm x 25 cm, including handles, pockets and wheels.',
  {'pi': ['Small handbag, purse or laptop allowed; no size given'],
   'gen': ['London Heathrow flights: separate rules (personal item 40×26×20 cm on its Heathrow page)']}),
 ('Thai Lion Air', ['Asia'], C([56, 36, 23], None, 7), P(), None,
  'https://www.lionairthai.com/terms',
  'The cabin bag shall not exceed the dimensions of 56cm X 36cm X 23cm and must not weigh more than 7kg.',
  {'pi': ['Terms allow a combination of two of: cabin bag, laptop bag, handbag; no size for the second item']}),
 ('Sichuan Airlines', ['Asia'], C([55, 40, 20], None, 8), P(), None,
  'https://www.sichuanair.com/baggage-service/carry-on-baggage.html',
  '每件手提行李的三边尺寸分别不超过20×40×55厘米，且重量不超过8公斤',
  {'gen': ['Business: 2 pieces'], 'pi': ['No personal item size published']}),
 ('US-Bangla Airlines', ['Asia'], C(None, 115, 7), P(), None,
  'https://www.usbair.com/terms-and-conditions',
  'Cabin Bag Boeing 737-800 The sum of all dimensions (L+B+H) must not exit 115 cm or 46 inches Max weight 7 kgs',
  {'co': ['Dash8-Q400 and ATR 72-600 flights: 72 cm total, 7 kg'], 'pi': ['Laptop allowed free in addition; no size given']}),
 ('Caribbean Airlines', ['North America', 'South America'], C([56, 35, 23], None, 10), P([43, 33, 15]), None,
  'https://www.caribbean-airlines.com/#/baggage/carry-on',
  'Max. Size -: L 22”x W 14” x H 9” (56cm x 35cm x 23cm) Max. Weight -: 10 kg/22lb',
  {'pi': ['Handbag, backpack, briefcase or laptop bag; duty-free counts toward it']}),
 ('Air Premia', ['Asia', 'North America'], C([55, 40, 20], 115), P([50, 30, 20], 100), 10,
  'https://www.airpremia.com/a/en/support/baggage/free-baggage',
  'The total of the three dimensions must not exceed 115 cm (45.2 inches), with each dimension limited to a maximum of 55 cm (A, 21.6 inches), 40 cm (B, 15.7 inches), and 20 cm (C, 7.8 inches).',
  {'gen': ['Wide Premium: 2 pieces of 10 kg', 'Personal item weight counts within the carry-on allowance']}),
 ('SalamAir', ['Middle East', 'Asia'], C(None, None, 10), P([33, 25, 20], None, 5, True), None,
  'https://www.salamair.com/en/plan/baggage-information',
  'SalamAir hand baggage allowance is one piece of 5KGs (under the aircraft seat), with dimensions not exceeding (25cm x 33cm x 20cm).',
  {'co': ['Paid "Trolley Bag" add-on, 10 kg; no size published'],
   'pi': ['The free allowance: laptop bag, small plastic bag or small ladies\' bag']}),
]

recs = [{'name': n, 'region': r, 'carryOn': co, 'personal': pi, 'combined_kg': ckg, 'fareNote': '',
         'source': src, 'quote': q, 'checked': T, 'status': 'verified', 'seedDiff': 'Not in seed.'}
        for n, r, co, pi, ckg, src, q, nt in A]
json.dump(recs, open(os.path.join(ROOT, 'verified', 'verified-E.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
nf = os.path.join(ROOT, 'notes.json')
notes = json.load(open(nf, encoding='utf-8'))
for n, *_, nt in A:
    if nt: notes[n] = nt
json.dump(notes, open(nf, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(recs), 'added')
