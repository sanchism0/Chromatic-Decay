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

| Level | Dex | Juno |
|---|---|---|
| 1 (built) | Heavy Bursts: 4-round bursts, +15% damage | Hot Barrel: minigun 25% faster |
| 2 (built) | **Shock Dash**: everything he dashes through is stunned and jammed (+50% damage taken) | **Parting Charge**: a light bomb drops where she dashed from and bursts 0.6 s later |
| 3 (built) | **Stun Grenade (E)** | **Decoy Beacon (E)**: throw a beacon that pulls Chromatics to it for 3 s; they bunch up for the minigun |
| 4 | **Arc Round** (passive, owner's call): the last round of each burst is electric and jumps to something close by. Previewed in Level 1's sampler; Level 4 makes it a card | **Ricochet** (passive): rounds bounce once off racks. Previewed in Level 1's sampler; Level 4 makes it a card |
| 5 | **Arc Discharge (F)**: from the old signature code. A ring of shots that knocks back and stuns | **Spin Up (F)**: from the old signature code. Fires twice as fast with a tighter stream for 4 s |

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

**Raze** earns his own cards by replaying Levels 1, 3 and 5 as him. His set
gets designed once he's playable (heavy gold rounds suggest pierce,
armour-break, a slow-time shot).

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

## Level 5: Raze's Room (plan v2, Oct 25, 2026)

**Story:** the bottom of the Basement. The hoarded signal of everything the
Chromatics took down here has walled Raze in. Break the hoard, beat what feeds
on it, and bring him home. He speaks for the first time.

**Map:** a round vault with a raised core in the middle (Raze, behind the
wall of hoarded signal) and four signal anchors round the edge, each in its
own bay. Gold-on-black palette, the hoard drawn as soft drifting colour.

**Before it: a scene** like the lift one. The last door; Raze's voice coming
through for the first time, broken up; Dex and Juno on what they'll do if he's
"just another Echo".

**The ability, after the first wave: the F slot.**
- **Dex: Arc Discharge (F).** A ring of electric rounds out from him, all
  directions at once: stuns and knocks back. About 9 s cooldown.
- **Juno: Spin Up (F).** 4 s of more than double fire rate with a tight stream.
  About 11 s cooldown.
(Both exist in the code from the old signature system.)

**Built around it:** the anchors and the boss's nodes are wrapped in hoarded
signal that plain fire can't crack.

| Beat | Play |
|---|---|
| Wave | All three types; the biggest wave yet. Then the F ability screen |
| **Break the hoard** (task) | Four anchors. Each is shielded until it's **overloaded**: caught in Dex's discharge ring, or hit by Juno's rounds while Spin Up is running. Then it takes damage (progress is kept, never lost). F recharges faster here, like the thrown abilities in Level 3's puzzle. Greens blink around you |
| Wave | All three, heavier |
| **Boss: the Signal Hoarder** (checkpoint) | A giant green that blinks round the vault and leaves a **turret node** where it was. It's untouchable while any node is up. Nodes go down to normal fire, but they come in clusters: Dex's discharge clears a ring of them, Juno's Spin Up melts them. With the nodes down it turns solid for a few seconds: burn it. Each third of its health adds a node per blink. Echoes as it weakens |
| **Rescue** | The hoard falls; walk up the core to Raze's Echo, a gold light. A short scene: Raze speaks for the first time (gold light, no portrait). Who he was (the trading algorithm that crashed markets), that he remembers, and one line that shows he knows Null |
| Exit | Beam out together: card, results, then **RAZE UNLOCKED** |

New code: overload targets, the Signal Hoarder (blink + node spawning +
solid windows), the F slot (key bar and a second round touch button), Raze
as a speaker and his gold light figure, the unlock screen, Raze in character
select.

**Open questions:** whether Raze is playable in Story straight away (every
level needs a third set of operator lines, or a "Raze in the field" version)
or Arcade first; and how much Raze gives away about Null.

## Raze as a playable character

- **Art:** no new art for now. He's a gold light figure (the owner's earlier
  rule: characters without art are drawn as light). Real sprites later.
- **Gun:** Heavy, already defined in `WEAPONS.raze`: slow, strong gold rounds.
- **Unlocks:** clearing Level 5 adds him to character select (Arcade and
  Story). Story points and the D/J/R leaderboard column already count him.
- In Story, when Raze is the agent, Dex or Juno (player's choice) is on comms.

---

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
4. **Level 5** (anchors, Signal Hoarder, rescue, F abilities, Raze unlock).

Each step also: comms lines for both operators, a playtest script, the docs.
