# Decisions, likes and dislikes

What the owner wants, what they've rejected, and why the game is the way it is.
Quotes are the owner's own words. When a new request conflicts with something
here, the newer request wins, and this file gets updated.

---

## The big picture

- **Where it's heading:** "In my mind, this game has each character play very
  uniquely over time, and in arcade, you can actually mix up their mechanic to
  find out what you actually like." Story unlocks things; Arcade is where you
  mix them.
- **Fun comes first.** "The players have to be fun to play as a character, and
  have to be fun and challenging to play against the enemies." The owner judges
  by playing it: "ok this is fun!" is the bar.
- **Rejected direction:** scaling up by grinding power-ups from mob kills "is not
  really the direction we're going to go." Power comes from **characters'
  mechanics and earned cards**, not from stat creep.
- **Rejected direction:** the five classes (Warden, Breaker, Ghost, Weaver,
  Herald) and the Fragments that unlocked them. "Pretty confusing and doesn't
  seem to work properly." Retired from play; kept in code as templates for
  future characters.
- **Work style:** "one step at a time, testing in between."

## Look and feel

### Visual style
- **Light is smooth, things are pixel art.** Characters, racks, floor, Echoes:
  crisp pixel art at 1 art pixel = 1 screen pixel. Glows, ghosts, beams, shots:
  soft, additive light.
- **Liked:** "I absolutely love how the characters seem to glow." The 3D-looking
  server racks (three-quarter view) and the pixel-art floor: "looks amazing".
- **Top-down, but with depth.** Racks have a top face and a visible front face;
  the player is drawn as a see-through silhouette when a rack hides them.
- **No more character art for now:** "no more art this is what we work with for
  now." Dex and Juno's sprite sheets and portraits are final. Raze has no art
  yet and would start as a placeholder.
- **Menus** use the same 3D "slab" style as the map (`src/ui3d.js`). Nothing
  may run off the edge of a panel; check every screen at phone size.

### No flashing, ever
- "Lets avoid any flashing in general though." No blinking when hit, no white
  screen flashes, no strobing. The hit feedback is a soft shimmer shield that
  fades. The near-death tint is steady, not pulsing.
- Pulsing that reads as a warning on the player was "off putting"; it was replaced.

### Enemies (the Chromatics)
- **Ghosts made of light:** "slightly creepy, ghost-like, ethereal, but
  definitely made of light." No geometric shapes, **no outlines** ("no outlines
  on light"), **no eyes** ("remove the eyes… that will make a big difference").
  Not cartoony, not "squid looking".
- **Wavelength logic:** each colour's shape, ripples and core pulse come from its
  real wavelength (violet pulses fastest, orange slowest; magenta pink is red +
  violet mixed). The owner liked tying the art to the physics.
- **Small cores:** "majority spectral with a small core." The core shrinks as the
  enemy loses health ("I do like them shrinking based on their health").
- They **fade in** from drifting motes instead of popping into existence.

### The colour drain (kill effect)
Signed off and shipped for every mode: when a Chromatic dies, its colour
unravels into faint, see-through motes that fly straight to the player, go
over the shoulder and wrap half-way round them, then absorb with a soft glow.
About 0.7–0.8 s total. The absorb glow is softened for yellow, orange and green
(they blew out too bright). Don't make it longer or brighter.

### Echoes (health pickups)
- Tiny, wispy, white, semi-human figures in a soft white fog; clearly a health
  pickup. Visible through racks (they used to hide behind them).
- **Never call them people.** "One more person out of the dark" was "a little
  creepy… it's definitely not a person." Use "Echo".
- Pickup sound: jewels clinking.

### Sound (all synthesized with Web Audio, no files)
- **Light-wave, not bursty.** The owner wanted sounds that "represent more of a
  light wave".
- **No toy sounds:** "I want to avoid toy-like sounds in this game." The yellow
  lunge went from "boingy… like a spring or a toy" to a lightning crackle and
  strike.
