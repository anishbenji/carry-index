exec(open('fixpack.py').read())
RI=S+'/review/img/'
tb=white(RI+'tp4-back-sketch.png'); tp=white(PH['tp4']['back'])
HANDLE=closeups([('Example done right: a low, rounded grab-handle loop at the rear top edge (approved drawing of another bag). Draw the top handle like this, sized to this bag\'s photos.',[tb.crop((0,0,tb.width,int(tb.height*.32))),tp.crop((0,0,tp.width,int(tp.height*.4)))])],'Reference: correct top handle')
GI=G+'ct15p/'
files=[('style-reference',GI+'00-style-reference.png'),('handle-reference',HANDLE),('photo-three-quarter',GI+'02-ct15p-2-CT15PlusUltra200X-Black_2.jpg'),('photo-front',GI+'01-ct15p-1-CT15PlusUltra200X-Black_1.jpg'),('photo-side',GI+'03-ct15p-3-CT15PlusUltra200X-Black_3.jpg'),('photo-back',GI+'04-ct15p-4-CT15PlusUltra200X-Black_4.jpg'),('photo-strap-detail',GI+'05-ct15p-7-CT15PlusUltra200X.jpg')]
prompt='''Please create a four-view technical line drawing of the Ctactical CT15 Plus - ULTRA200X backpack (47.5 x 29 x 20.5 cm, H x W x D), in exactly the drawing style of image 1.

Attached images:
- Image 1: style reference sheet (a different bag). Copy its line style and 2x2 layout only, not its features.
- Image 2: an example of a top handle drawn correctly (a different bag).
- Image 3: three-quarter photo of the CT15 Plus.
- Image 4: front photo.
- Image 5: side photo (front of the bag on the viewer's right).
- Image 6: back photo.
- Image 7: close-up of the shoulder strap, back panel and side.

Views and layout: front top-left, three-quarter top-right, back bottom-left, side bottom-right.
- Three-quarter view: match image 3 exactly. The front panel faces the viewer and is turned toward the viewer's right; the side panel that shows is on the viewer's left, with its bottle pocket. Draw that side's details as image 3 shows them; do not invent or mirror details.
- Side view: the bag's front on the viewer's RIGHT, exactly as image 5, including the vertical side grab handle and the bottle pocket where that photo shows them.
- Bottle pocket: its top edge sits about halfway down the bag, as in images 3 and 5. Measure it from the photos; do not drop it lower.

Features to include, all from the photos: the hook-and-loop ID patch centred on the upper front panel, clear of the zip pulls; the horizontal front-pocket zip with its pull at the left; the clamshell zip around the front; the side bottle pockets; the vertical side grab handle; the padded back panel with mesh (dot-mesh pattern); the shoulder straps with their webbing, sternum strap and buckle, and lower adjusters as in images 6 and 7.

Black lines only: no text, no labels, no numbers, no logos (draw the ID patch as a plain outline), no colour, no shading, no fabric-crease or wrinkle lines (ULTRA fabric crinkles, but the drawing shows clean panels). Draw every view at the same scale, with the bag's top and bottom lined up across the front, side and back views. The top of the bag is horizontal, at right angles to the front and back faces. Draw the top grab handle as the photos show it: a low, rounded loop like image 2, never a wide flat strap with stitched box tabs and never a tall upright tab.'''
save('ct15p-first-run',files,prompt)
