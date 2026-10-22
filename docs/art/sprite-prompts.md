# Gameplay sprite prompts — Dex & Juno

Prompts for generating the in-game walking sprites. They're written so the output drops straight into the game after a cleanup pass (snap to grid, lock the palette, remove the background).

## What the game needs

One sheet per character, in the standard top-down RPG layout:

| | Column 1 | Column 2 | Column 3 |
|---|---|---|---|
| **Row 1 — facing down** (toward camera) | left foot forward | standing | right foot forward |
| **Row 2 — facing left** | step | standing | step |
| **Row 3 — facing right** | step | standing | step |
| **Row 4 — facing up** (away from camera) | left foot forward | standing | right foot forward |

- **Frame:** 32 × 32 pixels, with the character about 30 pixels tall, feet on the same baseline in every frame.
- **Sheet:** 96 × 128 pixels, delivered at 8× (768 × 1024) so every art pixel is an exact 8 × 8 block.
- **View:** top-down three-quarter, the camera slightly above, like Zelda: A Link to the Past or Stardew Valley.
- **Pulse Emitter:** on the right forearm in every frame, with a small white lens at the wrist. It's a bracer, not a gun.
- **Background:** flat magenta `#FF00FF`, so it can be removed cleanly.

## Shared spec (paste at the start of both prompts)

```
16-bit pixel art sprite sheet for a top-down action game, three-quarter top-down
view (camera slightly above, like Zelda: A Link to the Past or Stardew Valley).
Exactly 4 rows and 3 columns on a strict grid, 12 frames, each frame 32x32 pixels,
rendered at 8x scale so every art pixel is a perfectly square 8x8 block of one
flat colour. Row 1 facing down toward the camera, row 2 facing left, row 3 facing
right, row 4 facing up away from the camera. In each row: column 1 left foot
forward, column 2 standing neutral, column 3 right foot forward. Row 3 is an
exact horizontal mirror of row 2. Chibi proportions: large head about 40% of the
height, character about 30 pixels tall, feet on the same baseline in every frame,
centred in each cell. Identical character design, colours and details in all 12
frames. 1-pixel dark outline #0A0B0E around the silhouette, hard pixel edges,
no anti-aliasing, flat cel shading with one shadow tone per colour, limited
palette of at most 20 colours. Solid flat magenta #FF00FF background, no ground,
no cast shadow, no text, no labels, no grid lines, no border.
```

## Dex

```
[shared spec]

Character: DEX, a young man, light-medium skin (#E8B48A, shadow #B97E5A),
messy spiky black hair (#101216) with one lime streak, dark grey headband
(#1E2226) with a lime stripe across the front, small dark headset on the left
ear. Oversized open toxic-lime hooded bomber jacket (#B6FF2E, shadow #6FB81A)
with bright cyan trim, cuffs and hem (#2DE2F0, shadow #1A8FA0) and cyan
hexagon shoulder patches; black t-shirt; black cargo joggers (#14161C) with
thin lime piping; lime and cyan high-top sneakers; black fingerless gloves.
On his RIGHT forearm: a chunky, boxy, salvaged Pulse Emitter bracer (gunmetal
#6E7480, dark #3C424D) built around a microwave magnetron, with visible coil
rings, lime tape wraps and a small glowing white lens at the wrist (#E8F0FF).
The emitter is visible in every frame. Confident, easygoing posture.
```

## Juno

```
[shared spec]

Character: JUNO, a young woman, fair skin (#F3D2BE, shadow #CFA48C), short
white bob haircut (#F2F2F7) fading to lilac at the tips (#B48CFF) with one side
undercut, violet eyes, slim dark headset with a mic on the left ear. Oversized
open lilac hooded jacket (#C79BFF, shadow #8F63D6) with violet panels and hem
(#7A3DFF) and dark grey side panels (#2A2438), wide sleeves; black crop top
(#16141C) showing her midriff; dark navy shorts (#23283A) with a grey belt;
black thigh-high stockings (#1A1622) with a thigh strap; chunky dark grey
boots (#3A3D47) with glowing violet soles (#9B5CFF); black fingerless gloves.
On her RIGHT forearm: a slim Pulse Emitter bracer (gunmetal #6E7480) made of a
fine hand-wound antenna coil with one thin antenna fin, violet accents and a
small glowing white lens at the wrist (#E8F0FF). The emitter is visible in
every frame. Calm, precise posture.
```

## Negative prompt (if your generator supports one)

```
blurry, anti-aliasing, soft edges, gradients, painterly, airbrushed, jpeg
artifacts, noise, dithering, sub-pixel detail, uneven pixel sizes, 3D render,
realistic, isometric diamond grid, perspective distortion, cast shadow, ground
plane, scenery, text, letters, numbers, labels, watermark, signature, frame
border, grid lines, extra limbs, missing emitter, gun, pistol, rifle, sword,
inconsistent outfit between frames, different hairstyle between frames
```

## Tips for the generator

- **If it won't follow the 4×3 grid,** generate one direction at a time ("3 frames in a row, facing down …"), then the other directions with the first image as a reference, so the design stays consistent.
- **Image-to-image:** use the matching turnaround in `assets/characters/source/` (`dex-turnaround.jpg`, `juno-turnaround.jpg`) as the reference image at low-to-medium strength, so the outfit matches the portraits.
- **Most important check:** the same headband stripe (Dex) or hair fade (Juno), the same emitter, and the same colours in all 12 frames. Inconsistent frames flicker when they animate.
- **Don't worry about a perfect pixel grid.** The cleanup pass snaps the image to the 8× grid and locks the palette to the colours listed above. Consistent frames and a clean silhouette matter more.

## Not needed

- **Null:** no sprite and no portrait. He only appears as a signal icon and a voice.
- **Diagonal directions:** optional. They would smooth out 360° aiming. If wanted later, add four rows using the same spec (down-left, down-right, up-left, up-right, with the right-hand rows mirroring the left).
