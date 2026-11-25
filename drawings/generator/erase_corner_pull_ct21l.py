"""Remove the corner zip pull Gemini added to the CT21 Lite three-quarter view (sheet x 1455-1481, y 664-806).
The vertical lines behind it are straight, so those rows are rebuilt from the per-column median of clean rows
above (625-660) and below (810-840). usage: erase_corner_pull_ct21l.py sheet.png"""
import sys, numpy as np
from PIL import Image
p = sys.argv[1]
a = np.asarray(Image.open(p).convert('L')).astype(np.float32)
X0, X1 = 1455, 1482
ref = np.r_[a[625:660, X0:X1], a[810:840, X0:X1]]; col = np.median(ref, axis=0)
a[664:807, X0:X1] = col[None, :]
Image.fromarray(a.astype(np.uint8)).save(p)
