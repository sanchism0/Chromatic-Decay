"""Pull walk frames off a generated pixel-art sheet onto a clean pixel grid.

  python tools/clean_sprite_sheet.py <sheet.jpg> <out_dir> [colours]

Finds each sprite against the flat background, detects the art-pixel pitch,
samples one colour per art pixel (median of the block centre), drops stray
specks, then locks every frame to one shared palette (k-means, default 24).
Writes q_00.png … in reading order (top row left to right, then next row).
Feed the result to tools/build_dex_sprite.py.
"""
import sys, os
from PIL import Image
import numpy as np
from scipy import ndimage
from scipy.cluster.vq import kmeans2

src, out = sys.argv[1], sys.argv[2]
K = int(sys.argv[3]) if len(sys.argv) > 3 else 24
os.makedirs(out, exist_ok=True)

im = np.asarray(Image.open(src).convert('RGB')).astype(float)
bg = np.median(im[:30, :30].reshape(-1, 3), axis=0)
d = np.sqrt(((im - bg) ** 2).sum(2))
fg = ndimage.binary_opening(d > 28, iterations=2)
lab, n = ndimage.label(ndimage.binary_closing(fg, iterations=6))
sizes = ndimage.sum(np.ones_like(d), lab, range(1, n + 1))
objs = ndimage.find_objects(lab)
boxes = [objs[i] for i in range(n) if sizes[i] > 8000]
boxes.sort(key=lambda b: (round(b[0].start / 300), b[1].start))

def block_err(crop, p, ox, oy):
    h, w, _ = crop.shape
    err, cnt, y = 0.0, 0, oy
    while y + p <= h:
        x = ox
        while x + p <= w:
            blk = crop[int(y) + 1:int(y + p) - 1, int(x) + 1:int(x + p) - 1].reshape(-1, 3)
            if len(blk): err += blk.std(0).sum(); cnt += 1
            x += p
        y += p
    return err / max(cnt, 1)

# Art-pixel pitch: the grid that makes blocks most uniform on the first sprite
b = boxes[0]
crop = im[b[0].start - 8:b[0].stop + 8, b[1].start - 8:b[1].stop + 8][:160, :160]
p = min((block_err(crop, p, ox, oy), p)
        for p in np.arange(5.0, 12.0, 0.05)
        for ox in np.arange(0, p, p / 6) for oy in np.arange(0, p, p / 6))[1]
print('pixel pitch', round(p, 2))

frames = []
for b in boxes:
    y0, y1, x0, x1 = b[0].start - 10, b[0].stop + 10, b[1].start - 10, b[1].stop + 10
    crop, m = im[y0:y1, x0:x1], d[y0:y1, x0:x1] > 28
    _, ox, oy = min((block_err(crop, p, ox, oy), ox, oy)
                    for ox in np.arange(0, p, p / 6) for oy in np.arange(0, p, p / 6))
    nh, nw = int((crop.shape[0] - oy) // p), int((crop.shape[1] - ox) // p)
    rgba = np.zeros((nh, nw, 4), np.uint8)
    for j in range(nh):
        for i in range(nw):
            ys, xs = int(oy + (j + 0.25) * p), int(ox + (i + 0.25) * p)
            ye, xe = int(oy + (j + 0.75) * p), int(ox + (i + 0.75) * p)
            blk, mb = crop[ys:ye, xs:xe].reshape(-1, 3), m[ys:ye, xs:xe].reshape(-1)
            if mb.mean() > 0.5:
                rgba[j, i, :3] = np.median(blk[mb], axis=0)
                rgba[j, i, 3] = 255
    # Drop stray specks, but keep real parts that the outline doesn't join
    # (e.g. a head drawn separate from the body): anything ≥ 10% of the largest
    l2, n2 = ndimage.label(rgba[..., 3] > 0)
    if n2 > 1:
        s2 = ndimage.sum(np.ones(l2.shape), l2, range(1, n2 + 1))
        small = [i + 1 for i in range(n2) if s2[i] < 0.10 * s2.max()]
        rgba[np.isin(l2, small)] = 0
    ys, xs = np.where(rgba[..., 3] > 0)
    frames.append(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy())

# One shared palette across all frames
px = np.concatenate([f[f[..., 3] > 0][:, :3] for f in frames]).astype(float)
cent, _ = kmeans2(px, K, minit='++', seed=3)
for k, f in enumerate(frames):
    msk = f[..., 3] > 0
    c = f[msk][:, :3].astype(float)
    f[msk, :3] = np.clip(cent[((c[:, None] - cent[None]) ** 2).sum(2).argmin(1)], 0, 255).astype(np.uint8)
    Image.fromarray(f, 'RGBA').save(f'{out}/q_{k:02d}.png')
print(len(frames), 'frames', [f.shape[:2] for f in frames])
