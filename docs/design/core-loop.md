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

Each has their own **playstyle**, a **signature ability** (Space / F, with a
cooldown) and a **skill tree** of 3 branches × 3 tiers.

### Dex: brawler ("Hits it until it works")
Gets close and stays there. Short range, high impact, hard to knock down.
- **Signature, unlocked by beating L1 as Dex: Arc Slam.** A short-range
  shockwave that knocks enemies back and stuns them briefly.
- Branches:
  - **Brawl**: knockback, less contact damage, heal on close kills.
  - **Overload**: charged shots and bigger bursts.
  - **Junkyard**: kills drop scrap that briefly shields you.

### Juno: control ("Reads the signal first")
Stays at range, picks targets, controls space.
- **Signature, unlocked by beating L1 as Juno: Signal Read.** A ping that marks
  every enemy on screen (marked enemies take extra damage) and reveals hidden
  Echoes and secrets for a few seconds.
- Branches:
  - **Precision**: piercing shots, and crits on marked enemies.
  - **Resonance**: shots jump between nearby enemies.
  - **Tuning**: slow fields, and seeing puzzle solutions sooner.

### Raze: chaos (unlocked by clearing L5)
The market-crash Echo ("Caused three flash crashes before breakfast"). High
risk, high reward: volatility, crits, streaks.
- Arcade's **Breaker** class traits already fit him: Short Squeeze, Margin Call,
  Leveraged Position, Flash Crash, Algorithmic Aggression, Circuit Breaker.
  They become the core of his tree.
- **Signature, unlocked by beating L1 as Raze: Flash Crash.** Damage builds up
  on enemies, then is all dealt at once.

### How trees feed Arcade
- Every unlocked node is a **card** added to that character's Arcade pool,
  alongside the generic cards (Pulse Amplifier, Multicast…).
- Some nodes can only be unlocked by **Story milestones** with that character
  (beat L1, beat L3, beat L5). The rest can be bought in the Workshop with
  Chroma.
- The existing Arcade classes map onto the Echoes in the lore: Warden is
  Sable, Breaker is Raze, Ghost is Lumen, Weaver is Cord, Herald is Voss. That
  makes them natural future characters, or shared trees, as they're rescued.

## Story level structure

Slower and readable, with the operator on comms between beats:

1. **Wave**: clear a fixed set of enemies. No timer.
2. **Task**: an objective under light pressure.
3. **Wave**: harder.
4. **Puzzle**: no time pressure.

From L3 on, some levels end with a **boss**. Each beat is a checkpoint: if you
die, you restart that beat, not the level.

**Levels 1–5 use only violet, yellow and green.**

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

1. **Foundation**: save data, the level runner (wave → task → wave → puzzle,
   with checkpoints) built on the tutorial's script system, Chroma banking and
   a results screen, and **Level 1** fully built (Relays task, Sequence
   puzzle).
2. **Signatures**: Dex's Arc Slam and Juno's Signal Read, unlocked by clearing
   L1, and used in Arcade.
3. **Workshop**: skill-tree data and UI, and the Arcade card pool per
   character.
4. **Levels 2–5**: the Queue and Signal Hoarder bosses, and Raze.
5. **Tuning**: costs, farm rates and challenge goals.
