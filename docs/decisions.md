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
| Dex | Burst | three quick rounds per trigger pull | 0.85 bursts/s, 3 rounds, damage ×0.60 (was 0.66; "he clears really quickly") |
| Raze | Long Rifle | one slow, heavy gold round that flies fast and far and goes through one Chromatic | 0.8 shots/s, one round a pull, like Dex's pulls (owner: "slow attack speed... we can test and iterate"; 0.75 was tried and cleared crowds half as fast; 0.9 with ×1.8 damage was "busted"), damage ×1.15 (violets take 3 hits, or 2 in a row with Follow-Up), round speed ×2.4 (slower rounds missed walking targets a third of the time), range ×1.3, pierce 1, a slightly bigger hit area. 85% move speed, 120 px dash |

- **+1 projectile means more of your gun's thing:** Dex gets a 4-round burst (not
  doubled bullets); Juno fires 25% faster. Never just duplicate shots.
- Default fire was slowed on request to 1.5 shots/s at 360 px/s for the base stats.

### Raze
- **A person, not an Echo** (the old "trading algorithm Echo" idea is gone): an
  OG marksman, Null's oldest partner, held in the Basement for years. The
  Basement arc (Levels 1–5) is the mission to **rescue him**; clearing Level 5
  unlocks him. Full definition: `docs/design/levels-2-5.md`.
- **Colour: gold/yellow `#FFD23F`, never orange** ("I prefer for his color to be
  more gold or yellow than orange… dont make his stuff orange"). Changed from
  `#FFB52E`. Keep it clear of the yellow Chromatics' `#e9ff6a` (greener).
- **He earns an ability per level only by replaying Levels 1–5 as him.**
- **His Story runs use the same levels, new dialogue only.** He has his own
  reason to be there (retraining, and a mission of his own), since he can't
  rescue himself or collect his own memories. Who's in his ear rotates: nobody
  wants the job because they're afraid of him. Dex and Juno are obnoxious and
  funny; Raze is baffled by the jokes, with comic PTSD, and slowly warms up.
- **Once he's saved, Level 5 no longer shows him caged, for every character.**
- **His kit (owner's picks, Oct 25, 2026; "fit the same styles but toward his
  own unique brand"):** Long Rifle; L1 **Follow-Up** (the owner's idea:
  consecutive hits on the same enemy without missing hit harder, so most drop
  in 2 and "he can crush bosses too"); L2 **Net** ("like Caitlyn": fire a net,
  get thrown the other way, over low walls; anything caught takes a fast
  tracer from the next shot); L3 **Snare Trap**; L4 **Punch-Through**; L5
  **Laser Round** ("thin, piercing, max range"). Numbers and level fits:
  `docs/design/levels-2-5.md`. Net direction: you're thrown the way you move,
  the net flies the way you came (standing still: at the cursor), with no new
  buttons.
- **He joins seamlessly, even at Level 1:** every level works with his tools
  (the tanks crack to net + tracer, boxes to Punch-Through, anchors to the
  laser), Level 1 has his own sampler (Follow-Up → Snare Trap →
  Punch-Through), and every level has his lines.
- **The pick screen before and after:** before the rescue he's there as a dark
  silhouette ("Free him in Story Level 5", LOCKED) so players know who they're
  working toward; never in the prologue. The rescue's results show NEW AGENT:
  RAZE, and his card says NEW until he's picked.
- **His sprite's coat was shifted from orange to gold** (`tools/recolor_raze.py`,
  run by `build_raze_sprite.py`). His portraits were already gold and are the
  owner's art, so they're untouched.
