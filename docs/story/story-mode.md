# Story Mode — rough outline

A first pass at what Story Mode could be. Only the **Prologue** is built
(`src/story.js`, `src/dialogue.js`); everything after it is a sketch to react to.

## The cast

| | Role | Voice |
|---|---|---|
| **Dex** | Hits it until it works. Magnetron rig, electric "pew". | Loud, cocky, warm underneath. Keeps score. |
| **Juno** | Reads the signal first. Antenna coil, glass "ping". | Dry, precise, teases him back. Notices everything. |
| **Null** | The white, faceless leader. Shown only as white light. | Few words. Never explains more than he has to. |

Dex and Juno used to run districts side by side. Three years ago Juno asked
for her own district; they still share one radio channel and compare kill
counts every night. Partners, rivals, something more: it's left open, and
the story leans on it.

## Roles every chapter

- **Agent (in the field):** the character the player picks. They play the level.
- **Operator (on the phone):** the other one. They talk over comms the whole
  time: objectives, warnings, banter. Who's on the line changes the lines.

Picking a character is the choice of who goes in and who stays on the phone, so
every chapter has two versions of its dialogue.

## Prologue — "The Basement" (built)

1. **Intro.** Title cards set the world, then Dex and Juno on the radio from
   two districts apart, comparing scores. It's quick, about a minute.
2. **Null calls.** A priority signal. Something under the old server farm is
   calling a name, *Sable*: an Echo that still knows who it is. "One of you
   goes in. One of you stays on the line." They argue. "Settle it."
3. **Who goes in?** The character select picks the agent.
4. **Tutorial.** The real game, no waves, and the agent can't die. The operator
   talks them through:
   walk → fire the emitter → what coherent light is → a violet (harmless) →
   colour comes back to you → two yellows (they chase; watch the bar) →
   rescue an Echo → "Sable's signal is deeper in… be careful."
5. **Prologue complete** → Arcade or Title.

Skip any scene with Esc or the SKIP button. Finishing it sets
`chromatic_decay_prologue_done` in localStorage, for later unlocks.

## Possible chapters

Each chapter is one zone with a short intro on the radio, a level with scripted
objectives (not endless waves), a set-piece encounter, and a short outro.

1. **The Basement, deeper.** Find Sable. First green Chromatics (they hunt).
   Ends with Sable joining as the first companion.
2. **The Exchange.** An old trading floor. Orange broadcasters, Raze. A
   survive-the-timer objective.
3. **The Feed.** A dead social network. Lumen. Stealth, sightlines, staying
   unseen.
4. **The Grid.** The power district. Cord. Traps and switches; route the power.
5. **The Hall of Cats.** Voss. A lighter chapter, with an escort.
6. **Null.** What he actually is, and why he only ever appears as white light.
   The ending turns on who's been in the field and who's been on the phone.

Threads to pay off along the way:
- Why Juno left the partnership.
- What Null wants with Echoes that still remember themselves.
- The operator getting cut off, with one level played without the voice in your ear.

## Arcade experiments (next)

Arcade stays the test bed. Ideas queued:
- **Map secrets** that unlock things: hidden rooms behind racks, a dead
  terminal that takes a code, an Echo that only appears if you stand still
  in the dark.
- Unlocks: shot colours, emitter skins, lore entries, a story-mode bonus scene.
