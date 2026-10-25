"""Build Raze's in-game walk sheet from his cleaned frames.

  python tools/clean_sprite_sheet.py <grid-free sheet> <frames_dir> 28 11.1
  python tools/build_raze_sprite.py <frames_dir> assets/characters/raze/sprite/raze-walk.png

His generated sheet (assets/characters/source/raze-sprite-sheet-v1.jpg) has
black grid lines; paint them over with the magenta background first. Its rows:
front x3; left, three-quarter right, right; left, three-quarter right, right;
back x3. Magenta fringe pixels left on the edges are removed here.

Sheet layout (same as Dex and Juno): rows down, left, right, up; columns
step A, standing, step B; 32 x 44 cells, feet on the bottom row. Prints the
muzzle point per cell (his rifle hand) for src/player.js LENS.
"""
import sys
from PIL import Image
import numpy as np
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]

def load(k):
    a = np.asarray(Image.open(f'{src}/q_{k:02d}.png').convert('RGBA')).copy().astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    a[(a[..., 3] > 0) & (r - g > 40) & (b - g > 40)] = 0          # magenta fringe
    lab, n = ndimage.label(a[..., 3] > 0)
    if n > 1:
        s = ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1))
        a[np.isin(lab, [i + 1 for i in range(n) if s[i] < 0.10 * s.max()])] = 0
    return a.astype(np.uint8)

F = {k: load(k) for k in range(12)}
mirror = lambda a: np.ascontiguousarray(a[:, ::-1])
rows = [
    [F[1], F[0], F[2]],              # down
    [F[3], mirror(F[4]), F[6]],      # left
    [F[5], F[4], F[8]],              # right
    [F[10], F[9], F[11]],            # up
]
CW, CH = 32, 44
sheet = Image.new('RGBA', (CW * 3, CH * 4), (0, 0, 0, 0))
lens = []
for r, row in enumerate(rows):
    lrow = []
    for c, f in enumerate(row):
        h, w, _ = f.shape
        ox, oy = c * CW + (CW - w) // 2, r * CH + CH - 1 - h
        sheet.alpha_composite(Image.fromarray(f, 'RGBA'), (ox, oy))
        # Muzzle: the hand at about two thirds down the body; front-most edge
        # for side views, his rifle side (image left) facing down, centre facing up
        y = int(h * 0.66)
        xs = np.where(f[y, :, 3] > 0)[0]
        if r == 0:   x = xs.min()
        elif r == 1: x = xs.min()
        elif r == 2: x = xs.max()
        else:        x = (xs.min() + xs.max()) / 2
        lrow.append([round(ox - c * CW + x + 0.5, 1), round(oy - r * CH + y + 0.5, 1)])
    lens.append(lrow)
sheet.save(out)
print('saved', out, sheet.size)
# His coat is gold, never orange (owner's rule): recolour the new sheet
import subprocess, sys as _sys, os as _os
subprocess.run([_sys.executable, _os.path.join(_os.path.dirname(__file__), 'recolor_raze.py'), out], check=True)
print('lens', lens)
