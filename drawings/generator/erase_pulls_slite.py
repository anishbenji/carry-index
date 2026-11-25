"""Superlite side-only drawing (Gemini v4): remove the two zip pulls Gemini invented on the front edge
(the side photos show none). The three vertical lines behind them are straight, so rows 955-1205 in
x 628-767 are rebuilt from the per-column median of clean rows just above and below."""
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1:3]
a = np.asarray(Image.open(src).convert('L')).astype(np.float32)
ref = np.r_[a[905:950, 628:768], a[1210:1250, 628:768]]
col = np.median(ref, axis=0)
a[955:1206, 628:768] = col[None, :]
Image.fromarray(a.astype(np.uint8)).save(out)
