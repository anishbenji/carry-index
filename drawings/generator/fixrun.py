exec(open('fixpack.py').read())
RI=S+'/review/img/'; R=U+'raw source images/'
def rv(id,v,k): return white(RI+f'{id}-{v}-{k}.'+('png' if k=='sketch' else 'jpg'))
def pair(id,v): return [rv(id,v,'sketch'),rv(id,v,'photo')]
# handle example: TP4 back view (approved) top crop + its photo top crop
tb=white(RI+'tp4-back-sketch.png'); tp=white(PH['tp4']['back'])
HANDLE=closeups([('Example done right: a low, rounded grab-handle loop at the rear top edge (Travel Pack 4 back view, approved). Draw top handles like this, sized to each bag\'s photo.',[tb.crop((0,0,tb.width,int(tb.height*.32))),tp.crop((0,0,tp.width,int(tp.height*.4)))])],'Reference: correct top handle')

COMMON='''Black lines only: no text, no labels, no numbers, no colour, no shading, no fabric-crease or wrinkle lines (ULTRA fabric crinkles, but the drawing shows clean panels). Same line style as image 1. Keep the 2x2 layout: front top-left, three-quarter top-right, back bottom-left, side bottom-right. Draw every view at the same scale, with the bag's top and bottom lined up across the front, side and back views. The top of the bag is horizontal, at right angles to the front and back faces; ignore any lean in the photos caused by packing. Draw every top grab handle as the photos show it: a low, rounded loop (see the handle reference), never a wide flat strap with stitched box tabs and never a tall upright tab.'''
ISO='''Three-quarter view angle: match the three-quarter product photo exactly. The front panel faces the viewer and is turned toward the viewer's right; the side panel that shows is on the viewer's left. Draw the details of that side as the three-quarter photo shows them (do not mirror the current drawing; one-sided details must stay on their real side).'''

B={}
B['cpp2']=dict(name='Aer City Pack Pro 2 Ultra 24L',dims='46 x 30.5 x 18 cm (H x W x D)',
 photos=[('photo-three-quarter',PH['cpp2']['iso']),('photo-front',PH['cpp2']['front']),('photo-side-front-left',PH['cpp2']['side']),('photo-side-front-right',R+'cpp2/cpp2-5-sideleft.jpg'),('photo-back',PH['cpp2']['back'])],
 handle=True,
 rows=[('1. Top handle wrong in all four views (wide flat strap / tall block). It is a narrow rounded handle arching above the top at the rear edge.',pair('cpp2','front')+pair('cpp2','iso')[:1]),
       ('1 (cont). Side view: tall square block where the photo shows a low hump.',pair('cpp2','side')),
       ('2. Back panel: draw the mesh panel with its padded centre channel (dot-mesh pattern, as the side pockets of other sheets).',pair('cpp2','back')),
       ('3. Three-quarter view must show the side in the three-quarter photo: fabric bottle pocket with an angled opening, and the side grab handle running down into it (side photo, front on the right).',[rv('cpp2','iso','photo'),white(R+'cpp2/cpp2-5-sideleft.jpg')])],
 fixes='''1. Top handle, all four views: replace the wide flat strap with a narrow, rounded grab handle that arches clearly above the top, anchored side to side at the rear top edge behind the main zip (front, back and three-quarter photos). In the side view it is a low hump, not a tall block.
2. Back view: draw the back panel as in the back photo: mesh panel (dot-mesh pattern) with a padded centre channel.
3. Three-quarter view: redraw at the photo angle (rule below). That side has a bottle pocket made of the bag fabric, not mesh, with an angled opening edge, and the vertical side grab handle running down into the pocket, exactly as in the side photo with the front on the right.
4. Keep the front view and the side view (front on the left, D-ring, side zip pocket, angled pocket edge, no side handle) as they are, apart from the top handle.''')
B['tp4']=dict(name='Aer Travel Pack 4 Ultra 28L',dims='49 x 32 x 20 cm (H x W x D)',
 photos=[('photo-three-quarter',PH['tp4']['iso']),('photo-front',PH['tp4']['front']),('photo-side-front-left',PH['tp4']['side']),('photo-side-front-right',R+'tp4/tp4-5-sideleft.jpg'),('photo-back',PH['tp4']['back'])],
 handle=True,
 rows=[('1. Top handle in front and three-quarter views: wide flat strap with box tabs. Should be a low rounded loop at the rear top edge (the back view is right).',pair('tp4','front')),
       ('2-4. Three-quarter view: bottle pocket starts too low (64% down vs 45%), front-pocket zip pull tabs missing at both ends, side handle into the pocket missing.',pair('tp4','iso')+[white(R+'tp4/tp4-5-sideleft.jpg')])],
 fixes='''1. Top handle in the front and three-quarter views: a low, rounded loop at the rear top edge, barely showing over the top in the front view. Keep the back view's handle, which is already right.
2. Three-quarter view, bottle pocket: its top edge sits at about 45% of the bag's height from the top, level with the front pocket zip (now it starts at about 64%). Mesh, drawn with the same dot pattern as the side view.
3. Three-quarter view: add the small zip pull tabs at both ends of the front pocket zip, sticking out past the side seams, as in the front view and the photo.
4. Three-quarter view: redraw at the photo angle (rule below). That side has the vertical side grab handle running down into the bottle pocket, as in the side photo with the front on the right.
5. Keep the side view (front on the left, no side handle) and the back view as they are.''')
def ct(id,name,dims,extra,keepside=True,extrarows=()):
    P=PH[id]
    return dict(name=name,dims=dims,handle=False,
     photos=[('photo-three-quarter',P['iso']),('photo-front',P['front']),('photo-side',P['side']),('photo-back',P['back'])],
     rows=list(extrarows)+[('Three-quarter view: wrong side shown, top slopes forward, bottle pocket starts too low. Redraw at the photo angle.',pair(id,'iso')),('Side view: top must be horizontal; top handle slightly smaller.',pair(id,'side'))],
     fixes=extra)
