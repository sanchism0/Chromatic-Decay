# Characters — Dex & Juno

Two playable characters. The one the player picks is the **operator** (in the field); the other is the **assistant** (in the operator's ear from HQ).

| | Main colour | Second colour |
|---|---|---|
| **Dex** | Toxic lime `#B6FF2E` | Cyan `#2DE2F0` |
| **Juno** | Lilac `#C79BFF` | Violet `#7A3DFF` |

## Layout

```
characters/
├── dex/
│   ├── expressions/   8 dialogue busts, transparent PNG
│   └── turnaround/    three-quarter, front, back — transparent PNG
├── juno/
│   ├── expressions/
│   └── turnaround/
└── source/            original sheets the PNGs were cut from
```

## Expressions

| Dex | Juno |
|---|---|
| neutral | neutral |
| determined | focused |
| cocky-grin | smirk |
| laughing | laughing |
| worried | concerned |
| shocked | alarmed |
| angry | annoyed |
| hurt | soft-smile |

Files are named `<character>-<expression>.png`, e.g. `juno-soft-smile.png`.

## Facing

In dialogue the assistant's portrait sits bottom-left and the operator's bottom-right. Juno's art faces right and Dex's faces left, so whichever pair is on screen they look toward each other — mirror an image horizontally if a layout ever needs the other side.

## Re-cutting

The PNGs are cut from `source/` with `tools/cutout_sheet.py` (removes the flat background, feathers edges, keeps glows soft, smooths the busts' bottom arc):

```
python tools/cutout_sheet.py assets/characters/source/dex-expressions.jpg  assets/characters/dex/expressions  grid dex-neutral,dex-determined,dex-cocky-grin,dex-laughing,dex-worried,dex-shocked,dex-angry,dex-hurt
python tools/cutout_sheet.py assets/characters/source/dex-turnaround.jpg   assets/characters/dex/turnaround   row  dex-three-quarter,dex-front,dex-back
python tools/cutout_sheet.py assets/characters/source/juno-expressions.jpg assets/characters/juno/expressions grid juno-laughing,juno-smirk,juno-focused,juno-neutral,juno-soft-smile,juno-annoyed,juno-alarmed,juno-concerned
python tools/cutout_sheet.py assets/characters/source/juno-turnaround.jpg  assets/characters/juno/turnaround  row  juno-back,juno-front,juno-three-quarter
```

Names are listed in reading order of each sheet (top row left to right, then bottom row).

## In-game sprite (Dex)

`dex/sprite/dex-walk.png` is a 96 × 176 sheet of 32 × 44 cells. Rows: down, left, right, up. Columns: step A, standing, step B. Feet sit on the bottom row of each cell. The game draws it pixel-perfect: one art pixel is 2 screen pixels on desktop and 1 on phones. Walking advances the step frames, and the facing follows the aim.

It's a stand-in built from `source/dex-sprite-sheet-v1.jpg`:

```
python tools/clean_sprite_sheet.py assets/characters/source/dex-sprite-sheet-v1.jpg <frames_dir>
python tools/build_dex_sprite.py <frames_dir> assets/characters/dex/sprite/dex-walk.png
```

The first step snaps the frames to the pixel grid and locks the palette. The second restores the headband stripe, paints the Pulse Emitter bracer on his right forearm, mirrors the right-facing row to make the left-facing one, and packs the sheet. Replace it once final art from `docs/art/sprite-prompts.md` is ready.