- **The first sprite stays** (Oct 2026): a second sheet was tried; its feet
  were better but the original reads more clearly in play ("the old one is
  more clear").
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
| Dash | **Space or click: dashes toward the cursor** (right-click always; left-click when auto-fire is on, since with it off the left button fires) | DASH button (the way you're moving) |
| Abilities | E = first activated ability, F = second (the grenade lands at the cursor) | round buttons next to DASH; **the grenade: press its button and drag to where it should land**, a ring shows the spot, let go to throw (a tap alone throws nothing) |
| Comms | **Space**, Enter, or click the box (Space only moves comms on while a line is up, so it never dashes by accident) | tap the box |
| Pause / skip scene | Esc | SKIP button |

- **E is the first activated ability a character gets, F the second.** "If
  there's no ability, then there's no function for E." Every ability gets a key.
  (An earlier fallback that threw a grenade with no ability was rejected
  outright.)
- **Dash:** any character; on desktop Space or a click dashes toward the cursor. While a comms line is up the game is stopped, so Space moves the line on instead; the two never collide (Oct 24, 2026). 88 px in 0.16 s, 1.6 s cooldown (shortened 20%
  and cooldown raised on request). Untouchable mid-dash; a perfect dodge refunds
  the cooldown once. Cooldowns must be clearly visible (key bar on desktop,
  rings on touch buttons).
- **Touch layout (decided Oct 2026):** slim health bar in the very top-left with
  just the number (no "HP", no "/ 100"); comms and objective at the top in
  landscape; buttons are **round and see-through**; AUTO sits up-left of the left
  stick, mirroring DASH up-right of the right stick.
- **Camera:** PC zoom 1.95 (zoomed in from 1.7: "users can see too much of the
  map"). Phones zoom by screen size, never showing less than 340 px of width,
  then pulled back 10% (Oct 25, 2026, owner's request), so at least 378 px.

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
- **Text only while the game is stopped** (Oct 24, 2026): while a comms line is up the agent can't shoot, and if any Chromatic is on the map everything freezes until the line ends or the player presses Space. Placement: on **desktop** the box sits **just below the middle** of the screen so people actually read it ("they don't see it much"); on **phones** it stays **at the top**, as before, with the objective under it. (A bottom-half placement was tried and dropped the same day.)
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
  Arc Round. Juno: Hot Barrel → Piercing Stream → Ricochet. (Arc Round replaced
  Kinetic Finish, the knockback round, on the owner's request: the last round of
  each burst is electric and jumps to another enemy within 130 px.)
- **Keep one:** opening the door the first time as a character saves the **first**
  power-up permanently as a Story card for that character, with the unlock tune.
- **One ability per level, and the level is built around it** (Oct 24, 2026, after playing Level 2: "this was fun"). Every level gives a new ability early (after its first wave) and its tasks and puzzles need that ability, like Level 2's frozen tanks that only the dash ability cracks. Clearing the level keeps it as a Story card. (This replaced a short-lived "card every two levels" plan.) Plan: `docs/design/levels-2-5.md`.
- **Longer levels, just as much interaction:** from Level 3 on, every level is at least as long and as hands-on as Level 2 (moving around, sliding, things to crack and grab), never just waves.
- **Dash abilities (Level 2):** Dex's **Shock Dash** stuns and jams (+50% damage taken) every Chromatic he dashes through; Juno's **Parting Charge** drops a light bomb where she dashed from, which bursts 0.6 s later. Level 2 grants it after the first wave and keeps it if you clear the level. Some objectives (Level 2's frozen tanks) only break to the dash ability, never bullets.
- **Level 3's puzzle uses the ability:** the beam mirrors sit in sealed pockets you can't walk into, so the only way to turn them is to lob the thrown ability (grenade or beacon) over the walls. The terminal hold is about keeping Chromatics out of the ring (stun them, or lure them out). Abilities recharge twice as fast during the beam puzzle so it isn't a wait.
- **Thrown abilities on touch:** press the ability's round button and drag to aim (grenade and beacon alike).
- **Chromatics never undo progress** (Oct 25, 2026): in Level 3's terminal hold they used to drain the ring, and with enemies constantly coming it was "pretty much impossible". Now the ring only fills: a Chromatic in it pauses the pull, and you can step out and come back without losing anything. Level 1's relays keep draining on purpose: "kind of hard but doable"; Level 3 is longer, so draining there was annoying.
- **Level 4's targets need the trick shot:** junction boxes and dials ignore plain rounds, grenades, beacons and walking; only Dex's Arc Round jumping to them (off a cable or a Chromatic) or Juno's bounced round works. Otherwise "people will just throw grenades or walk up to it".
- **The escape:** live wires you can only cross mid-dash, a generous timer, an alarm and the operator telling you to run. Urgency comes from a steady red edge, never flashing. Running out of time seals the door and the level starts over (no checkpoint).
- **Minimum text size: 12 px, everywhere** (Oct 25, 2026: "everything needs to be easy to read"). `MIN_FONT_PX` in game.js clamps every font the game sets; long text wraps (and panels grow) instead of shrinking. Check new screens with `tools/playtest/screens.js`.
- **Dex's lightning is lime, always.** Every electric effect of his (Arc Round bolts, grenade arcs, jammed crackle, Shock Dash) is drawn in his lime, with solid strokes so it doesn't wash out to white over other glows. The Arc Round bolt is thick, branches and leaves a ring where it lands.
- **Dex tuning (Oct 25, 2026):** Arc Round's jump does 10% more damage. Shock Dash got +35% damage (5.4) and +50% stun (1.8 s; jam 2.4 s) because dashing into enemies is risky.
- **Raze (owner's definition):** an OG marksman and Null's oldest partner, captive for years and a bit crazy; threatens people; Dex and Juno are wary of him. Long rifle, slow fire, heavy rounds, slow movement, traps that slow enemies, slippery. Seen early in Level 5, a boss with waves blocks the rescue, and the meeting (plus his first talk with Null) happens after the level. Details: `docs/design/levels-2-5.md`.
- **Raze is a person, never "in pieces".** What Levels 3 and 4 recover are his **memories**: the Chromatics have been taking them for years to feed the hoard. Null explains this before Level 4.
- **Saves must be consistent while testing** (Oct 25, 2026: progress and even the name kept changing on the test build). Browser storage inside claude.ai artifacts isn't reliable, so `boot.js` keeps the save in each artifact's database too. Each place still has its own save: the live site, the main preview and the test build don't share one.
- **Progress you can see** (Oct 25, 2026): an object that takes more than one hit shows it: Level 5's anchors have two charge lights, a ring that fills (Juno), sparks while charging, a grey ring when plain fire glances off, and the key to use over each one ("F" on desktop, the ability's name on phones).
- **Turrets are machines, not ghosts:** the Signal Hoarder's turrets are pixel-art pylons with a tracking lens, so they can't be confused with green Chromatics. Destroy them all and their light flies back into it: stunned 2 s (tried 1.5 s; back to 2 at the owner's call). **Turrets come in sets: 1 in phase 1, 3 in phase 2, 5 in phase 3** (owner's call: "it's actually a bit too easy"). The whole set drops on one jump, spread evenly round a ring 110–200 px from the core, and no more come until every one is down, so players are never stuck in a loop of turrets rebuilt before they can kill the ones up. (Before: one per jump up to 2–3 standing, which made phase 1 a single turret and a quick stun.) **1–2 greens fight alongside the boss at all times** outside its waves: one right away, a second 5 s later. Level 5 has one fewer enemy in every group and on the floor at once (later phases piling on more was "out of control").
- **Boss difficulty comes from bullet patterns, not extra enemies** (owner's preference for this level): phase 2 adds a rotating 3-arm spiral, phase 3 a 4-arm spiral that reverses direction and rings with a gap to slip through. Slow rounds; a dash goes through.
- **No plain lines for energy:** beams twist (two strands, a glow, flowing motes); `energyRibbon` in level.js.
- **F abilities (owner's redesign):** Dex's **Arc Discharge** is a shotgun blast of 11 electric rounds in a wide arc that pierce and stun/jam. Juno's is **Half-Life**: for 5 s her rounds hit **twice as hard, pierce two targets**, and make what they hit *decay* (its stolen colour flaking off, 6 health a second for 3 s, refreshed not stacked). Buffed after the first playtest (she couldn't win Level 5). While it's on it's unmistakable: a lilac radiation field under her (two counter-turning rings), motes rising off her, a lilac screen edge, bigger lilac rounds shedding motes, and the F slot reads ON with the seconds left. Player rounds still cancel enemy rounds (owner: leave that). Radioactive decay rather than fire or acid, to fit the story.
- **No escorts.** The Echo following you to the lift was "kind of lame" (Oct 24, 2026); Level 2 makes the whole floor ice (owner: "make the whole level icy"; you slide everywhere) and frozen drives/tanks instead.
- **Health in every level** (Oct 25, 2026): Level 1's Echoes come out of its relays; from Level 2 on, two Echoes appear near you after each finished section, and one each time a boss splits.
- **Checkpoints: only at a boss** (Oct 25, 2026; Level 4's escape was given one, then the owner said it doesn't need it). Dying at Level 3's boss offers RETRY BOSS (the level's ability kept, earlier sections done). Going back to the Story map or menu clears it: the next attempt starts the level over. Dying anywhere else restarts the level.
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
  different game"). If your platform's board has no runs yet, the title opens
  on the other one instead (Oct 2026: on phones the empty mobile board looked
  like "I don't see any of the records").
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
- **Unlock hints are gold.** STORY MODE has "N CARDS TO EARN" in gold on
  its right (unlocked levels, free characters, cards not yet earned); the map marks each waiting card
  with a glowing ◆ in that character's colour, and the mission name glows gold
  (a gold edge on the whole row was tried: "hard to see what's going on"). ARCADE MODE wears "NEW" until each newly earned Story card has come up
  in an upgrade offer, where it carries a gold NEW tag once. Soft glows only,
  no blinking.
- **Raze's Net cooldown is 3 s everywhere** (was 2.4 s; 4.5 s outside Level 2
  was tried and reverted: "he is actually fun like he is already"; 3 s so he
  can still handle the first boss).
- **The comms always finish before any end-of-level menu.** The card unlock
  and results wait until the last line has played (the boss-kill lines were
  being covered by the card).
- **Raze's Net catches one Chromatic** (was up to 3). Later cards may raise it.
- **Main menu order:** STORY MODE on top and highlighted (Space opens it),
  ARCADE MODE under it, then MULTIPLAYER greyed out with a red COMING SOON
  badge (not clickable). **Badges are plain coloured text inside the
  button, on the right, centred on its height** (gold for cards, red for
  COMING SOON). Tried and dropped: pills hanging off a corner, then pills
  under the label. Archive and Settings as before.
