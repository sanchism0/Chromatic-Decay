# Cut flat-background character sheets into individual transparent PNGs.
#   python tools/cutout_sheet.py <sheet.jpg> <out_dir> <grid|row> <name1,name2,...>
#   (needs: pip install pillow numpy scipy)
#   grid = 4x2 expression busts, row = turnaround figures left to right
#
# Per piece: clean mask -> (busts) smooth bottom arc -> feathered alpha ->
# semi-transparent outer glow -> background colour un-mixed from soft pixels.
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

src, out_dir, kind, names = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(',')
LOW, HOLE, FEATHER = 20.0, 9.0, 1.3
GLOW_BAND, GLOW_FULL = 14, 95.0          # px inside the edge; colour distance for full opacity

img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
H, W, _ = img.shape
bg = np.median(np.concatenate([img[:24, :24].reshape(-1, 3), img[:24, -24:].reshape(-1, 3),
                               img[-24:, :24].reshape(-1, 3), img[-24:, -24:].reshape(-1, 3)]), axis=0)
dist = np.sqrt(((img - bg) ** 2).sum(axis=2))
dist_s = ndimage.gaussian_filter(dist, 1.5)   # de-noised, for glow alpha
luma = img @ np.array([0.299, 0.587, 0.114], np.float32)
sat = img.max(axis=2) - img.min(axis=2)
bg_luma = float(bg @ np.array([0.299, 0.587, 0.114]))

# Background: near-bg pixels connected to the border, plus big enclosed gaps
lab, _ = ndimage.label(dist < LOW)
edge_ids = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
bgmask = np.isin(lab, edge_ids[edge_ids != 0])
hl, hn = ndimage.label((dist < HOLE) & ~bgmask)
if hn:
    sizes = ndimage.sum(np.ones_like(dist), hl, np.arange(1, hn + 1))
    bgmask |= np.isin(hl, np.where(sizes > 1200)[0] + 1)
fg_all = ~bgmask


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def clean(mask):
    mask = ndimage.binary_closing(mask, iterations=2)
    mask = ndimage.binary_opening(mask, iterations=1)
    l, n = ndimage.label(mask)
    if n:
        sizes = ndimage.sum(np.ones(mask.shape), l, np.arange(1, n + 1))
        mask = l == (sizes.argmax() + 1)                     # the piece itself
    return mask


def smooth_bottom(mask):
    """Busts end in a circular arc. Fit that circle to the bottom profile
    (ignoring notches where dark clothing matched the background), then fill
    each column down to the arc and trim anything below it."""
    ys, xs = np.where(mask)
    y_max, x_min, x_max = ys.max(), xs.min(), xs.max()
    band_top = int(y_max - 0.32 * (y_max - ys.min()))
    span = x_max - x_min
    cols = np.arange(int(x_min + 0.08 * span), int(x_max - 0.08 * span))
    low = np.array([np.where(mask[:, c])[0].max() for c in cols], float)
    px, py = cols.astype(float), low
    for _ in range(8):                                 # robust fit: drop points above the arc
        A = np.c_[2 * px, 2 * py, np.ones_like(px)]
        cx, cy, c = np.linalg.lstsq(A, px ** 2 + py ** 2, rcond=None)[0]
        r = np.sqrt(c + cx ** 2 + cy ** 2)
        d = np.sqrt((px - cx) ** 2 + (py - cy) ** 2)
        keep = d > r - 2.5
        if keep.all():
            break
        px, py = px[keep], py[keep]
    mask = mask.copy()
    for col in cols:
        if abs(col - cx) >= r:
            continue
        arc = cy + np.sqrt(r * r - (col - cx) ** 2)
        if arc < band_top:
            continue
        filled = np.where(mask[band_top:, col])[0]
        if filled.size:
            mask[band_top + filled.min():int(arc) + 1, col] = True
        mask[int(arc) + 1:, col] = False
    return mask