- **Shots:** each character's emitter sounds different. Dex = "A", an electric
  PEW; Juno = "B", a glass ping. The old shot was "like a metronome".
- **Text blips** like Mega Man games, one per few letters. Toned down 20%
  ("too frantic"); Dex and Juno's pitches are close ("too distinct… distracting").
- **Beam-in / beam-out:** a laser drop and materialising shimmer, Mega Man X5
  style. Beam-out is the same played backwards.
- **Unlock tune** when a card is earned; it matches the game's vibe (not a fanfare).
- Menu music can be muted from the title screen (remembered).

## Characters

### Dex and Juno
- **Dex:** toxic lime `#B6FF2E` + cyan `#2DE2F0`. Dark hair, headband, headset.
  "Hits it until it works." Emitter: a magnetron from a microwave.
- **Juno:** lilac `#C79BFF` + violet `#7A3DFF` in art and UI. Her in-game power
  colour is pink `#E58CFF` (the owner calls her "the pink girl"). "Reads the
  signal first." Emitter: a hand-wound antenna coil.
- **Art style:** gritty dark anime, athletic and lean, punk clothes with sharp
  edges and accent colours. Explicitly **not** "Roblox or Rick and Morty".
- **Relationship:** former partners now in separate districts who still compare
  scores every night. Friendly rivalry with a subtle flirt, "like coworkers who
  aren't allowed to date". Banter like Legolas and Gimli.
- **They are civilians.** Techy and competent with their weapons, but **not
  military**: no sectors, ranks or jargon. ("im cringing at the communication…
  they are not really militant.")
- Either character can play either role. The picked one is the **agent** (in the
  field); the other is the **operator** (on comms, in their ear).

### Guns: "specific interactions rather than labels"
Everyone keeps the Pulse Emitter (a bracer on the right forearm; shots leave the
lens at the wrist). Each character fires it differently; damage per second is
roughly even.

| | Gun | Feel | Numbers (`WEAPONS` in `player.js`) |
|---|---|---|---|
| Juno | Minigun | lots of low-damage rounds, slight spray | 5 shots/s, damage ×0.40 (bumped from 0.34: she was "a little bit underpowered") |
| Dex | Burst | three quick rounds per trigger pull | 0.85 bursts/s, 3 rounds, damage ×0.66 |
| Raze | Heavy | slow, very strong gold rounds | 0.55 shots/s, damage ×3.2 (data only; not playable yet) |

- **+1 projectile means more of your gun's thing:** Dex gets a 4-round burst (not
  doubled bullets); Juno fires 25% faster. Never just duplicate shots.
- Default fire was slowed on request to 1.5 shots/s at 360 px/s for the base stats.

### Raze
- The market-crash trading algorithm Echo from the lore, now a **playable gold
  character**. The Basement arc (Levels 1–5) is the mission to **rescue him**;
  clearing Level 5 unlocks him. Then he clears Level 1 for his own cards.
- **Sable** is kept for a possible character 4. Not the rescue target.

### Null
- The faceless leader. Shown only as **white light** (a pulsing point with
  rings), never a face or portrait. His white matches the white light every
  emitter fires; later reveal: he built the first emitter in the Basement.

## Controls

| | Desktop | Touch |
|---|---|---|
| Move | WASD / arrows | left stick |
| Aim | mouse | right stick |
| Fire | auto-fire on by default; Q toggles; manual = hold mouse | AUTO button; manual = hold the aim stick |
| Dash | Space | DASH button |
| Abilities | E = first activated ability, F = second | round buttons next to DASH |
| Comms | Enter or click the box | tap the box |
| Pause / skip scene | Esc | SKIP button |

- **E is the first activated ability a character gets, F the second.** "If
  there's no ability, then there's no function for E." Every ability gets a key.
  (An earlier fallback that threw a grenade with no ability was rejected
  outright.)
