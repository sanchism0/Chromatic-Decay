# Gameplay sprite prompts — Dex & Juno

Copy-paste prompts for the in-game walking sprites. Image generators handle "three frames in a row" well but a strict 4 × 3 grid badly, so **each direction is its own run**:

| Run | Direction | Notes |
|---|---|---|
| 1 | **Down** (toward the camera) | Do this first. Keep the best result as the reference for runs 2 and 3. |
| 2 | **Left** | No right-facing run is needed. The game mirrors the left frames. |
| 3 | **Up** (away from the camera) | |

Each run gives three frames: **left foot forward, standing, right foot forward**. Three runs per character makes 9 frames, which becomes a full 4-direction walk sheet once the left frames are mirrored.

## How to run them

1. **Reference image:** use the character's turnaround (`assets/characters/source/dex-turnaround.jpg` or `juno-turnaround.jpg`) as the image reference at low-to-medium strength. For runs 2 and 3, add your best run-1 result as a second reference.
2. **Paste one block** exactly as written, plus the negative prompt if your generator supports one.
3. **Reject results** that change the hair, skin tone or outfit from the reference, or that put the emitter on the wrong arm. Re-roll until it matches.
4. **Don't fix the pixel grid yourself.** The cleanup pass snaps everything to the grid and locks the palette. Consistency between frames matters most.

## Negative prompt (use with every block)

```
grid of more than 3 frames, extra rows, extra characters, mixed directions,
blurry, anti-aliasing, soft edges, gradients, painterly, jpeg artifacts, noise,
dithering, high detail, detailed face, large sprite, uneven pixel sizes,
3D render, realistic, isometric, perspective distortion, cast shadow, ground,
scenery, text, letters, labels, watermark, border, grid lines, extra limbs,
gun, pistol, rifle, sword, emitter on left arm, missing emitter,
different hairstyle, different skin tone, curly hair, afro
```

(For Juno, delete "curly hair, afro" from the end.)

---

## Dex

**Dex — Run 1: facing down**

```
16-bit pixel art game sprite, exactly 3 frames side by side in one row on a
flat magenta #FF00FF background, nothing else in the image. Three-quarter
top-down view, camera slightly above, like Zelda: A Link to the Past or
Stardew Valley. All 3 frames face DOWN toward the camera. Frame 1: left foot
forward, legs clearly apart. Frame 2: standing still. Frame 3: right foot
forward, legs clearly apart. Arms swing opposite to the legs.
Very low resolution: the character is only 32 pixels tall, chunky square
pixels, simple shapes, two-pixel eyes, minimal facial detail. Chibi
proportions, head about 40% of the height. Same baseline and same size in
every frame. 1-pixel dark outline #0A0B0E, hard pixel edges, flat shading
with one shadow tone per colour, at most 20 colours.
Character: DEX, young man, light-medium skin #E8B48A, messy SPIKY straight
black hair #101216 with one lime streak, dark grey headband #1E2226 with a
lime stripe across the front, small headset on his left ear. Open toxic-lime
hooded jacket #B6FF2E with cyan trim, cuffs and hem #2DE2F0 and cyan shoulder
patches, black t-shirt, black joggers #14161C with lime piping, lime and cyan
high-top sneakers, black fingerless gloves.
Pulse Emitter: a chunky boxy gunmetal bracer #6E7480 with lime tape wraps and
a small glowing white lens #E8F0FF at the wrist, worn on his RIGHT forearm
(it appears on the LEFT side of the image when he faces the camera).
```

**Dex — Run 2: facing left**

```
16-bit pixel art game sprite, exactly 3 frames side by side in one row on a
flat magenta #FF00FF background, nothing else in the image. Three-quarter
top-down view, camera slightly above, like Zelda: A Link to the Past or
Stardew Valley. All 3 frames face LEFT in side profile, walking toward the
left edge of the image. Frame 1: left foot forward, long stride. Frame 2:
standing still, feet together. Frame 3: right foot forward, long stride.
Arms swing opposite to the legs.
Very low resolution: the character is only 32 pixels tall, chunky square
pixels, simple shapes, minimal facial detail. Chibi proportions, head about
40% of the height. Same baseline and same size in every frame. 1-pixel dark
outline #0A0B0E, hard pixel edges, flat shading with one shadow tone per
colour, at most 20 colours.
Character: DEX, young man, light-medium skin #E8B48A, messy SPIKY straight
black hair #101216 with one lime streak, dark grey headband #1E2226 with a
lime stripe and the knot tails visible at the back, small headset. Open
toxic-lime hooded jacket #B6FF2E with cyan trim, cuffs and hem #2DE2F0 and a
cyan shoulder patch, black t-shirt, black joggers #14161C with lime piping,
lime and cyan high-top sneakers, black fingerless gloves.
Pulse Emitter: a chunky boxy gunmetal bracer #6E7480 with lime tape wraps and
a small glowing white lens #E8F0FF at the wrist, worn on his RIGHT forearm,
which is the far arm in this view, partly visible behind his body.
```

**Dex — Run 3: facing up**

```
16-bit pixel art game sprite, exactly 3 frames side by side in one row on a
flat magenta #FF00FF background, nothing else in the image. Three-quarter
top-down view, camera slightly above, like Zelda: A Link to the Past or
Stardew Valley. All 3 frames face UP, away from the camera — we see his back.
Frame 1: left foot forward, legs clearly apart. Frame 2: standing still.
Frame 3: right foot forward, legs clearly apart. Arms swing opposite to the
legs.
Very low resolution: the character is only 32 pixels tall, chunky square
pixels, simple shapes. Chibi proportions, head about 40% of the height. Same
baseline and same size in every frame. 1-pixel dark outline #0A0B0E, hard
pixel edges, flat shading with one shadow tone per colour, at most 20 colours.
Character from behind: DEX, messy SPIKY straight black hair #101216, dark
grey headband #1E2226 knotted at the back with two short tails, back of a
toxic-lime hooded jacket #B6FF2E with the hood down, cyan hem and cuffs
#2DE2F0, black joggers #14161C, lime and cyan high-top sneakers.
Pulse Emitter: a chunky boxy gunmetal bracer #6E7480 with a small white lens
glow #E8F0FF on his RIGHT forearm, which is on the RIGHT side of the image
in this back view.
```

