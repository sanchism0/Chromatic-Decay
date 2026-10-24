# CHROMATIC DECAY

> A top-down shooter in a world where colour only survives if it's still broadcasting.

Ten years after the Collapse, the Chromatics (ghosts made of stolen light) have
taken the colour out of everything. **Dex** and **Juno** fight them with
hand-built Pulse Emitters that fire coherent light, the one signal a Chromatic
can't swallow. A voice called **Null** sends them into the Basement to rescue
**Raze**, an Echo that still knows who he is.

## Play

**https://sanchism0.github.io/Chromatic-Decay/**

No install. Works in any modern browser, on desktop and on phones (twin-stick
touch controls).

## Modes

- **Story Mode:** pick who goes in; the other one talks you through it on
  comms. A prologue, a tutorial, Level 1 ("Server Floor"), Level 2
  ("Cold Storage") Level 3 ("The Stacks"), Level 4 ("Wire Room") and Level 5 ("Raze's Room"), the whole Basement arc. Clearing
  levels earns Chroma and **Story cards**.
- **Arcade Mode:** 15 waves of escalating Chromatics with bosses. Every Story
  card you've earned joins your upgrade deck.
- **Leaderboards:** Arcade (desktop and mobile, all-time and this week), Story
  progress and lifetime Chroma.

## Controls

| | Desktop | Phone |
|---|---|---|
| Move / aim | WASD + mouse | left stick / right stick |
| Fire | automatic (Q to toggle) | automatic (AUTO to toggle) |
| Dash | Space or click (toward the cursor) | DASH |
| Abilities | E, F (grenade lands at the cursor) | ability buttons (press the grenade's and drag to aim) |
| Comms | Space or Enter | tap the box |

## Stack

Vanilla JavaScript ES modules and HTML5 Canvas, no build step, hosted on
GitHub Pages. All sound is synthesized with Web Audio. Leaderboards run on
Supabase.

## For contributors

Start with [`CLAUDE.md`](./CLAUDE.md), then the docs it lists:
[`docs/decisions.md`](./docs/decisions.md) (what we want and why),
[`docs/roadmap.md`](./docs/roadmap.md) (status and next steps),
[`docs/architecture.md`](./docs/architecture.md) (how the code works).

To run locally, serve the folder (for example `python3 -m http.server 8766`)
and open `http://localhost:8766`. Headless playtests live in
[`tools/playtest/`](./tools/playtest/).
