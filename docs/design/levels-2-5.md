# Levels 2–5: plan

The rest of the Basement arc: following Raze's trail down from the Server Floor
to his room, rescuing him at the end of Level 5, and unlocking him as the third
playable character. Written Oct 24, 2026, for the owner to react to before
building.

Rules this plan follows (from `docs/decisions.md`):
- Each level: **wave → task → wave → puzzle**, with a **boss from Level 3**.
- Levels 1–5 use only **violet, yellow and green**. Greens (the blinking
  turrets) debut properly in Level 4.
- **Tasks are fights with a goal.** Enemies interrupt throughout; never "stand
  here for 20 seconds" in an empty room.
- **Puzzles work with burst and spray guns:** you walk onto things, or shoot
  big targets. Never precise shooting.
- **The comms carry the story:** each level opens with why you're there and
  ends with what you got. A few short lines per section, written for both
  operators.
- **Not annoying:** cap enemies wherever a task needs focus.
- **Cards belong to the character who earned them**, and from Level 2 on a
  character starts with only their own cards. Level 1's section power-ups were
  a sampler; Levels 2–5 don't give power-ups mid-level.

---

## The cards: what each level awards

**One ability per level, and the level is built around it** (owner's call
after playing Level 2). Each level hands the agent its new ability after the
first wave, and the task and puzzle need it. Clearing the level keeps it as a
Story card for that character. Each character ends the arc with five cards.
Levels also get **longer, with as much interaction as Level 2** from here on.

