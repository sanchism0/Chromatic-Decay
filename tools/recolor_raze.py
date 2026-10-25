"""Shift Raze's orange accents (coat, dreadlock tips, trim) to gold.

Owner, Oct 25 2026: "I prefer for his color to be more gold or yellow than
orange... dont make his stuff orange." Only saturated orange pixels move
(hue 18-46 degrees, saturation over 0.7, not too dark); skin, browns, blacks
and greys are left alone. Each moves toward his gold (#FFD23F, hue 46) and
brightens a touch, keeping its own light and shade.

    python3 tools/recolor_raze.py assets/characters/raze/sprite/raze-walk.png

Run once on the walk sheet (the portraits are already gold). Running it again
nudges the colours further.
"""
import colorsys, sys
from PIL import Image

def shift(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    deg = h * 360
    if not (18 <= deg <= 46 and s > 0.7 and v > 0.38):
        return None
    # Pull the hue up toward 44 (the gold of his portraits): oranges become gold, golds stay put
    nd = deg + (44 - deg) * 0.8
    nv = min(1, v * 1.06)
    nr, ng, nb = colorsys.hsv_to_rgb(nd / 360, s, nv)
    return round(nr * 255), round(ng * 255), round(nb * 255)

for path in sys.argv[1:]:
    im = Image.open(path).convert('RGBA')
    px = im.load()
    n = 0
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0: continue
            c = shift(r, g, b)
            if c: px[x, y] = (*c, a); n += 1
    im.save(path)
    print(path, n, 'pixels moved to gold')
