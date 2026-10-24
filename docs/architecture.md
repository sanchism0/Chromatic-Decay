# Architecture

Vanilla JavaScript ES modules and one `<canvas>`. No bundler, no dependencies,
no build. `index.html` loads `src/game.js`, which imports everything else.
GitHub Pages serves the repo root as-is.

## The main loop

`game.js` owns a state machine and a `requestAnimationFrame` loop:
`update(dt)` (input, then the current state's update), then `draw()` (the
current state's draw). `dt` is capped at 0.05 s.

| State | # | What it is |
|---|---|---|
| TITLE | 0 | Title screen: Arcade, Story, Archive, Settings, leaderboards, name, music toggle |
| PLAYING | 1 | In a run (Arcade, tutorial or Story level) |
| PAUSED | 2 | Esc menu |
| UPGRADE | 3 | Arcade card pick between waves |
| GAMEOVER | 4 | Arcade death: stats, rank, personal best |
| FRAGMENT_RESCUE | 5 | Legacy (Fragments retired) |
| ARCHIVE | 6 | Lore cards |
| ADMIN | 7 | Developer tuning panel (`admin.js`); only reachable from Settings with `?dev` in the URL |
| WIN | 8 | Arcade: all 15 waves cleared |
| CLASS_EMERGENCE | 9 | Legacy (classes retired) |
| CHAR_SELECT | 10 | "Who goes in?" for Arcade and Story |
| STORY | 11 | Dialogue scenes (prologue) |
| STORY_END | 12 | Prologue complete card |
| STORY_MAP | 13 | Level select |
| LEVEL_END | 14 | Story level results |
| DYING | 15 | Death burst before game over / level failed |
| LEVEL_FAIL | 16 | Story level failed: restart or leave |
| ABILITY_UNLOCK | 17 | Story card earned at Level 1's door |
| POWER_UP | 18 | Level power-up granted after a section |
| NAME_ENTRY | 19 | Leaderboard name (first start, or changing it) |
| SETTINGS | 20 | Player settings: name, music, sound effects, auto-fire |

`startRun(opts)` builds a fresh run: map, player, all systems. `opts.tutorial`
(prologue tutorial) and `opts.level` (a Story level) change what's switched on.
With no options it's an Arcade run.

## Files

### Core
| File | Role |
|---|---|
| `game.js` | Everything that ties the game together: state machine, runs, collisions, lighting, HUD buttons, all menus and screens (title, char select, story map, results, game over, archive, name entry). ~4,200 lines. |
| `config.js` | Every tunable number: player stats, enemy stats, spawn mix, camera zoom, scoring. `admin.js` edits it live. |
| `input.js` | Keyboard, mouse, twin-stick touch, swipe. Edge flags (`justPressed`, `mouseJustClicked`, `swipe`) last one frame. |
| `utils.js` | Maths and collision helpers (`circleVsRect`, `dist`, `weightedPick`…). |

### World and drawing
| File | Role |
|---|---|
| `map.js` | Rack layouts per room (`LAYOUTS`: `basement` for Arcade, the tutorial and Level 1; `cold` for Level 2; `stacks` for Level 3, with `STACKS` giving its ring and sealed pockets; `wire` for Level 4, with `WIRE` giving the corridor and live wires; `vault` for Level 5, with `VAULT`), camera, spawn helpers (`playerSpawn`, `randomSpawn`). Every map is 1174 × 1174 world px; a level picks its room with `map:` in `LEVELS`. |
| `pixelmap.js` | Pixel-art floor and three-quarter racks, pre-rendered per zoom. A palette per room (`THEMES`: colours, LED colours, floor labels, pits, frost). Racks behind the player draw first, the rest after; `rackHeight()` gives a rack's drawn height. |
| `sprites.js` | Cached glow and halo sprites (offscreen canvases) so glows are one `drawImage`. |
| `particles.js` | Pooled particles (hit sparks, bullet clashes). |
| `drain.js` | The colour drain kill effect (unravel → hang → drain into the player). Also counts colour per type. |
| `ui3d.js` | `drawSlab` / `drawSlabButton`: the 3D rack-style panels every menu uses. |
| `hud.js` | Health bar, Arcade score / wave / timer, near-death tint. Touch gets a slim corner bar. |

Text: `MIN_FONT_PX` (12) in game.js clamps every font set on any canvas; long text wraps with `_wrapLines` rather than shrinking.

Lighting lives in `game.js` `drawGame`: a darkness mask with visibility
polygons per light (player, enemies, rack LEDs), so racks cast real shadows.
Angles are normalised to −π..π; mixing ranges once caused black slivers.

### Actors
| File | Role |
|---|---|
| `player.js` | The agent: movement (sub-stepped so it never tunnels into racks), `WEAPONS` per character, firing, dash (`DASH_*`), beam-in/out, death, sprite drawing (`SHEETS`, 32×44 cells, walk cycle, `LENS` per facing for the emitter muzzle). Also legacy class data. |
| `enemies.js` | The Chromatics: spawning (fade-in), per-type behaviour, the yellow lunge (`LUNGE`), the green blink (`BLINK`: stationary turret that teleports to the far side of a kiting player; `phased` while fading = can't be hit), flow-field pathing (`FLOW`), ghost drawing (wavelength-driven pulse and ripples, health-scaled core). |
| `projectiles.js` | Player and enemy shots, pulse-shot visuals, rack bounce (Ricochet), `arc` (Arc Round: the last round of a Dex burst; `EnemySystem` jumps it to the nearest other enemy within `ARC_RANGE` and draws the bolt in `zaps`), `hitIds` (a round hits each enemy once, for piercing), `rackHits` (racks shot this frame, for Story objectives). |
| `dashpowers.js` | Dash abilities (Level 2 cards): Dex's Shock Dash (stun + jam everything dashed through) and Juno's Parting Charge (a bomb where the dash started). Detects a dash starting itself; also hits `level.dashTargets`. |
| `decoy.js` | Juno's Decoy Beacon (Level 3 card): thrown like the grenade; for 3 s it sets `enemies.lure`, and violets/yellows within 220 px go for it (yellows lunge at it, greens shoot it). `onLand` tells the level where it came down |
| `grenade.js` | Dex's stun grenade: arcs over racks, stuns and jams (+50% damage taken), electricity and smoke, 8 s cooldown. |
| `echoes.js` | Echo health pickups (pixel-art white figure, fog, fade-in, jewel sound). Legacy Fragment echoes too. |
| `companions.js`, `traps.js`, `fragments.js` | **Legacy** class systems (Herald orbs, Weaver traps, Fragment data). Not used in play; kept as templates. |

### Modes
| File | Role |
|---|---|
| `waves.js` | Arcade: 15 waves (`WAVE_DATA`), timers, bonus bank, boss sequencing, kill score, win. |
| `upgrades.js` | Card offers: `GENERIC_UPGRADES` (white cards), `STORY_CARDS` (earned in Story), legacy `CLASS_TRAITS`. `_generateOffer` builds the deck (shared Story pool, first-offer guarantee, two-ability cap). |
| `story.js` | Scenes before levels (`playInterlude`; `INTROS` by `intro:` in `LEVELS`: `stacks` before Level 3, `wire` before Level 4, `raze` before Level 5; `OUTROS` by `outro:` play after a level, before the card), each keyed by agent. Prologue: intro script, the pick, the after-pick lines, tutorial steps (each waits for a condition and for comms to finish). |
| `dialogue.js` | `Dialogue` (full scenes: portrait + box, typed text, one press per line) and `Radio` (in-game comms box + objective; auto-advances; Space, Enter, a click or a tap moves on; just below mid-screen on desktop, at the top on touch). Text blips. Speaker colours and expression lists. |
| `level.js` | Story level runner. `LEVELS[id].beats(operator, agent)` returns the level's beats; `Level` plays them. Also `POWERUPS`, `LEVEL_CARDS`, `AGENT_COLOR`. |
| `profile.js` | Saved progress in localStorage (`chromatic_decay_profile`): Chroma wallet, clears, Story cards, player id + name, lifetime Chroma, personal bests. `CHROMA_VALUE`, `storyStats()`. |
| `leaderboard.js` | Supabase calls, the six boards, posting runs, rank, player sync, offline fallback, board drawing. |
| `lore.js` | Arcade's lore feed: one-line blurbs on first sightings and milestones. |
| `admin.js` | Developer tuning panel: edits `CONFIG`, export/import JSON, clear local scores. Open the game with `?dev` (e.g. `…/Chromatic-Decay/?dev`), then Settings → DEVELOPER TUNING. |
| `audio.js` | Every sound, synthesized with Web Audio (no audio files). Effects play through one bus (`_sfxBus`) that Settings can mute; music (title, ambient) goes straight out. New effect sounds must connect to `_sfxBus()`, not `ctx.destination`. |

## Story levels (`level.js`)

A level is a list of beats; each is a checkpoint in spirit (death restarts the
level for now). Beat types:

| Type | Plays as |
|---|---|
| `wave` | Groups of enemies arrive from different sides; the next group comes when this one thins out |
| `relays` | Stand near relays to pull charge into your emitter while interrupters drain them |
| `servers` | Shoot marked racks anywhere on the map to light them (arrows to each unlit one) |
| `sequence` | Walk over floor pads in the order they lit (built, no longer used by Level 1) |
| `drives` | Pick up items at `points.drives`. A level with `icy: true` makes the whole floor ice: you slide everywhere (`player.onIce`) |
| `freezers` | Frozen tanks (`points.tanks`) that bullets don't hurt; the dash ability hits them (`TANK_HITS` each) through `level.dashTargets` |
| `hold` | Stand in the terminal's ring (`HOLD`) while it pulls; any unstunned Chromatic in the ring pauses it; it never drains |
| `beam` | Mirrors in sealed pockets (`points.mirrors`), turned by a thrown ability landing on them (`onThrowLand`, from `grenades.onLand` / `decoys.onLand`); the beam runs source → mirrors → vault; all right opens the vault |
| `boss` | The Queue (`QUEUE`): a big violet `Enemy` with `boss`, `contactDamage` and a capped stun; the level sends its rings (`rings`, dash through them), splits it at thresholds, draws the health bar, and dissolves the rest when it dies |
| `gather` | Junction boxes (`points.boxes`) that open only to an Arc Round jump (`arcTargets`, `onArcRack`) or a `bounced` round (`_shotsOnTargets`); plain rounds glance off. Each drops one of Raze's memories to walk over |
| `tuning` | Dials (`points.dials`) turned the same way, cycling 0→1→2, to match `pattern` on the display |
| `escape` | A timer (`time`) to reach `exitPos`; `wires` across the corridor zap and push back unless `player.dashT > 0`; alarm, red edge in `drawHud`; timing out sets `failReason` (DOOR SEALED) |
| `overload` | Anchors (`points.anchors`, `ANCHOR_HP`) that only take damage from rounds flagged `discharge` (Arc Discharge, 4 each) or `spun` (fired during Spin Up); F recharges twice as fast |
| `hoarder` | The Signal Hoarder (`HOARDER`): a green `Enemy` with `boss: 'hoarder'` (its AI lives in `_updateHoarder`), `shielded` while turret nodes (`node: true` greens) stand, rings of rounds after each blink, waves at `phases`. With `endOnBoss` its death ends the level |
| `valves` | Plates that open while you stand on them and close `VALVE_OPEN` s after you leave; all open at once finishes it (built, not used now) |
| `exit` | Walk to the door (or the lift: `exit: 'lift'`) → beam-out → card unlock (first time) → results |

Each beat has `lines` (briefing on comms; enemies wait for it), an
`objective(state)` string, optional `eachDone` lines and `done` lines.
A beat's `interrupt: { cap, period, yellow }` keeps enemies coming during
it (`_interrupt`: pairs, anywhere on the map, at least 320 px from the player).
`checkpoint: true` on a beat (Level 3's boss) records `checkpointIdx`; dying after it, the fail screen offers a retry that rebuilds the level with `new LevelRun(id, agent, api, { idx })` (`_skipTo` marks earlier beats done) and re-applies `granted` abilities. game.js keeps it in `_checkpoint`, cleared by any fresh `startRun`.
`grant: true` on a beat hands over the level's `LEVEL_CARDS` card for the
rest of the level when it ends (Level 2's dash abilities). Level fields: `map`
(room), `exit` ('lift' or 'vault'), `points` (positions as map fractions: drives, tanks, lift, terminal, vault, source, mirrors, dead), `icy`,
`powerups` (Level 1's sampler only), `blurb`, `outcome`, `unlockTop`
(the card screen's top line). The level talks to
the game through `levelApi` in `game.js` (spawn enemies and Echoes, play
sounds, ask whether a card unlock is due).

After each `wave`/`relays` beat the agent gets the next `POWERUPS` entry
(state POWER_UP). At the door, if the character hasn't earned the level's
`LEVEL_CARDS` card yet, ABILITY_UNLOCK shows it and `unlockCard` saves it.

## Saved data (localStorage)

| Key | Contents |
|---|---|
| `chromatic_decay_profile` | `{ chroma, clears, cards, player {id, name}, lifetime, best, storyAt, characters, signatures (legacy) }` |
| `chromatic_decay_scores` | This device's last 50 Arcade runs (offline fallback board) |
| `chromatic_decay_prologue_done` | `'1'` after the prologue |
| `chromatic_decay_character` | Last picked character |
| `chromatic_decay_autofire` | `'0'` / `'1'` |
| `chromatic_decay_menu_muted` | `'1'` = music off (title and in-game ambient) |
| `chromatic_decay_sfx_off` | `'1'` = sound effects off |
| `chromatic_decay_archive` | Legacy Fragment archive |

## Leaderboards (Supabase)

The game calls PostgREST directly with the public anon key (`leaderboard.js`).
Schema and access rules: `docs/supabase/leaderboards.sql` (already run on the
project).

- `scores`: one row per Arcade run: `initials` (the player's name), `score`,
  `wave`, `time`, `platform`, `agent`, `player_id`, `created_at`.
- `players`: one row per device, upserted after every level, run and name
  change: `story_points`, `furthest_level`, `story_agents`, `story_at`,
  `lifetime_chroma`.
- Rank is a count of better scores (HEAD request with `Prefer: count=exact`).
- Requests time out after 8 s and fall back to local data, marked "offline".

## Adding things

- **A Story card:** add it to `STORY_CARDS` in `upgrades.js` (`who`, `active` if
  it's an E/F ability), then have a level award it (`LEVEL_CARDS`). Activated
  abilities also need a key-bar entry and a touch button in `game.js`
  (`_useAbility`, `_abilityInfo`, the round buttons).
- **A level:** add `LEVELS[n]` in `level.js` with its beats and lines for both
  operators and a `LEVEL_CARDS[n]` entry. The story map shows a level as
  playable as soon as `LEVELS[n]` exists (names are in `STORY_LEVELS`, `game.js`).
  New beat types go in `Level._enter`, `update`, `targets` and the draw methods.
- **An enemy behaviour:** a branch in `Enemy.update` in `enemies.js`. Keep it
  readable at a glance: telegraph before anything dangerous.
- **A sound:** a function in `audio.js` built from `_osc` and `_noise`. No toy
  sounds.
- **Text the player reads:** check both desktop and touch wording, and both
  operators' versions of every line.
