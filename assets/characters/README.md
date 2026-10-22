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

## In-game sprites

`dex/sprite/dex-walk.png` and `juno/sprite/juno-walk.png` are 96 × 176 sheets of 32 × 44 cells. Rows: down, left, right, up. Columns: step A, standing, step B. Feet sit on the bottom row of each cell.

The game draws them pixel-perfect: one art pixel is 2 screen pixels on desktop and 1 on phones. Walking advances the step frames, the facing follows the aim, and shots leave from the emitter lens. The player picks Dex or Juno on the "Who goes in?" screen before each Arcade run.

Both are stand-ins built from the generated sheets in `source/`:

```
python tools/clean_sprite_sheet.py assets/characters/source/dex-sprite-sheet-v1.jpg  <dex_frames>
python tools/build_sprite.py dex  <dex_frames>  assets/characters/dex/sprite/dex-walk.png

python tools/clean_sprite_sheet.py assets/characters/source/juno-sprite-sheet-v1.jpg <juno_frames>
python tools/build_sprite.py juno <juno_frames> assets/characters/juno/sprite/juno-walk.png
```

**What each step does:**
- `clean_sprite_sheet.py` snaps the frames to the pixel grid and locks the palette.
- `build_sprite.py`:
  - paints that character's Pulse Emitter bracer on the right forearm (Dex: chunky with lime tape; Juno: slim with a violet accent)
  - applies any per-character fixes (Dex's headband stripe)
  - mirrors the right-facing row to make the left-facing one
  - packs the sheet and prints the lens positions used by `LENS` in `src/player.js`

Replace them once final art from `docs/art/sprite-prompts.md` is ready.
