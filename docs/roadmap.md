# Roadmap and status

Updated Oct 24, 2026, after PR #21. Read `docs/decisions.md` first; this file
says where things stand and what to do next.

## Where things stand

**Built and live:**
- **Arcade:** 15 waves with bosses, character select (Dex, Juno), base forms plus
  the shared Story deck, two ability slots, win screen, game over with rank.
- **Story prologue:** intro scene, Null's call, the pick, an operator-led
  tutorial, prologue complete.
- **Story Level 1, "Server Floor":** wave → relays → wave → four servers →
  extraction, with section power-ups, a card at the door, results, death and
  restart. Both characters, both operator voices.
- **Mechanics:** dash (Space), E/F abilities, Dex's stun grenade, yellow lunge,
  flow-field pathing, spawn safety distance, beam-in and beam-out, Mega Man X5
  death burst, colour drain on every kill.
- **Progress:** Chroma wallet, lifetime Chroma, Story cards per character, clears.
- **Leaderboards:** six boards on Supabase, names, weekly board, rank and
  personal best at game over. Working on the GitHub Pages site.
- **Phone:** twin sticks, round see-through buttons, compact landscape HUD.
- **Settings:** name, music, sound effects, auto-fire. Developer tuning only with `?dev`.

**Story cards that exist:** Heavy Bursts (Dex, from Level 1), Hot Barrel (Juno,
from Level 1), Stun Grenade (Dex, activated; defined but **no level awards it
yet**). So the Arcade Story deck is tiny: this is the biggest gap in the core loop.

**Story map:** Levels 2–5 show as coming soon (Cold Storage, The Stacks, Wire
Room, Raze's Room).

## Recommended next steps

In order. Check with the owner before starting anything big; they like a short
plan with a recommendation, then build one step at a time.

### 1. Green blinkers: built (Oct 24, 2026), awaiting the owner's playtest
Greens are now blinking turrets (see `docs/decisions.md`). Next: the owner
tries Arcade wave 3 (ten greens) and tunes. The knobs are `BLINK` in
`enemies.js`: cooldown, landing distance, arc, volley.

### 2. Levels 2–5: plan written, awaiting the owner's review
The full plan (story, maps, beats, bosses, cards per level, build order) is in
`docs/design/levels-2-5.md`. Build one level at a time once it's agreed.

### 2a. Level 2 "Cold Storage": built (Oct 24, 2026), awaiting the owner's playtest
Wave → **dash ability granted** (Dex: Shock Dash, Juno: Parting Charge) →
grab three archive drives frozen into ice patches (you slide on ice) → wave →
crack three frozen coolant tanks (only the dash ability hurts them, two hits
each) → ride the lift. Cold Storage map and icy palette. Clearing it keeps the
dash ability as a Story card. (The first version's escort and valves were
replaced on the owner's request.)
Next: Level 3 (hold zone, mirror beam, The Queue, Decoy Beacon).

### 3. Per-character mechanics
"Focusing on what the next 3 to 5 improvements will be per character." Each
character should play very differently over time. Brainstorm with the owner
(ideas, not code) and turn agreed ones into Story cards awarded across Levels
2–5. Design around interactions, not labels (the owner rejected class-style
labels).

### 4. Raze
Unlocked by clearing Level 5. Needs a sprite: placeholder first (the owner said
no new art for now; a gold light figure fits). `WEAPONS.raze` already exists
(slow, heavy gold rounds). Story points and the D/J/R board column already
expect him.

### 5. Later, parked ideas
- **Workshop:** spend Chroma on skill-tree nodes per character (designed in
  `core-loop.md`).
- **Unlockable character colours** (a colour picker the owner liked).
- **Arcade map secrets** that unlock things.
- **A boss** from about Level 3 (The Queue; Signal Hoarder at Level 5).
- **Server-side score checks** before sharing the leaderboard widely.

## Known issues and tech debt

- **Arcade's lore feed uses the old canon.** `lore.js` `run_start` says "Three
  days underground. You came up expecting rescue": the player as Null, from the
  original design. The pink boss blurb calls it "One Red". Rewrite these to fit
  Dex/Juno and Null-as-leader when convenient.
- **The Archive screen still lists the five Fragments** (Sable, Raze, Lumen, Cord,
  Voss) as class unlocks, a retired system. It also holds the lore cards (world,
  emitter, enemies). It needs a pass to match the current story (Raze as the
  rescue target, Sable as a future character).
- **Legacy code still in place:** class traits, subclasses, class emergence,
  Herald companions, Weaver traps, Fragment spawning, signatures (Spin Up, Arc
  Discharge) and their HUD bits. All switched off. Remove it, or reuse it as
  templates; don't build new features on it.
- **`game.js` is ~4,200 lines.** Menus and screens could move out into their own
  modules. Not urgent; be careful with large edits (see `CLAUDE.md`).
- **Leaderboard scores can be faked** from the browser (public key, open insert).
- **The claude.ai preview artifacts can't reach Supabase**; scores there stay on
  the device.
- **Arcade's lore line overlaps the desktop key bar** at the bottom of the
  screen (seen in screenshots, Oct 2026). Move the lore feed up or the key bar
  down.
- **The phone name keyboard has letters only**; desktop accepts digits too.
- **One map for everything.** Arcade, the tutorial and Level 1 share the Basement layout.
- `scroll.html` at the repo root is an unrelated early experiment (a learning
  feed). It's harmless; it can be removed with the owner's OK.

## Merged history (summary)

| PRs | What |
|---|---|
| #1–#4 | 3D lighting fix, spectral ghost enemies, colour drain, Arcade/Story buttons, 3D menus |
| #5–#9 | Dex and Juno sprites, emitter lore, pixel-art map, pulse shots, per-character shot sounds |
| #10–#11 | Story prologue and tutorial, beam-in, text blips, Echo art, swarm spread |
| #12–#16 | Story Level 1, character guns, Chroma, death burst, phone layout, pathing, power-ups, stun grenade, door card |
| #17 | Dash, E/F ability slots, spawn safety, Arcade rework (base forms, shared deck), classes retired |
| #18–#19 | Yellow lunge, piercing fix, servers finale, extraction, Raze rescue arc, tighter comms, finale swarm |
| #20–#21 | Leaderboards (six boards, names, rank, personal best), phone HUD, big desktop arrows |
