"""Build Dex's in-game walk sheet from cleaned frames.

  python tools/build_dex_sprite.py <frames_dir> <out.png>

<frames_dir> holds q_00..q_11.png: the 12 frames from the generated sheet
(rows: down, right, left, up; columns: standing, step, step), already
snapped to the pixel grid and palette-locked. This script:
  - restores the headband stripe on the first front frame
  - paints the Pulse Emitter bracer on his right forearm in every frame
  - mirrors the right-facing frames to make the left-facing row
  - packs a 3 x 4 sheet of 32 x 44 cells, feet on a shared baseline

Sheet layout: rows down, left, right, up; columns step A, standing, step B.
"""
import sys
from PIL import Image
import numpy as np

src, out = sys.argv[1], sys.argv[2]
F = {k: np.asarray(Image.open(f'{src}/q_{k:02d}.png').convert('RGBA')).copy() for k in range(12)}

OUTLINE = (10, 11, 14)
L, D = (138, 144, 156), (60, 66, 77)       # gunmetal light / dark
T, W = (182, 255, 46), (232, 240, 255)     # lime tape / white lens
BRACER = [[L, L, L, L],
          [L, T, L, D],
          [D, W, W, D]]

# Top-left of the 4 x 3 bracer over the cuff of his right arm, per frame
# (front view: image left; side view: the near arm; back view: image right)
EMITTER_AT = {0: (1, 27), 1: (1, 25), 2: (1, 26),
              3: (5, 28), 4: (9, 27), 5: (5, 28),
              9: (21, 26), 10: (21, 26), 11: (21, 26)}

def paint_bracer(f, x0, y0):
    h, w, _ = f.shape
    for j, row in enumerate(BRACER):
        for i, c in enumerate(row):
            x, y = x0 + i, y0 + j
            if 0 <= x < w and 0 <= y < h:
                f[y, x] = (*c, 255)
    # outline any bracer edge that now sits against empty space
    for j in range(-1, 4):
        for i in range(-1, 5):
            x, y = x0 + i, y0 + j
            if 0 <= x < w and 0 <= y < h and f[y, x, 3] == 0:
                near = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                if any(x0 <= nx < x0 + 4 and y0 <= ny < y0 + 3 for nx, ny in near):
                    f[y, x] = (*OUTLINE, 255)

# Headband stripe: copy the bright lime pixels on the headband from frame 1
lime = lambda p: p[3] > 0 and p[1] > 200 and p[0] > 120 and p[2] < 120
for y in range(0, 14):
    for x in range(F[1].shape[1]):
        if lime(F[1][y, x]) and y < F[0].shape[0] and x < F[0].shape[1]:
            F[0][y, x] = F[1][y, x]

for k, (x0, y0) in EMITTER_AT.items():
    paint_bracer(F[k], x0, y0)

CW, CH = 32, 44
rows = [
    [F[1], F[0], F[2]],                                   # down
    [np.ascontiguousarray(F[k][:, ::-1]) for k in (4, 3, 5)],  # left (mirrored right)
    [F[4], F[3], F[5]],                                   # right
    [F[10], F[9], F[11]],                                 # up
]
sheet = Image.new('RGBA', (CW * 3, CH * 4), (0, 0, 0, 0))
for r, row in enumerate(rows):
    for c, f in enumerate(row):
        im = Image.fromarray(f, 'RGBA')
        w, h = im.size
        sheet.alpha_composite(im, (c * CW + (CW - w) // 2, r * CH + CH - 1 - h))
sheet.save(out)
print('saved', out, sheet.size)
