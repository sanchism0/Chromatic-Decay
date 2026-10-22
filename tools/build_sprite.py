"""Build a character's in-game walk sheet from cleaned frames.

  python tools/build_sprite.py <dex|juno> <frames_dir> <out.png>

<frames_dir> holds q_00..q_11.png from tools/clean_sprite_sheet.py: the 12
frames of a generated sheet (rows: down, right, left, up; columns: standing,
step, step). This script:
  - applies per-character fixes (Dex: restores the headband stripe)
  - paints that character's Pulse Emitter bracer on the right forearm
  - mirrors the right-facing frames to make the left-facing row
  - packs a 3 x 4 sheet of 32 x 44 cells, feet on a shared baseline

Sheet layout: rows down, left, right, up; columns step A, standing, step B.
"""
import sys
from PIL import Image
import numpy as np

who, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
F = {k: np.asarray(Image.open(f'{src}/q_{k:02d}.png').convert('RGBA')).copy() for k in range(12)}

OUTLINE = (10, 11, 14)
L, D = (138, 144, 156), (60, 66, 77)       # gunmetal light / dark
W = (232, 240, 255)                        # white lens

CHARACTERS = {
    # Chunky salvaged rig with lime tape
    'dex': {
        'bracer': [[L, L, L, L],
                   [L, (182, 255, 46), L, D],
                   [D, W, W, D]],
        # top-left of the bracer over the cuff of the right arm, per frame
        # (front view: image left; side view: the near arm; back view: image right)
        'at': {0: (1, 27), 1: (1, 25), 2: (1, 26),
               3: (5, 28), 4: (9, 27), 5: (5, 28),
               9: (21, 26), 10: (21, 26), 11: (21, 26)},
    },
    # Slim antenna-coil bracer with a violet accent
    'juno': {
        'bracer': [[L, (122, 61, 255), L],
                   [L, L, D],
                   [D, W, D]],
        'at': {0: (1, 27), 1: (0, 26), 2: (1, 27),
               3: (4, 28), 4: (4, 27), 5: (5, 28),
               9: (20, 26), 10: (21, 27), 11: (20, 26)},
    },
}
cfg = CHARACTERS[who]
BR = cfg['bracer']
BW, BH = len(BR[0]), len(BR)

def paint_bracer(f, x0, y0):
    h, w, _ = f.shape
    for j, row in enumerate(BR):
        for i, c in enumerate(row):
            x, y = x0 + i, y0 + j
            if 0 <= x < w and 0 <= y < h:
                f[y, x] = (*c, 255)
    # outline any bracer edge that now sits against empty space
    for j in range(-1, BH + 1):
        for i in range(-1, BW + 1):
            x, y = x0 + i, y0 + j
            if 0 <= x < w and 0 <= y < h and f[y, x, 3] == 0:
                near = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                if any(x0 <= nx < x0 + BW and y0 <= ny < y0 + BH for nx, ny in near):
                    f[y, x] = (*OUTLINE, 255)

if who == 'dex':
    # Headband stripe: copy the bright lime pixels on the headband from frame 1
    lime = lambda p: p[3] > 0 and p[1] > 200 and p[0] > 120 and p[2] < 120
    for y in range(0, 14):
        for x in range(F[1].shape[1]):
            if lime(F[1][y, x]) and y < F[0].shape[0] and x < F[0].shape[1]:
                F[0][y, x] = F[1][y, x]

for k, (x0, y0) in cfg['at'].items():
    paint_bracer(F[k], x0, y0)

CW, CH = 32, 44
rows = [
    [F[1], F[0], F[2]],                                        # down
    [np.ascontiguousarray(F[k][:, ::-1]) for k in (4, 3, 5)],  # left (mirrored right)
    [F[4], F[3], F[5]],                                        # right
    [F[10], F[9], F[11]],                                      # up
]
sheet = Image.new('RGBA', (CW * 3, CH * 4), (0, 0, 0, 0))
lens = []
for r, row in enumerate(rows):
    for c, f in enumerate(row):
        im = Image.fromarray(f, 'RGBA')
        w, h = im.size
        sheet.alpha_composite(im, (c * CW + (CW - w) // 2, r * CH + CH - 1 - h))
sheet.save(out)

# Lens centre per cell (for src/player.js LENS tables)
a = np.asarray(sheet)
is_lens = (a[..., 0] == W[0]) & (a[..., 1] == W[1]) & (a[..., 2] == W[2]) & (a[..., 3] > 0)
for r in range(4):
    row = []
    for c in range(3):
        ys, xs = np.where(is_lens[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW])
        row.append([round(float(xs.mean()) + 0.5, 1), round(float(ys.mean()) + 0.5, 1)])
    lens.append(row)
print('saved', out, sheet.size)
print('lens', lens)
