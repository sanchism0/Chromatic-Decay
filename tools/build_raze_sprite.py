"""Build Raze's in-game walk sheet from his cleaned frames.

  python tools/clean_sprite_sheet.py assets/characters/source/raze-sprite-sheet-v2.jpg <frames_dir> 28 10.6
  python tools/build_raze_sprite.py <frames_dir> assets/characters/raze/sprite/raze-walk.png

Sheet v2 (the owner's, Oct 2026; replaced v1, which read badly at game size)
on magenta, 17 frames in reading order: front x3; left walk, left stand,
three-quarter back; right x5 with one left walk (q_09); backs and a front.
10.6 forces a ~10.85 px grid so he stands 42 px tall like Dex and Juno.
Facing left and right share one stride: left walk, left stand, and the
right walk (q_08) mirrored; facing right is the same three flipped.
Magenta fringe pixels left on the edges are removed here.

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
    a[(a[..., 3] > 0) & (r - g > 22) & (b - g > 22) & (b > 35)] = 0   # magenta fringe (dark JPEG edge too)
    lab, n = ndimage.label(a[..., 3] > 0)
    if n > 1:
        s = ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1))
        a[np.isin(lab, [i + 1 for i in range(n) if s[i] < 0.10 * s.max()])] = 0
    return a.astype(np.uint8)

F = {k: load(k) for k in range(17)}
mirror = lambda a: np.ascontiguousarray(a[:, ::-1])
rows = [
    [F[0], F[1], F[2]],                          # down
    [F[3], F[4], mirror(F[8])],                  # left
    [mirror(F[3]), mirror(F[4]), F[8]],          # right
    [F[15], F[12], F[16]],                       # up (the backs with his rifle)
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
# (v2's coat is already gold; recolor_raze.py was for v1's orange)
print('lens', lens)
