"""Carry a Gemini edit over to a hand-fixed sheet without losing the hand fixes.
usage: paste_regions.py old.png new.png target.png out.png "x0,y0,x1,y1;..." [diff.png]
old    = Gemini's previous output (what the hand fixes were applied to)
new    = Gemini's edited output (same chat, 'edit your last image')
target = the hand-fixed sheet (old + manual edits)
boxes  = areas where Gemini's changes are accepted (pixels of the 2048 sheet); "x0,y0,x1,y1:k" keeps only the k largest changed blobs
Each box of `new` is first aligned to `old` by phase correlation (Gemini edits can drift a few px), then the
pixels that differ (|new-old| > 40, dilated 3 px) are copied into target. Everything outside the boxes stays target.
"""
import sys, numpy as np, cv2
old, new, tgt, out, boxes = sys.argv[1:6]
dbg = sys.argv[6] if len(sys.argv) > 6 else None
O = cv2.imread(old, cv2.IMREAD_GRAYSCALE).astype(np.float32)
N = cv2.imread(new, cv2.IMREAD_GRAYSCALE).astype(np.float32)
T = cv2.imread(tgt, cv2.IMREAD_GRAYSCALE).astype(np.float32)
if N.shape != O.shape:
    N = cv2.resize(N, (O.shape[1], O.shape[0]), interpolation=cv2.INTER_AREA)
res = T.copy(); vis = cv2.cvtColor(T.astype(np.uint8), cv2.COLOR_GRAY2BGR)
for b in boxes.split(';'):
    keep = None
    if ':' in b: b, keep = b.split(':'); keep = int(keep)   # keep only the largest `keep` changed blobs
    x0, y0, x1, y1 = map(int, b.split(','))
    o = O[y0:y1, x0:x1]; n = N[y0:y1, x0:x1]
    win = cv2.createHanningWindow((x1 - x0, y1 - y0), cv2.CV_32F)
    (dx, dy), resp = cv2.phaseCorrelate(255 - o, 255 - n, win)
    M = np.float32([[1, 0, -dx], [0, 1, -dy]])
    # shift the whole new image by the box's offset, then cut the box (avoids empty borders)
    Ns = cv2.warpAffine(N, M, (N.shape[1], N.shape[0]), borderValue=255)
    n = Ns[y0:y1, x0:x1]
    d = (np.abs(n - o) > 40).astype(np.uint8)
    d = cv2.morphologyEx(d, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    d = cv2.dilate(d, np.ones((7, 7), np.uint8))
    if keep:
        nlab, lab, st, _ = cv2.connectedComponentsWithStats(d)
        order = 1 + np.argsort(-st[1:, cv2.CC_STAT_AREA])[:keep]
        d = np.isin(lab, order).astype(np.uint8)
    m = d.astype(bool)
    # inside the changed area take new; keep lines that exist in target but not old (hand additions) only outside
    res[y0:y1, x0:x1][m] = n[m]
    vis[y0:y1, x0:x1][m] = (0, 0, 255)
    cv2.rectangle(vis, (x0, y0), (x1, y1), (255, 0, 0), 3)
    print(f'box {b}: shift dx={dx:.1f} dy={dy:.1f} resp={resp:.2f} changed px={int(m.sum())}')
cv2.imwrite(out, np.clip(res, 0, 255).astype(np.uint8))
if dbg: cv2.imwrite(dbg, vis)