CTRULE='''Side view: the bag's front on the viewer's RIGHT, exactly as the side photo, with the vertical side grab handle where that photo shows it (the current side view is already in this orientation).'''
B['ct15l']=ct('ct15l','Ctactical CT15 Lite - ULTRA200X','47.5 x 29 x 16 cm (H x W x D)','''1. Top of the bag horizontal in the side and three-quarter views (now it slopes down toward the front).
2. Side view: make the top grab handle slightly smaller, a low loop as in the side photo.
3. Three-quarter view: redraw at the photo angle (rule below). That side shows the side grab handle and the bottle pocket.
4. Three-quarter view, bottle pocket: its top edge at about 52% of the bag's height from the top (now about 60%). Do not draw a zip down the pocket's front edge unless the three-quarter photo shows one.
5. Three-quarter view: keep the ID patch centred on the upper front panel, clear of the main zip pulls.
6. Keep the front and back views as they are.''')
B['ct21l']=ct('ct21l','Ctactical CT21 Lite - ULTRA400X','47.5 x 34 x 18.5 cm (H x W x D)','''1. Top of the bag horizontal in the side and three-quarter views (now it slopes down toward the front).
2. Side view: make the top grab handle slightly smaller, a low loop as in the side photo.
3. Three-quarter view: redraw at the photo angle (rule below), showing that side's details as the photo does.
4. Three-quarter view, bottle pocket: its top edge at about 53% of the bag's height from the top (now about 63%).
5. Keep the front and back views as they are.''')
B['ct21p']=ct('ct21p','Ctactical CT21 Plus - ULTRA400X','47.5 x 34 x 21.5 cm (H x W x D)','''1. Top of the bag horizontal in ALL four views (now the top face slopes down toward the front).
2. Side view: the top grab handle is a low loop as in the side photo, not an upright tab.
3. Back view: draw the padded back panels with mesh (dot-mesh pattern), as in the back photo.
4. Three-quarter view: redraw at the photo angle (rule below), showing that side's details as the photo does.
5. Three-quarter view, bottle pocket: its top edge at about 59% of the bag's height from the top (now about 64%).
6. Keep the front view as it is.''',extrarows=[('Back view: back panel drawn plain; the photo shows padded panels with mesh.',pair('ct21p','back'))])
B['ct21p']['photos'].append(('photo-back-panel-detail',R+'ct21p/ct21p-4-CT21PlusUltra400XBlack_4.jpg'))
B['ct21p']['handle']=True
B['ct15l']['photos'].append(('photo-strap-detail',R+'ct15l/ct15l-5-CT15_Lite_Ultra200X.jpg'))
B['slite']=dict(name='Tortuga Superlite Backpack',dims='53 x 32 x 20 cm (H x W x D)',handle=True,
 photos=[('photo-three-quarter',S+'/slite/slite-official-1-superlite-backpack_3-4right.webp'),('photo-three-quarter-launch',PH['slite']['iso']),('photo-front',PH['slite']['front']),('photo-side',PH['slite']['side']),('photo-back',PH['slite']['back']),('photo-bottle-pocket',S+'/slite/slite-ph-water-bottle.jpg')],
 rows=[('1. Side view top handle: tall upright tab. The photos show a low padded loop. Largest handle error of the set.',pair('slite','side')),
       ('2. Front view: add the small round logo patch on the upper front panel (as an outline only, no text).',pair('slite','front')),
       ('3-5. Three-quarter view: wrong side (bottle pocket must show), pocket starts too low (63% vs 52%), top must be horizontal, remove the stray crease tick.',pair('slite','iso'))],
 fixes='''1. Side view: the top grab handle is a low, padded, rounded loop, not a tall upright tab. Keep everything else in the side view, including the vertical side handle and the hip belt.
2. Front view: add the small round logo patch on the upper front panel, drawn as a plain circle outline with no text or logo inside.
3. Three-quarter view: redraw at the photo angle (rule below). That side has the stretch bottle pocket and no side handle.
4. Three-quarter view, bottle pocket: its top edge at about 52% of the bag's height from the top (now about 63%).
5. Top of the bag horizontal in the side and three-quarter views. The Superlite is a cuboid with rounded edges; the lean in the side photo is from a packed-out base.
6. No stray crease marks anywhere.''')
# EDX
EO='/mnt/user-data/outputs/edx-own/'
B['edx']=dict(name='Matador x Carryology EDX Ultra Backpack',dims='45 x 27 x 20 cm (H x W x D)',handle=False,sheet=lambda: sheet4('edx'),
 photos=[('photo-three-quarter',R+'MATEDXB3001BK_Matador_EDX3_Backpack_Black_WebCarousel1.webp'),('photo-front',S+'/edx_4475040a_r90.jpg'),('photo-side-front-left',EO+'edx-own-07-side-front-left.jpg'),('photo-side-front-right',EO+'edx-own-13-side-front-right-clean.jpg'),('photo-back-harness',EO+'edx-own-05-back-harness.jpg'),('photo-back-panel',EO+'edx-own-06-back-panel.jpg'),('photo-back-tabs-closeup',EO+'edx-own-04-back-panel-closeup.jpg')],
 rows=[('1-2. Side view: missing the full-height side pocket; the upper side has a cord loop and the rubberised main zip, not a double-pull zip and diagonal seam; top too domed.',pair('edx','side')),
       ('3. Back view: keep the logo tabs; use the X-shaped hook sternum buckle; mesh panel narrow at mid-back widening toward the base, central webbing strip.',pair('edx','back')),
       ('4. Three-quarter view: wrong angle.',pair('edx','iso'))],
 fixes='''1. Side and three-quarter views: each side has a flat pocket running from about a quarter of the way down to the base, with a straight top edge, a small fabric pull loop at its rear top corner, and a zip down its front edge (both side photos; both sides match).
2. Side view: at the top, the black cord loop runs diagonally down from the top and the rubberised main zip runs over the top edge. Remove the double-pull zip and the diagonal seam now drawn across the side. The top is squarer, with rounded edges, not domed.
3. Back view: keep the two script logos on the shoulder-strap tabs, exactly as now. This bag is a special-edition collaboration, so these logos are the one exception to the no-logos rule. The sternum strap uses an X-shaped hook buckle with triangular sliders (back photo), not a side-release buckle. The back panel is mesh, narrow at mid-back and widening toward the base, with a central webbing strip (back-panel photo). No printed label text.
4. Three-quarter view: redraw at the photo angle (rule below). The front pocket's vertical zip runs down the viewer's right edge of the front panel.
5. Keep the front view as it is: horizontal seam about a third of the way down, vertical zip down the right edge of the front panel with its pull at the top, base band.''')
B['edx']['common_override']=COMMON.replace('no text, no labels','no text (except the two strap-tab logos described below), no labels')
# Cicada
B['cicada']=dict(name='ULA Equipment ULTRA Cicada',dims='45.7 x 28 x 12.7 cm (H x W x D)',handle=False,sheet=lambda: sheet4('cicada'),
 photos=[('photo-three-quarter',R+'CicadaMuse-6.webp'),('photo-front',R+'CicadaMuse-2.webp'),('photo-side-front-right',R+'CicadaMuse-3.jpg'),('photo-side-front-left',R+'CicadaMuse-5.jpg'),('photo-back',R+'CicadaMuse-4.webp')],
 rows=[('Three-quarter view: wrong angle (front turned to the viewer\'s left, pocket edge drawn level). Redraw at the photo angle; the pocket opening is higher at the front and slopes down toward the rear, as in the side photos.',[white(U+'cicada/sketch/cicada-sketch-iso.png'),white(R+'CicadaMuse-6.webp'),white(R+'CicadaMuse-3.jpg')]),
       ('Side view is correct (front on the left, matches the side photo): keep it as it is.',[white(U+'cicada/sketch/cicada-sketch-side.png'),white(R+'CicadaMuse-5.jpg')])],
 fixes='''1. Three-quarter view: redraw at the photo angle (rule below). The visible side has the mesh bottle pocket. Its opening is higher at the front of the bag and slopes down toward the rear, exactly as in both side photos; it is not level. Take the pocket's height from the photos.
2. Keep the front, back and side views exactly as they are (the side view, front on the left, already matches the side photo).''')
import os
ORDER=os.environ.get('ONLY','cpp2 tp4 ct15l ct21l ct21p slite edx cicada').split()
for id in ORDER:
    b=B[id]
    sh=b['sheet']() if 'sheet' in b else sheet6(id)
    files=[('current-sheet',sh),('fix-closeups',closeups(b['rows'],f"{b['name']}: problems to fix (current drawing left, photo right)"))]
    if b['handle']: files.append(('handle-reference',HANDLE))
    files+=b['photos']
    names=[f for f,_ in files]
    idx={n:i+1 for i,n in enumerate(names)}
    plist='\n'.join(f'- Image {i+1} ({n}): '+{'current-sheet':'the current four-view drawing to correct; keep its line style','fix-closeups':'close-ups of each problem, current drawing beside the photo','handle-reference':'an example of a top handle drawn correctly'}.get(n,n.replace('photo-','photo, ').replace('-',' ')) for i,n in enumerate(names))
    side = CTRULE if id in ('ct15l','ct21l','ct21p') else 'Side view: keep its current orientation and details unless a fix below says otherwise.'
    prompt=f'''Please redraw this technical line drawing of the {b['name']} ({b['dims']}), correcting the problems listed below. Keep everything that is not listed exactly as it is in image 1.

Attached images:
{plist}

Fixes:
{b['fixes']}

{ISO}
{side}

{b.get('common_override',COMMON)}'''
    save(id,files,prompt)
