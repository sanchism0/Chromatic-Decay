# Core loop: Story unlocks Arcade

A design to react to. Nothing here is built yet. The "Build order" at the end is
the proposed sequence.

## The loop in one line

**Play Story levels → earn Chroma (colour) and unlock characters, powers and
skill-tree nodes → those become cards in Arcade → replay Story levels to farm
more Chroma → buy the rest of each tree in the Workshop.**

```
        ┌──────────── replay levels to farm ────────────┐
        ▼                                                │
  STORY LEVEL ──clear──► Chroma + first-clear unlocks ──► WORKSHOP (skill trees)
        │                                                │
        └── beat L1 with a character → their signature   │
            beat L5 → unlock Raze                         ▼
                                              ARCADE card pool per character
```

## Two modes, two paces

| | Story | Arcade |
|---|---|---|
| Pace | Slower, structured, checkpoints | Fast, endless pressure, 15 waves |
| Goal | Clear the level | Survive, score |
| Colour from kills | **Chroma**: banked to your wallet at the end | Run-only, as now |
| Levelling in the run | None. Your kit is what you've unlocked | Wave clears → pick cards (as now) |
| Rewards | Chroma, unlocks | Score (later: a little Chroma) |

## Chroma (the currency)

- Every kill already drains its colour into the player. In Story that colour
  is counted per type: **violet, yellow, green** (orange and pink later).
- At the end of a level the Chroma you collected is banked. If you fail, you
  keep half of it, so a failed attempt still counts as farming.
- Colours are not interchangeable. Rarer colours buy higher-tier nodes:

  | Tier | Cost |
  |---|---|
  | 1 | violet |
  | 2 | violet + yellow |
  | 3 | yellow + green |

- **Replaying** a cleared level pays full Chroma, and the first clear with each
  character pays a bonus. Later, optional challenges per level (no damage,
  under a time) pay extra.

## Characters

Everyone keeps the emitter (a gun). What sets each character apart is **how
their gun fires**, plus a **signature ability** (Space / F, with a cooldown)
and, later, their skill tree. Damage per second is about even; the delivery
is different.

| Character | Gun | Feel | Signature (beat L1 as them) |
|---|---|---|---|
| **Juno** | **Minigun**: about 5 rounds/s at low damage, with a little spray | Hose the crowd, keep moving | **Spin Up**: fires over twice as fast with a tighter stream for 4 s |
| **Dex** | **Burst**: three quick rounds per trigger pull | Pick a target, punch it | **Arc Discharge**: a ring of shots that knocks nearby enemies back and stuns them |
| **Raze** (gold) | **Heavy**: slow, very strong gold rounds | Every shot counts | **Gold Standard**: the next 3 rounds pierce everything and hit twice as hard |

- **Raze** is the market-crash Echo from the lore, now a **playable gold
  character**, unlocked by clearing L5. You then clear L1 as him for his
  signature. His tree can reuse Arcade's Breaker traits (Short Squeeze,
  Margin Call, Flash Crash…). He needs a sprite before he's playable.
- **Power takes your colour.** Any power you draw from the map (relays now,
  more later) flows into you in your character's colour: green for Dex, pink
  for Juno, gold for Raze. Lock nodes and the exit light up in it too. The
  story beat: you're gaining powers.

### How trees feed Arcade
- Every unlocked node becomes a **card** in that character's Arcade pool,
  alongside the generic cards.
- Some nodes unlock only through **Story milestones** with that character;
  the rest are bought in the Workshop with Chroma.

## Story level structure

Slower and readable, with the operator on comms between beats:

1. **Wave**: clear a fixed set of enemies. No timer.
2. **Task**: an objective under light pressure.
3. **Wave**: harder.
4. **Puzzle**: no time pressure.

From L3 on, some levels end with a **boss**. Each beat is a checkpoint: if you
die, you restart that beat, not the level.

**Levels 1–5 use only violet, yellow and green.**

Tasks are never "stand here for 20 seconds" on their own. Chromatics keep
arriving to interrupt, and anything touching the objective drains it, so a
task is a fight with a goal.

### Task ideas
- **Hold the line**: stand in a zone while it uploads, as enemies come.
- **Relays**: power up 3 relays scattered around the map.
- **Escort**: lead a slow Echo to the exit.
- **Gather**: collect fragments before Chromatics consume them.

### Puzzle ideas (built around the emitter)
- **Sequence**: hit the switches in the order the racks light up.
- **Beam**: shoot a prism, then rotate mirrors so the beam reaches a lock.
- **Plates**: hold plates down; violets drift onto them if you lure them.
- **Tuning**: match a signal pattern by toggling nodes (Juno sees it sooner).

### Levels 1–5: "The Basement" arc (finding Sable)

| # | Level | Wave 1 | Task | Wave 2 | Puzzle | Boss | Unlocks |
|---|---|---|---|---|---|---|---|
| 1 | Server Floor | violet | Relays (3) | violet + yellow | Sequence | none | **Signature** for the character who clears it |
| 2 | Cold Storage | violet + yellow | Escort an Echo | yellow | Plates | none | Tree tier 1 (story nodes) |
| 3 | The Stacks | yellow | Hold the line | violet + yellow | Beam | **The Queue**: a huge violet made of unplayed streams | Tier 2 story node |
| 4 | Wire Room | green (new) | Gather fragments | yellow + green | Tuning | none | Workshop opens in full |
| 5 | Sable's Room | all three | Hold the line | all three | Beam + Sequence | **Signal Hoarder** (green) | **Raze**, and Sable's lore |

L1 replays become the standard way to farm violet. L3 and L5 are the best
farms for yellow and green.

## Screens needed

- **Story map / level select**: the levels, with a clear mark for each
  character, and Chroma on offer.
- **Results**: Chroma collected by colour, first-clear rewards, unlocks.
- **Workshop**: Chroma wallet, and one tree per character (nodes show cost,
  or "Story: beat L3 as Juno").
- **Arcade character select**: shows how many cards each character has
  unlocked.

## Save data (local)

`chroma {violet, yellow, green, …}`, `clears {levelId: {dex, juno, raze}}`,
`unlockedCharacters`, `nodes {character: [ids]}`. Kept in localStorage, with a
Reset option in settings.

## Build order

1. **Foundation (built)**: save data; the level runner with checkpoints;
   Chroma banking and a results screen; the Story map; **Level 1** (wave →
   relays with interrupters → wave → sequence lock → exit).
2. **Guns and signatures (built)**: Juno's minigun, Dex's burst, Raze's heavy
   rounds (data only); Spin Up and Arc Discharge, unlocked by clearing L1, and
   usable in Arcade too.
3. **Workshop**: skill-tree data and UI, and the Arcade card pool per
   character.
4. **Levels 2–5**: the Queue and Signal Hoarder bosses, and Raze.
5. **Tuning**: costs, farm rates and challenge goals.