def finish(mask, bust):
    rgb_src = img
    added = np.zeros_like(mask)
    if bust:
        smoothed = smooth_bottom(mask)
        added = smoothed & ~mask                      # notch pixels the art never covered
        mask = smoothed
        if added.any():                               # recolour them from the nearest real art pixel
            _, (iy, ix) = ndimage.distance_transform_edt(~(mask & ~added), return_indices=True)
            rgb_src = img.copy()
            rgb_src[added] = img[iy[added], ix[added]]
    alpha = ndimage.gaussian_filter(mask.astype(np.float32), FEATHER)
    alpha = np.clip((alpha - 0.15) / 0.85, 0, 1)
    # Outer glow: pixels near the edge that are lighter than the background become
    # partly transparent by colour distance (dark line art stays solid)
    inside = ndimage.distance_transform_edt(mask)
    # Only clearly coloured or bright pixels count as glow; dark clothing stays solid
    glowy = (luma > bg_luma + 4) & ((sat > 30) | (luma > bg_luma + 30))
    glow = (inside > 0) & (inside <= GLOW_BAND) & glowy & ~added
    glow_a = ndimage.gaussian_filter(np.clip(dist_s / GLOW_FULL, 0, 1), 1.0)
    alpha = np.where(glow, np.minimum(alpha, glow_a), alpha)
    # Faint dark shadow just outside the line art: fade it by colour distance
    fringe = (inside > 0) & (inside <= 3) & ~glowy & (dist < 45) & ~added
    alpha = np.where(fringe, np.minimum(alpha, np.clip((dist_s - 12) / 33, 0, 1)), alpha)
    a = np.maximum(alpha[..., None], 1e-3)
    rgb = np.where((alpha[..., None] < 0.999) & ~added[..., None], (rgb_src - (1 - a) * bg) / a, rgb_src)
    return np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)


def save(rgba, name):
    ys, xs = np.where(rgba[..., 3] > 4)
    pad = 6
    sub = rgba[max(ys.min() - pad, 0):ys.max() + pad + 1, max(xs.min() - pad, 0):xs.max() + pad + 1]
    Image.fromarray(sub, 'RGBA').save(os.path.join(out_dir, name + '.png'), optimize=True)
    print(name, sub.shape[1], 'x', sub.shape[0])


os.makedirs(out_dir, exist_ok=True)
if kind == 'grid':
    # Find each bust as a shape (not a fixed cell); busts that touch are split
    # at their narrowest join by eroding until they separate, then growing back.
    l, n = ndimage.label(fg_all)
    sizes = ndimage.sum(np.ones_like(dist), l, np.arange(1, n + 1))
    big_ids = [i + 1 for i in range(n) if sizes[i] > 20000]
    single = float(np.median([sizes[i - 1] for i in big_ids]))
    pieces = []
    for i in big_ids:
        comp = l == i
        k = int(round(sizes[i - 1] / single))
        if k <= 1:
            pieces.append(comp)
            continue
        er = comp.copy()
        for _ in range(60):
            er = ndimage.binary_erosion(er)
            el, en = ndimage.label(er)
            es = ndimage.sum(np.ones_like(dist), el, np.arange(1, en + 1)) if en else np.array([])
            if (es > single * 0.2).sum() >= k:
                break
        keep = np.argsort(es)[::-1][:k] + 1
        seeds = np.where(np.isin(el, keep), el, 0)
        _, (iy, ix) = ndimage.distance_transform_edt(seeds == 0, return_indices=True)
        owner = seeds[iy, ix]
        pieces += [comp & (owner == kid) for kid in keep]
    # Reading order: top row then bottom row, left to right
    cents = [ndimage.center_of_mass(p) for p in pieces]
    order = sorted(range(len(pieces)), key=lambda j: (cents[j][0] > H / 2, cents[j][1]))
    assert len(order) == len(names), (len(order), len(names))
    for name, j in zip(names, order):
        save(finish(clean(pieces[j]), bust=True), name)
else:
    big = ndimage.binary_dilation(fg_all, iterations=12)
    l, n = ndimage.label(big)
    sizes = ndimage.sum(np.ones_like(dist), l, np.arange(1, n + 1))
    ids = np.argsort(sizes)[::-1][:len(names)] + 1
    objs = ndimage.find_objects(l)
    for name, i in zip(names, sorted(ids, key=lambda i: objs[i - 1][1].start)):
        m = fg_all & (l == i)
        save(finish(clean(m), bust=False), name)