---

## Juno

**Juno — Run 1: facing down**

```
16-bit pixel art game sprite, exactly 3 frames side by side in one row on a
flat magenta #FF00FF background, nothing else in the image. Three-quarter
top-down view, camera slightly above, like Zelda: A Link to the Past or
Stardew Valley. All 3 frames face DOWN toward the camera. Frame 1: left foot
forward, legs clearly apart. Frame 2: standing still. Frame 3: right foot
forward, legs clearly apart. Arms swing opposite to the legs.
Very low resolution: the character is only 32 pixels tall, chunky square
pixels, simple shapes, two-pixel eyes, minimal facial detail. Chibi
proportions, head about 40% of the height. Same baseline and same size in
every frame. 1-pixel dark outline #0A0B0E, hard pixel edges, flat shading
with one shadow tone per colour, at most 20 colours.
Character: JUNO, young woman, fair skin #F3D2BE, short white bob #F2F2F7
fading to lilac tips #B48CFF, undercut on one side, slim dark headset with a
mic on her left ear. Open oversized lilac hooded jacket #C79BFF with violet
panels and hem #7A3DFF, wide sleeves, black crop top #16141C showing her
midriff, dark navy shorts #23283A with a grey belt, black thigh-high
stockings #1A1622, chunky dark grey boots #3A3D47 with glowing violet soles
#9B5CFF, black fingerless gloves.
Pulse Emitter: a slim gunmetal bracer #6E7480 made of a fine wound antenna
coil with one thin antenna fin, violet accents and a small glowing white lens
#E8F0FF at the wrist, worn on her RIGHT forearm (it appears on the LEFT side
of the image when she faces the camera).
```

**Juno — Run 2: facing left**

```
16-bit pixel art game sprite, exactly 3 frames side by side in one row on a
flat magenta #FF00FF background, nothing else in the image. Three-quarter
top-down view, camera slightly above, like Zelda: A Link to the Past or
Stardew Valley. All 3 frames face LEFT in side profile, walking toward the
left edge of the image. Frame 1: left foot forward, long stride. Frame 2:
standing still, feet together. Frame 3: right foot forward, long stride.
Arms swing opposite to the legs.
Very low resolution: the character is only 32 pixels tall, chunky square
pixels, simple shapes, minimal facial detail. Chibi proportions, head about
40% of the height. Same baseline and same size in every frame. 1-pixel dark
outline #0A0B0E, hard pixel edges, flat shading with one shadow tone per
colour, at most 20 colours.
Character: JUNO, young woman, fair skin #F3D2BE, short white bob #F2F2F7
fading to lilac tips #B48CFF, slim dark headset with a mic. Open oversized
lilac hooded jacket #C79BFF with violet panels and hem #7A3DFF, wide sleeves,
black crop top #16141C, dark navy shorts #23283A, black thigh-high stockings
#1A1622, chunky dark grey boots #3A3D47 with glowing violet soles #9B5CFF,
black fingerless gloves.
Pulse Emitter: a slim gunmetal antenna-coil bracer #6E7480 with violet
accents and a small glowing white lens #E8F0FF at the wrist, worn on her
RIGHT forearm, which is the far arm in this view, partly visible behind her
body.
```

**Juno — Run 3: facing up**

```
16-bit pixel art game sprite, exactly 3 frames side by side in one row on a
flat magenta #FF00FF background, nothing else in the image. Three-quarter
top-down view, camera slightly above, like Zelda: A Link to the Past or
Stardew Valley. All 3 frames face UP, away from the camera — we see her back.
Frame 1: left foot forward, legs clearly apart. Frame 2: standing still.
Frame 3: right foot forward, legs clearly apart. Arms swing opposite to the
legs.
Very low resolution: the character is only 32 pixels tall, chunky square
pixels, simple shapes. Chibi proportions, head about 40% of the height. Same
baseline and same size in every frame. 1-pixel dark outline #0A0B0E, hard
pixel edges, flat shading with one shadow tone per colour, at most 20 colours.
Character from behind: JUNO, short white bob #F2F2F7 fading to lilac tips
#B48CFF, back of an oversized lilac hooded jacket #C79BFF with the hood down
and a violet hem #7A3DFF, dark navy shorts #23283A, black thigh-high
stockings #1A1622, chunky dark grey boots #3A3D47 with violet soles #9B5CFF.
Pulse Emitter: a slim gunmetal antenna-coil bracer #6E7480 with a small white
lens glow #E8F0FF on her RIGHT forearm, which is on the RIGHT side of the
image in this back view.
```

---

## What happens after

Send the results over. The cleanup pass:

1. removes the magenta background;
2. snaps each frame to an exact pixel grid at about 32 pixels tall;
3. locks the colours to the palette above;
4. aligns the feet to one baseline;
5. mirrors the left frames to make the right-facing row;
6. packs everything into a 96 × 128 sheet (4 directions × 3 frames).

In the game, walking drives the step frames and aiming drives the facing.

## Not needed

- **Null:** no sprite and no portrait. He only appears as a signal icon and a voice.
- **Diagonals:** optional. If wanted later, run "facing down-left" and "facing up-left" the same way, and mirror them for the right-hand diagonals.