| Level | Dex | Juno | Raze |
|---|---|---|---|
| 1 (built) | Heavy Bursts: 4-round bursts, +15% damage | Hot Barrel: minigun 25% faster | Follow-Up |
| 2 (built) | **Shock Dash**: everything he dashes through is stunned and jammed (+50% damage taken) | **Parting Charge**: a light bomb drops where she dashed from and bursts 0.6 s later | Net |
| 3 (built) | **Stun Grenade (E)** | **Decoy Beacon (E)**: throw a beacon that pulls Chromatics to it for 3 s; they bunch up for the minigun | Snare Trap (E) |
| 4 (built) | **Arc Round** (passive, owner's call): the last round of each burst is electric and jumps to something close by. Previewed in Level 1's sampler; Level 4 makes it a card | **Ricochet** (passive): rounds bounce once off racks. Previewed in Level 1's sampler; Level 4 makes it a card | Punch-Through |
| 5 (built) | **Arc Discharge (F)**: a shotgun blast of 11 electric rounds that pierce, stun and jam | **Half-Life (F)**: 5 s of rounds that hit twice as hard, pierce two and make what they hit decay | Laser Round (F) |

Raze's are detailed under Raze, at the end of this doc.

**Decoy Beacon (Juno, E), defined:**
- **Throw:** like Dex's grenade: it arcs over racks and lands at the cursor
  (desktop) or ahead in the aim direction (phone), up to about 200 px away.
- **Lure:** on landing it pulses soft lilac light for **3 s**. Every violet
  and yellow within about 220 px forgets Juno and crowds the beacon; yellows
  lunge at it instead of her. Greens stay put but shoot at it.
- **Payoff:** they bunch up in one spot, right in the minigun's stream. No
  damage of its own; it buys space and lines up the kill.
- **End:** the light fades (no flash) with a glassy chime; they turn back.
- **Cooldown:** 10 s (the grenade's is 8 s), shown on the E slot and the
  round touch button.
- **In Level 3:** the terminal zone task is about keeping Chromatics *out*
  of it (beacon pulls them away; Dex's grenade stuns them where they stand),
  and the boss's split-off violets come in rings the beacon can gather.

That makes the Arcade Story deck ten cards (up from three). Level 4's ability is passive because E and F are taken by Levels 3 and 5. Its tasks would then be built around hitting things you can't see directly: signal nodes tucked behind cable runs that only a chained or bounced shot reaches. Arc Round,
Piercing Stream, Ricochet and a possible Chain Arc stay Level 1 sampler
power-ups for now, and are candidates for later levels or the Workshop.

**Raze** earns one card per level by replaying Levels 1–5 as him (built
Oct 25, 2026; his kit is at the end of this doc, under Raze).

---

## Level 2: Cold Storage

**Story:** Raze's trace led down to the cold archive, where old data was frozen
for keeping. His trace is split across three archive drives frozen into the
floor. You leave with the drives and the lift running: down to The Stacks.

**Map:** long parallel aisles of tall cold racks with cross-gaps. Pale
blue-white palette, frost, and **the whole floor is ice**: you slide everywhere (your speed
eases in and out, and a dash keeps sliding).

| Beat | Play | Comms (gist) |
|---|---|---|
| Wave | Violets and yellows down the aisles; then the **dash ability** screen | "Cold Storage. Raze's trace led down here." |
| **Drives** (task) | Grab three frozen drives. Up to 4 enemies at once | "Your dash crackles now / leaves a charge. Three drives, frozen into the floor. You'll slide." |
| Wave | Yellows in the narrow aisles | "They heard the ice crack." |
| **Frozen tanks** (puzzle) | Three coolant tanks freeze the lift. Bullets do nothing; each needs two hits from the dash ability (Dex dashes through, Juno dashes away from it) | "Bullets won't touch that ice." |
| Exit | Ride the lift: beam-out, card, results | "Hold on. Going down." |

Built: drives and freezers beats, ice, `dashpowers.js`, the Cold Storage map.
(The first build had an Echo escort and coolant valves; the owner found the
escort lame, so both were replaced.)

## Level 3: The Stacks (first boss), built

**Story:** towers of old tape where the streams nobody played pile up. Raze
left one of his memories in a terminal here, and the vault in the middle holds
something huge.

**Map:** eight tall tape towers in a ring round an open centre (the vault and
the boss arena), gaps facing up, down, left and right. Three **sealed pockets**
(racks on all four sides) hold the beam mirrors. Sepia floor, amber lights.

**Built around the thrown ability** (Dex: Stun Grenade, Juno: Decoy Beacon),
granted after the first wave:

| Beat | Play | Comms (gist) |
|---|---|---|
| Wave | Violets in big groups, a few yellows; then the ability screen | "The Stacks. Every stream nobody ever played ended up here." |
| **Hold** (task) | Stand in the terminal's ring while it pulls one of Raze's memories (22 s). Any Chromatic in the ring that isn't stunned pauses the pull (progress never drains; you can leave and come back): Dex stuns them where they stand, Juno throws the beacon outside the ring to pull them out. Up to 5 enemies, many yellows | "Anything else in the ring stops the pull." |
| Wave | Violets and yellows together | "Something heard that." |
| **Beam** (puzzle) | A beam runs from a wall emitter, above the racks, through three mirrors sealed in the pockets. Land the ability on a mirror (thrown over the walls) to turn it; the beam shows where each one points. All three right and the vault opens. Abilities recharge twice as fast here; up to 3 enemies | "The mirrors are sealed in. Throw your grenade/beacon over the wall." |
| **Boss: The Queue** | A huge violet (900 health, about 35 s of shooting) rises from the vault and drifts after you. It winds up and sends out rings: dash through them (untouchable mid-dash, and a perfect dodge refunds the dash). At 75%, 50% and 25% it splits off five violets. When it dies, everything left dissolves | "That's not a Chromatic. That's all of them." |
| Exit | Walk into the open vault: beam-out, card, results | "Got you. And a piece of him with you." |

Code: `hold`, `beam` and `boss` beats in `level.js`, `decoy.js`, the Stacks map
(`STACKS` in `map.js`) and palette.

## Level 4: Wire Room (built, Oct 25, 2026)

**Story:** the Basement's switchboard, where the Chromatics locked up the
memories they took from Raze, in junction boxes all over the room. The greens
are camped on them. Null explains it in a scene before the level.

**Map:** a maze of thick cable bundles with wide junctions and long sightlines
(good for greens). Junction boxes sit in three-sided alcoves in the cable walls.

**Built around hitting things you can't hit straight on.** A junction box only
reacts to Dex's **electric round** (the last round of a burst) jumping to it,
or to Juno's **bounced** round. Plain shots glance off it with a dull spark
("shielded"), and grenades, beacons, dash abilities and walking up to it do
nothing. Dex: shoot an enemy or the cable wall within about 130 px of a box
and the arc jumps to it (through the cable). Juno: bounce a shot off a rack
into the box.

| Beat | Play |
|---|---|
| Wave | **Greens debut properly** ("They don't chase. They show up where you're going."). Then the ability screen: Arc Round / Ricochet |
| **Gather** (task) | Six junction boxes hold Raze's memories. Open each with an electric jump or a bounce, then walk over the memory that drops out. Nothing un-collects |
| Wave | Greens and yellows |
| **Tuning** (puzzle) | Three dials behind cover; each electric jump or bounced hit turns a dial to its next frequency. Match the big display (it lights each dial that's right) to open the door to Raze's room |
| **Escape** | The board overloads: alarm, a steady red edge that deepens, and the operator yelling RUN. 22 s to reach the far door (the walk is about 9 s), down an L-shaped corridor crossed by **four live wires**: walking into one zaps you (10) and throws you back; mid-dash you go straight through. Enemies keep coming. Out of time: DOOR SEALED, and the level starts over (no checkpoint, owner's call) |
| Exit | Through the door: beam-out, card, results |

Echoes after each section, as in every level from 2 on.

**Escape timing note:** a dash only saves about 0.2 s over walking, so a pure
"walk time minus a dash" timer would be near impossible. The live wires make
dashing a rule of the layout instead, and the timer is generous (owner's call:
"ample time to walk out, but stressful with the wires and enemies").

Code: `gather`, `tuning` and `escape` beats in `level.js`, the Wire Room map
(`WIRE` in `map.js`) and palette; Arc Rounds jump to `level.arcTargets` from
enemies and from cable hits (`projectiles.arcRackHits`); rounds that have
ricocheted carry `bounced`.

## Level 5: Raze's Room (built, Oct 25, 2026)

**Story:** the bottom of the Basement, where the Chromatics have kept Raze
alive for years, draining his memories into the hoard. He's seen early, caged
in hoarded light on the raised core; a major boss and wave after wave of
Chromatics stand between you and him. Kill the boss and the level ends; the
rescue happens in the scene after.

**Before it: a scene on the way down.** Null tells them what to expect. Gist:
- Null and Raze go way back ("He was fighting these things before either of
  you picked up an emitter"). Dex and Juno realise how little they know about
  Null, and how new they are to this.
- "He's been alone in the dark a long time. He'll threaten you. Let him. Don't
  turn your back on him either."
- Dex and Juno are uneasy; the banter turns nervous.

**Map:** a wide open vault (owner's call): Raze caged on a small core in the
middle, four anchors round the edge, a few long walls far out near the corners,
and four small blocks part way out for Juno to bounce off (clear of the boss).
Gold-on-black. Built: `VAULT` in `map.js`.

**Boss as built:** 1,100 health. Blinks every 4.2 s (3.2 below half) and leaves
a turret node (more as it weakens); shielded while any node stands. After each
blink, two rings of slow rounds (dash through). Aimed three-round volleys.
At 66% and 33% it calls a wave and is shielded until it's cleared (two Echoes
after each). Its death ends the level; the agent beams out where they stand.

**The ability (F, after the first wave):** Dex's **Arc Discharge** (a shotgun
blast of piercing, stunning electric rounds) and Juno's **Half-Life** (5 s of
rounds that make Chromatics decay). Each anchor needs two overloads: two Arc
Discharges, or about one full Half-Life on target.

| Beat | Play |
|---|---|
| Arrival | You walk in and **see Raze**: gold, caged on the core. His first words, over the open channel, are a threat ("Another of Null's errand kids. Stay out of my sightline."). The cage keeps you out |
| Wave | All three types. Then the F ability screen |
| **Break the hoard** (task) | Four anchors feed his cage; plain fire glances off until they're overloaded (Dex's discharge, Juno's Spin Up). Raze heckles from the cage, now and then usefully ("Left one. Are you blind?") |
| **Boss: the Signal Hoarder** (checkpoint) | The thing feeding on him: a giant green that blinks round the vault leaving turret nodes, untouchable while any stand. Between its phases, **waves** of violets, yellows and greens pour in. Three phases, an Echo or two each |
| Level end | It dies: results, card, then the scene |

**After it: two scenes.**
1. **Meeting Raze.** The cage drops. He's twitchy, sharp, half wild, and points
   his rifle at the agent before anything else. Dex and Juno clash with him
   (Dex's bluster vs his menace; Juno's precision vs his contempt). He doesn't
   say thank you.
2. **Raze and Null.** The first conversation in years. Raze is bitter ("You
   took your time"); Null is quieter than we've ever heard him. A hint of their
   history, and that Null needs what Raze remembers about the Collapse.
Then **RAZE UNLOCKED**.

## Raze (owner's definition, Oct 25, 2026)

- **Who:** an OG. Fighting the Chromatics long before Dex and Juno; a well
  known marksman: powerful shots, long range, a hunter, and tricky; he can get
  out of anything. Null's oldest partner, which makes Null's relationship with
  Dex and Juno relatively new.
- **Now:** captive for years, and a bit crazy for it. Dex and Juno are a little
  afraid of him and their personalities clash. He threatens people, especially
  early on.
- **Look:** a long gold-and-black coat, a mechanical left arm, dreadlocks with
  glowing gold tips, a headband and headset, a long rifle on his back. Colour
  `#FFD23F`. Art: `assets/characters/raze/` (walk sheet, eight portraits:
  neutral, stern, smirk, laughing, uneasy, shocked, angry, snarl; turnaround).
- **Kit (built Oct 25, 2026; the owner picked it, "think Caitlyn"):** same
  slots as Dex and Juno, his own brand: patience, range, traps, one big shot.

  | Level (slot) | Dex | Juno | **Raze** | His way through that level's task |
  |---|---|---|---|---|
  | Gun | Burst | Minigun | **Long Rifle**: one heavy gold round every ~1.1 s (0.9/s, the same rhythm as Dex's trigger pulls), very fast (2.4x) and far (1.3x), goes through one Chromatic, a little forgiving to hit with. About 3 to bring down a yellow, 2 a violet | Plain shooting |
  | Movement | normal | normal | **85% speed; dash 120 px** (88 for the others) | |
  | 1 (upgrade) | Heavy Bursts | Hot Barrel | **Follow-Up**: the same Chromatic hit again without a miss in between takes +80%, then double from the third hit on. Three gold brackets round it show the streak. Most enemies drop in 2; bosses melt | |
  | 2 (dash) | Shock Dash | Parting Charge | **Net**: his dash throws him the way he's moving (standing still: away from the aim) in a 150 px hop that clears low racks, and fires a net of gold light back the other way. It catches one (more could come from later cards), held 2.2 s; his next shot sends a tracer into it (2.5x damage), steering onto them over racks. 3 s cooldown | Frozen tanks: the net catches the tank, the tracer cracks it (twice each) |
  | 3 (E) | Stun Grenade | Decoy Beacon | **Snare Trap**: lobbed over racks; arms in 0.25 s; holds the first 3 Chromatics that cross it for 2.5 s (twisting gold tethers), +35% damage taken. 9 s cooldown | Terminal ring: held counts as stunned. Mirrors: it lands on them like the grenade |
  | 4 (passive) | Arc Round | Ricochet | **Punch-Through**: rounds go straight through one rack or cable bundle (a gold ring where they go in and out) | Junction boxes and dials: a round that went through a cable counts |
  | 5 (F) | Arc Discharge | Half-Life | **Laser Round**: one thin laser right across the room, through every Chromatic on its line, 3.5x damage; a gold core with two strands twisting round it. Stops at a rack (Punch-Through: one). 8 s cooldown | Anchors: each laser fills a light on every anchor it crosses, so lining two up is the skill |

  - **Tall walls** (`tall` in map.js): the hop clears low racks but not the
    walls that seal a puzzle or a route: Level 3's mirror pockets and Level 4's
    corridor walls (so the escape can't be skipped).
  - **Arcade:** his cards join the shared pool like everyone's. Follow-Up is
    smaller for the others' guns (Dex +15%/+30%, Juno +10%/+20%) because their
    rounds land far more often. One F signature per run.
- **Unlock:** clearing Level 5 with anyone (`razeFree()` in profile.js). Before
  that he's on the pick screen as a dark silhouette, "Free him in Story Level
  5. LOCKED"; tapping him does nothing but light that line. The first clear
  shows NEW AGENT: RAZE on the results; his card carries a NEW tag until he's
  picked once. Not in the prologue (that's Dex and Juno's).
- **Story as Raze:** same levels, his own lines (`src/razestory.js`); see
  `docs/story/story-mode.md`.

## Engineering, done once before Level 2

1. **Maps per level:** `map.js` takes a layout per level; `pixelmap.js` takes a
   palette. Level 1 and Arcade keep the Basement.
2. **Start kit:** at a level's start, apply the character's own earned cards.
3. **Checkpoints:** only at bosses (owner's call): dying at the boss offers a retry from the fight; going back to the map or menu starts the level over. Built for Level 3.
4. **The F slot:** a second ability key on desktop and a second round button
   on touch (the HUD already reserves F).
5. **Boss framework:** health bar at the top, phases, a death sequence.

## Build order

One level at a time, each tested on desktop and phone, then merged:

1. Engineering above, plus **Level 2** (dash abilities, ice, drives, frozen tanks, Cold Storage map). Built.
2. **Level 3** (hold zone, mirror beam, The Queue, Decoy Beacon). Built.
3. **Level 4** (gather, tuning, escape). Built.
4. **Level 5** (anchors, Signal Hoarder, rescue, F abilities). Built; Raze's playable kit and unlock come later.

Each step also: comms lines for both operators, a playtest script, the docs.
