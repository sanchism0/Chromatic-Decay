# Core loop: Story unlocks Arcade

The game's design. Parts are built (see `docs/roadmap.md` for status); the rest
is the plan. Where this doc and `docs/decisions.md` disagree, `decisions.md` is
newer.

## The loop in one line

**Play Story levels → earn Chroma (colour) and Story cards, and unlock
characters → the cards join the Arcade deck → replay Story levels to farm more
Chroma → (later) buy the rest of each character's tree in the Workshop.**

```
        ┌──────────── replay levels to farm ────────────┐
        ▼                                                │
  STORY LEVEL ──clear──► Chroma + first-clear unlocks ──► WORKSHOP (skill trees)
        │                                                │
        └── beat L1 with a character → their first card   │
            beat L5 → unlock Raze                         ▼
                                              ARCADE card pool per character
```

## Two modes, two paces

| | Story | Arcade |
|---|---|---|
| Pace | Slower, structured, checkpoints | Fast, endless pressure, 15 waves |
| Goal | Clear the level | Survive, score |
| Colour from kills | **Chroma**: banked to your wallet at the end | Run-only, as now |
| Levelling in the run | Section power-ups (Level 1 is a sampler); otherwise your earned cards | Wave clears → pick cards |
| Rewards | Chroma, Story cards, unlocks | Score, and a quarter of the colour drained as Chroma |

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
their gun fires**, then the **Story cards** they earn (some are activated
abilities on E and F). Damage per second is about even; the delivery is
different. Everyone can dash (Space).

| Character | Gun | Feel | Level 1 power-ups (first one kept as a card) |
|---|---|---|---|
| **Juno** | **Minigun**: 5 rounds/s at low damage, with a little spray | Hose the crowd, keep moving | **Hot Barrel** (+25% fire rate), Piercing Stream, Ricochet |
| **Dex** | **Burst**: three quick rounds per trigger pull | Pick a target, punch it | **Heavy Bursts** (+1 round, +15% damage), Stun Grenade (E), Kinetic Finish |
| **Raze** (gold) | **Heavy**: slow, very strong gold rounds | Every shot counts | Not designed yet |

The earlier "signature" abilities (Spin Up, Arc Discharge, Gold Standard) were
replaced by this card system; their code is still in `player.js`, unused.

- **Raze** is the market-crash Echo from the lore, the Echo the Basement arc
  is out to rescue, and a **playable gold character** once he's rescued at the
  end of L5. You then clear L1 as him for his cards. His tree can reuse
  Arcade's old Breaker traits (Short Squeeze, Margin Call, Flash Crash…). He
  needs a sprite (a placeholder first) before he's playable.
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

From L3 on, some levels end with a **boss**. Planned: each beat is a
checkpoint, so dying restarts that beat. For now, dying shows restart or leave
and restarts the level.

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

### Levels 1–5: "The Basement" arc (rescuing Raze)

The whole arc is one mission: Null hears Raze calling from under the old server
farm, and the agent follows his trail down. Every level's dialogue says why
you're there and what you leave with. Level 1: Raze's signal went dark on the
Server Floor; power the floor, wake the servers, and their logs show he went
down to Cold Storage. Sable can be character 4 later.

| # | Level | Wave 1 | Task | Wave 2 | Puzzle | Boss | Unlocks |
|---|---|---|---|---|---|---|---|
| 1 | Server Floor | violet | Relays (3) | violet + yellow | Wake 4 servers | none | First power-up as a **Story card**, for the character who clears it (built) |
| 2 | Cold Storage | violet + yellow | Escort an Echo | yellow | Plates | none | Tree tier 1 (story nodes) |
| 3 | The Stacks | yellow | Hold the line | violet + yellow | Beam | **The Queue**: a huge violet made of unplayed streams | Tier 2 story node |
| 4 | Wire Room | green (new) | Gather fragments | yellow + green | Tuning | none | Workshop opens in full |
| 5 | Raze's Room | all three | Hold the line | all three | Beam + Sequence | **Signal Hoarder** (green) | **Raze** rescued, and playable |

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

1. **Foundation (built):** save data, the level runner, Chroma banking, results,
   the Story map, Level 1.
2. **Character guns and Story cards (built):** Juno's minigun, Dex's burst,
   Raze's heavy rounds (data only); Level 1 power-ups; the door card.
3. **Mechanics (built):** dash, E/F abilities, stun grenade, yellow lunge,
   pathing. **Next:** green blinkers.
4. **Levels 2–5:** each awards more cards; bosses from L3; Raze at L5.
5. **Workshop:** skill-tree data and UI.
6. **Tuning:** costs, farm rates and challenge goals.

## Arcade (decided)

- Each character starts in their **base form**: their own gun, plus dash. Nothing else.
- The deck is the white cards (kept for now) plus a **shared pool of Story cards**: every card any character has earned. Either character can draft any of them. A card does what it says, whoever takes it; there are no guardrails yet, so we tone things down after testing.
- The **first level-up** of a run always offers a Story card, if any are earned.
- **Activated abilities**: at most two per run. The first drafted goes on **E**, the second on **F**. Once both are taken, no more activated-ability cards appear.
- **Classes** (Warden, Breaker, Ghost, Weaver, Herald) and the Fragments that unlocked them are retired from Arcade. They're kept as templates for future characters.

## Story cards (decided)

- Level 1 is a **sampler**: you try three power-ups but **keep one**, the first, by opening the door the first time as that character.
- A card belongs to the character who earned it. From Level 2 on, a character starts with **only their own** earned cards.
- Character select for a Story level shows each character's cards, and what the level awards.

## Leaderboards (built)

Six boards on the title screen, one at a time: arrows (or ← →) on desktop, a
swipe on phones.

| Board | What it ranks |
|---|---|
| Arcade · Desktop / Mobile | best runs of all time, per platform |
| This week · Desktop / Mobile | the same since Monday 00:00 UTC |
| Story progress | 1 point per level cleared with each character (ties: first there) |
| Lifetime Chroma | all colour ever earned, as one value: violet 1, yellow 10, green 100, orange 1,000, pink 10,000 |

- The player picks a name the first time they start a game (up to 10 letters
  and numbers); "PLAYING AS … · CHANGE" on the title screen changes it.
- Arcade runs post automatically under that name. Game over shows the run's
  rank (all time and this week) and NEW PERSONAL BEST, or the best so far.
- Arcade banks a quarter of the colour it drains into Chroma, so both modes
  feed the lifetime board.
- Data lives in Supabase (`scores`, and `players`: one row per device). The
  tables and access rules are in `docs/supabase/leaderboards.sql`. If the
  database can't be reached, the boards say so and show this device's runs.
- Scores come straight from the browser, so they can be faked. Fine among
  friends; a server-side check comes before going public.
