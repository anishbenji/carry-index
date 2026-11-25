"""Builds verified-D.json (airlines added 13 Nov 2026, not in the willmybagfit seed) and merges their notes."""
import json, sys, os
ROOT = sys.argv[1]
T = '2026-11-13'

def P(d=None, l=None, kg=None, us=False, allowed=True):
    return {'dims_cm': d, 'linear_cm': l, 'weight_kg': kg, 'underSeatOnly': us, 'allowed': allowed}

def C(d=None, l=None, kg=None):
    return {'dims_cm': d, 'linear_cm': l, 'weight_kg': kg}

# name, regions, carry-on, personal, combined kg, source, quote, notes {co,pi,gen}
A = [
 ('Pegasus Airlines', ['Europe', 'Middle East'], C([55, 40, 23], None, 8), P([40, 30, 15], None, 3, True), None,
  'https://www.flypgs.com/en/travel-glossary/cabin-baggage',
  'This includes one item no more than 55x40x23 cm in size and 8 kg in weight.',
  {'co': ['International and Cyprus flights: the 55×40×23 cm, 8 kg bag comes with a fare package or as an add-on'],
   'pi': ['International base fare includes only this under-seat item (40×30×15 cm, 3 kg)'],
   'gen': ['Domestic flights: one 55×40×23 cm piece']}),
 ('flynas', ['Middle East'], C([56, 36, 23], None, 7), P(), None,
  'https://flynas.com/en/plan-my-trip/cabin-baggage',
  'Each guest may carry 1 piece of cabin baggage with maximum dimensions (length x width x height) 56 cm x 36 cm x 23 cm',
  {'pi': ['No personal item size or weight published']}),
 ('flyadeal', ['Middle East'], C([55, 40, 20], None, 7), P([40, 30, 20], None, None, True), None,
  'https://help.flyadeal.com/hc/en-us/articles/360010229700-Carry-On',
  'one cabin bag not larger than 55×40×20 cm and up to 7 Kg is allowed',
  {'gen': ['Same for fly, fly+ and flyMax fares']}),
 ('Jazeera Airways', ['Middle East'], C([55, 40, 20], None, 7), P(), None,
  'https://aem.jazeeraairways.com/en/plan/baggage-allowance/cabin-baggage',
  'Maximum carry-on baggage dimensions: 55 cm x 40 cm x 20 cm.',
  {'gen': ['Business: 2 pieces, 15 kg combined'], 'pi': ['No personal item allowance published']}),
 ('Riyadh Air', ['Middle East'], C([56, 36, 23], None, 7), P([45, 35, 25], None, 5), None,
  'https://www.riyadhair.com/en/help/baggage-allowance',
  'Economy class 1 piece (56 x 36 x 23 cm) Maximum weight - 7 kg (15 lb)',
  {'pi': ['Its carry-on page says 5 kg; its baggage-allowance page says under 7 kg. 5 kg used here'],
   'gen': ['Premium Economy 12 kg, Business 15 kg; started flying Jun 2026']}),
 ('ZIPAIR', ['Asia', 'North America'], C([55, 40, 25]), P([45, 35, 25]), 7,
  'https://www.zipair.net/en/service/baggage',
  '1st piece: 55 cm x 40 cm x 25 cm, 2nd piece: 35 cm x 45 cm x 25 cm ... The total weight of all carry-on baggage must not exceed 7 kg.',
  {'gen': ['Up to 15 kg total for a fee (paid 24 h ahead)']}),
 ('Jeju Air', ['Asia'], C([55, 40, 20]), P(), 10,
  'https://www.jejuair.net/en/linkService/boardingProcessGuide/cabinBaggage.do',
  'Maximum size 40 x 20 x 55CM (21INCH) ... allowable weight of 10KG/22LB',
  {'pi': ['One personal item (laptop, briefcase, handbag) allowed; no size given; counts toward the 10 kg']}),
 ('Jin Air', ['Asia'], C([55, 40, 20], 115, 10), P(), None,
  'https://help.jinair.com/hc/en-us/articles/4409835666329-What-are-the-regulations-for-a-carry-on-baggage',
  'Allowed size: 115cm or less, maximum value of each side is 40 X 20 X less than 55 cm in height ... 1 carry-on baggage at 10kg',
  {'pi': ['No personal item size or weight published']}),
 ('Air Busan', ['Asia'], C([55, 40, 20], 115), P(None, 60), 10,
  'https://en.airbusan.com/content/common/service/baggage/',
  'Only one piece of baggage weighing 10 kg or less with a sum of three dimensions of 115 cm',
  {'pi': ['Laptop bag or small handbag within 60 cm total; 10 kg shared with the carry-on']}),
 ('Citilink', ['Asia'], C([56, 36, 23], 115), P(), 7,
  'https://www.citilink.co.id/en/baggage-info',
  'L + W + H = 115cm Max. Weight 7 kg',
  {'co': ['ATR 72-600 flights: 41×34×17 cm (92 cm total)'], 'pi': ['A small item allowed; no size given; 7 kg shared with the main bag']}),
 ('STARLUX Airlines', ['Asia'], C([56, 36, 23], 115, 7), P([40, 30, 10], 80), None,
  'https://www.starlux-airlines.com/en-US/check-in-fly/baggage-information/general/carry-on-baggage',
  "56cm x 36cm x 23cm (22×14×9 inch) or total 115cm (45 inch). These dimensions include wheels, handles, and side pockets.",
  {'gen': ['First/Business: 2 pieces, 14 kg total, 10 kg max per piece']}),
 ('Edelweiss', ['Europe'], C([55, 40, 23], None, 8), P([40, 30, 15]), None,
  'https://www.flyedelweiss.com/us/en/prepare/baggage/free-baggage/hand-baggage.html',
  'Size per baggage item 55 x 40 x 23 cm ... Weight per baggage item 8 kg',
  {'gen': ['Business: 2 pieces']}),
 ('Discover Airlines', ['Europe'], C([55, 40, 23], None, 8), P([40, 30, 15]), None,
  'https://www.discover-airlines.com/us/en/book/baggage/carry-on-baggage',
  'The maximum permitted dimensions are 55 x 40 x 23 cm',
  {'co': ['Foldable garment bag 57×54×15 cm instead'], 'gen': ['Business: 2 pieces']}),
 ('Widerøe', ['Europe'], C([55, 40, 20]), P([40, 30, 15]), 8,
  'https://help.wideroe.no/hc/en-gb/articles/29531904831378-Baggage-Rules',
  'one piece of hand luggage (max 55x40x20 cm) ... All cabin baggage must in total not exceed 8 kg.',
  {'gen': ['Mini fare: small bag only; hand luggage can be added']}),
 ('Loganair', ['Europe'], C([40, 35, 18], None, 6), P(), None,
  'https://www.loganair.co.uk/get-ready-to-fly/luggage-guidance/',
  'Your cabin bag must weigh no more than 6kg and measure no more than 40cm x 35cm x 18cm.',
  {'pi': ['A small handbag allowed on every fare; no size given. Fly Flex+ adds a slimline laptop bag']}),
 ('Avelo Airlines', ['North America'], C([55, 35, 22]), P([43, 33, 22], None, None, True), None,
  'https://www.aveloair.com/help/carry-on-bags',
  'no larger than 22”L x 14″H x 9”W (55 cm x 35 cm x 22 cm)',
  {'co': ['Paid add-on']}),
 ('Flair Airlines', ['North America'], C([55, 40, 23], None, 10), P([43, 33, 15], None, 7, True), None,
  'https://website-prd.flyflair.com/travel-info/baggage/allowance-and-fees',
  '23 cm x 40 cm x 55 cm (9 in x 15.5 in x 21.5 in) ... 10 kg (22 lb)',
  {'co': ['Paid add-on or part of a bundle']}),
 ('JetSMART', ['South America'], C([55, 35, 25], None, 10), P([45, 35, 25], None, 10, True), None,
  'https://jetsmart.com/us/en/PreguntasFrecuentes',
  'Carry-on baggage: 55cm x 35cm x 25cm. Max 10 kg',
  {'co': ['Paid add-on; sizes include wheels, handles and pockets']}),
 ('Arajet', ['North America', 'South America'], C([56, 46, 25], None, 12), P([40, 25, 20], None, 6, True), None,
  'https://www.arajet.com/en-us/baggage',
  'Carry-on 56×46×25 cm / 22"×18"×10", 12 kg / 26 lbs',
  {'pi': ['10 kg on flights to/from Brazil'], 'co': ['Paid add-on on the Basic fare']}),
 ('Air Mauritius', ['Africa'], C(None, 115, 7), P(), None,
  'https://www.airmauritius.com/en/before-you-fly/baggage/carry-on-baggage',
  'the dimensions (length + width + height) of a hand baggage should not exceed 115 cm',
  {'gen': ['Rodrigues flights: 1 piece, 5 kg']}),
 ('Alliance Air', ['Asia'], C([40, 30, 15], 85, 5), P(), None,
  'https://plone.allianceair.in/allianceair/en/assets/policy/baggage-policy-eff-07-08-2025.pdf',
  'Height 40 cms (16 inches) + Length 30 cms (12 inches) + Width 15 cms (06 inches) ... Total Dimensions - 85 cms',
  {'co': ['5–10 kg allowed with excess charges at the airport'], 'pi': ['Policy also says a laptop counts toward the 5 kg']}),
 ('Fly91', ['Asia'], C([35, 30, 20], None, 7), P(), None,
  'https://support.fly91.in/portal/en/kb/articles/baggage-allowance',
  'Length: 35 cm, Width: 30 cm, Height: 20 cm ... Upto 7 Kgs',
  {}),
 ('Nepal Airlines', ['Asia'], C([55.9, 45.7, 25.4], None, 7), P(), None,
  'https://www.nepalairlines.com.np/carry-on-baggage',
  'maximum dimension not exceeding 22"x 18" x10" ... total weight not exceeding 7 kg on Economy Class',
  {'pi': ['Handbag, laptop and similar items allowed free; no size given']}),
 ('Drukair', ['Asia'], C([45, 35, 20], None, 5), P(), None,
  'https://drukair.com.bt/experience/before-you-fly/baggage-allowance/',
  'The maximum dimensions allowed for cabin baggage are 45 x 35 x 20 cm (17 x 13 x 8 inches).',
  {'gen': ['Business 7 kg'], 'pi': ['Handbag or purse allowed free; no size given']}),
]

recs = []
for n, r, co, pi, ckg, src, q, nt in A:
    recs.append({'name': n, 'region': r, 'carryOn': co, 'personal': pi, 'combined_kg': ckg, 'fareNote': '',
                 'source': src, 'quote': q, 'checked': T, 'status': 'verified', 'seedDiff': 'Not in seed.'})
json.dump(recs, open(os.path.join(ROOT, 'verified', 'verified-D.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
nf = os.path.join(ROOT, 'notes.json')
notes = json.load(open(nf, encoding='utf-8'))
for n, *_, nt in A:
    if nt: notes[n] = nt
json.dump(notes, open(nf, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(recs), 'added')