- **Dash:** any character, Space. 88 px in 0.16 s, 1.6 s cooldown (shortened 20%
  and cooldown raised on request). Untouchable mid-dash; a perfect dodge refunds
  the cooldown once. Cooldowns must be clearly visible (key bar on desktop,
  rings on touch buttons).
- **Touch layout (decided Oct 2026):** slim health bar in the very top-left with
  just the number (no "HP", no "/ 100"); comms and objective at the top in
  landscape; buttons are **round and see-through**; AUTO sits up-left of the left
  stick, mirroring DASH up-right of the right stick.
- **Camera:** PC zoom 1.95 (zoomed in from 1.7: "users can see too much of the
  map"). Phones zoom by screen size, never showing less than 340 px of width.

## Story Mode

### Pacing and tone
- Modelled on **Mega Man Legends** (the companion in your ear) and **Mega Man X5**
  (beam-in, death burst). "Mysterious, a bit dark, but optimistic."
- **Slower than Arcade:** wave → task → wave → puzzle, with a boss from about
  Level 3.
- **The dialogue carries the story.** Every level's comms say why you're there
  and what you leave with. **No mission banners** ("we definitely don't need
  mission banners… include the mission in the dialogue").
- **Few, short lines.** "Tell people what's going on in the story without making
  them click through multiple screens." Cut asides (the coherent-light
  explanation was removed from the tutorial). One press moves to the next line.
- **Comms must never be missed in a fight.** Briefings hold enemies back until
  they finish; later lines wait for a game event. ("I was caught up killing the
  yellow guys, and I missed everything in the dialogue.")
- Players should know the enemies, characters, resistance and world by the time
  they pick a character.

### Tasks and puzzles
- **Tasks are fights with a goal**, never "stand on this point for 20 seconds"
  with nobody pushing you off. Enemies interrupt throughout.
- **Puzzles must work with burst and spray guns.** Shooting switches in order
  was impossible with bursts; it became walk-over pads, then was replaced by
  four servers you shoot anywhere on the map (forces exploring the whole map;
  arrows point to each).
- **Level 1 must not be annoying.** The third relay was "like impossible", so the
  relay section caps at 4 violets. The servers section brings a swarm (up to 10)
  because you don't need to kill them, and the operator says so.
- **Show where to go:** an arrow to the last enemy left, arrows to objectives,
  a marker on the Echo in the tutorial.

### Power in Story
- **Level 1 is a sampler:** clearing each section grants a set power-up for the
  rest of the level, so it's exciting. Dex: Heavy Bursts → Stun Grenade →
  Kinetic Finish. Juno: Hot Barrel → Piercing Stream → Ricochet.
- **Keep one:** opening the door the first time as a character saves the **first**
  power-up permanently as a Story card for that character, with the unlock tune.
- **Cards belong to the character who earned them.** From Level 2 on, a character
  starts with only their own cards.
- Power you draw from the map (relays, server beams) takes **your character's
  colour**: green for Dex, pink for Juno, gold for Raze. The story beat is that
  you're gaining powers.
- Death: a Mega Man X5-style burst into circles, then **restart or leave** (no
  respawn). Story keeps half the Chroma from a failed run.

### Level 1, as built ("Server Floor")
1. Briefing: Raze's signal went dark here; the servers logged everything.
2. Wave: clear the floor (violets, then a yellow).
3. Relays: pull charge out of three relays while violets drain them (max 4).
4. Wave: violets and yellows.
5. Servers: shoot four servers, one near each corner, while a swarm comes.
   They give up Raze's trace: he went down to Cold Storage.
6. Back to the door you came in by → the operator says "Got you. Coming home."
   → beam-out → card unlock (first time) → results with Chroma and the outcome.

## Arcade Mode

- **Kept as it is**, apart from its cards: "we keep Arcade the way it is for now.
  We don't make any changes to it except the cards." It's also the test bed for
  new mechanics. The owner doesn't need to beat it to approve things.
- 15 waves with timers; bosses (pink) on waves 5, 10, 12, 14 and 15.
- **No bonus for beating wave 15** (the old finishing-time bonus is off): "I dont want anyone taking advantage of the current state for easy wins." A win's final score is just the points earned in the run. Per-wave early-clear and no-damage points still count.
- Each character starts in **base form**: own gun plus dash, nothing else.
- **Deck:** the white generic cards (kept for now, may change later) plus a
  **shared pool of every Story card any character has earned**. Either character
  can draft any of them. **No guardrails yet:** "I'd rather keep it exciting.
  Then tone it down if needed."
- **The first level-up always offers a Story card**, if any are earned.
- **At most two activated abilities** per run (E, F); after two, none appear.
- Removed: the Projectile/Extended Range card ("pretty useless").
- Character select shows "STORY CARDS X/Y" and a nudge to play Story Mode.
- **Swarming stays.** "Swarming actually makes it very difficult", but enemies
  lining up into one easy line was "a little too easy". Spawns come from several
  sides. It "gets harder later like it should".

## Enemies (behaviour)

| | Behaviour | Notes |
|---|---|---|
| Violet | slow wanderer that swarms | Level 1 staple |
| Yellow | chases, then **lunges**: stops, a charging signal beam lines up (0.6 s), charges 230 px along that line, is dazed briefly | Telegraph is a soft glowing beam (the first version "looks like you made it in Microsoft Paint"). Sidestep or dash through it. A stun cancels it. Lightning sounds. |
| Green | **turret that blinks**: never walks; stands and fires the whole time it isn't teleporting. When it trails a moving player (or is far behind, or a rack blocks its shot for 1.5 s) it fades out and reforms on the far side of the player, in their path (±50°, 140–230 px away), then fires a 2-shot volley | Built to stop easy kiting ("they need to teleport to the opposite end of the player"). Greens blinking together **land spread out** (~80 px apart when there's room). Health halved to 30 after the first playtest ("they are insane lol"). Can't be hit or touch you while fading; the reform gather is the warning. A stun cancels the blink. Soft glassy blink sounds. |
| Orange | stays back, homing shots | Arcade only so far |
| Pink | boss: slow drift, dashes, heavy fire | Laser removed as overpowered; size and speed raised on request |

- **Levels 1–5 use only violet, yellow and green.**
- **Pathing:** enemies follow a flow field around racks (they used to get stuck
  in a corner and run the wrong way round walls).
- **Spawns** are always a minimum distance from the player (they used to appear
  on top of you).

## Leaderboards (built Oct 2026)

- Six boards, one at a time: Arcade Desktop / Mobile, This Week Desktop /
  Mobile, Story Progress, Lifetime Chroma. **Easy to cycle:** big ‹ › arrows on
  desktop, swipe on phones. The board resets to your platform's Arcade board
  whenever the title screen opens.
- Desktop and mobile Arcade scores are separate ("touch controls are a
  different game").
- **Story points:** 1 per level cleared with each different character (Raze
  adds a third point per level once unlocked).
- **Lifetime Chroma is one number:** violet 1, yellow 10, green 100, orange 1,000,
  pink 10,000. Rewards whoever plays most.
- **Names:** chosen on first start, up to 10 characters, changeable from the title.
- **Game over shows your rank** and "NEW PERSONAL BEST" or your best. Not "points
  behind the next player".
- Scores come from the browser and can be faked. Fine for now; needs a
  server-side check before going public.

## Ideas the owner liked but parked

- **Unlockable character colours** via a colour picker ("Would be fun let's
  commit to that"). Not built.
- **Map secrets in Arcade** that unlock things. Not built.
- **A Workshop** to spend Chroma on skill-tree nodes per character. Designed in
  `docs/design/core-loop.md`, not built.
- A 16-bit art direction was discussed and **not** taken; the current pixel art
  stays.
