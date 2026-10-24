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

**One card every two levels** (owner's call): Levels 1, 3 and 5 each give the
character who clears them one Story card, the first time. Levels 2 and 4 pay
Chroma (and Story points) only. Each character ends the arc with three cards:
their gun upgrade and two activated abilities.

| Level | Dex | Juno |
|---|---|---|
| 1 (built) | Heavy Bursts: 4-round bursts, +15% damage | Hot Barrel: minigun 25% faster |
| 3 | **Stun Grenade (E)**: built | **Decoy Beacon (E)**: new. Throw a beacon that pulls Chromatics to it for 3 s; they bunch up for the minigun |
| 5 | **Arc Discharge (F)**: from the old signature code. A ring of shots that knocks back and stuns | **Spin Up (F)**: from the old signature code. Fires twice as fast with a tighter stream for 4 s |

That makes the Arcade Story deck six cards (up from three). Kinetic Finish,
Piercing Stream, Ricochet and a possible Chain Arc stay Level 1 sampler
power-ups for now, and are candidates for later levels or the Workshop.

**Raze** earns his own cards by replaying Levels 1, 3 and 5 as him. His set
gets designed once he's playable (heavy gold rounds suggest pierce,
armour-break, a slow-time shot).

---

## Level 2: Cold Storage

**Story:** Raze's trace led down to the cold archive, where old data was frozen
for keeping. A frightened Echo here saw him pass and knows the way to the lift.
You leave with the Echo safe and the lift running: down to The Stacks.

**Map:** a new layout: long parallel aisles of tall cold racks with cross-gaps
(good for yellow lunges, bad for running). Pale blue-white palette, frost on
the floor.

| Beat | Play | Comms (gist) |
|---|---|---|
| Wave | Violets and yellows down the aisles | "Cold Storage. Raze came through here. Something's still moving." |
| **Escort** (task) | A slow Echo follows you to the lift, about 60% across the map. It stops whenever a Chromatic touches it (they drain it, like the relays). Up to 4 enemies at once | "That Echo saw him. Get it to the lift and it'll show us the way." |
| Wave | Yellows in the narrow aisles | "They followed the Echo's light." |
| **Coolant valves** (puzzle) | The lift is frozen. Three valve plates; standing on one opens it for 8 s. Get all three open at once (run between them while a few violets get in the way) | "Three valves. Open them together and the ice lets go." |
| Exit | Ride the lift: beam-out, card, results | "The Echo knows where he went: The Stacks." |

New code: escort beat, timed-plates beat, the Cold Storage map and palette. No card (Chroma only).

## Level 3: The Stacks (first boss)

**Story:** towers of old tape where the streams nobody played pile up. Raze
left part of his signal here, and something huge is guarding it.

**Map:** tall tower stacks in a ring around an open centre; the boss arena is
the centre.

| Beat | Play | Comms (gist) |
|---|---|---|
| Wave | Violets in big groups | "The Stacks. Every stream nobody played ended up here." |
| **Hold the line** (task) | Stand in a terminal's zone to pull Raze's signal fragment; progress only fills while you're inside, and yellows lunge into the zone. Dash out and back in to dodge | "There's a piece of him in that terminal. Stay close while it pulls." |
| Wave | Violets and yellows together | |
| **Beam** (puzzle) | A light beam must reach the vault door. Three mirrors turn 90° each time you walk over their floor switch; the beam is drawn live, so you see where it goes | "Bounce the light to the door. Step on a switch to turn its mirror." |
| **Boss: The Queue** | A huge violet made of unplayed streams (about 1,200 health). It drifts after you and sends out slow rings you **dash through** (untouchable mid-dash). At 75%, 50% and 25% health it splits off a ring of violets | "That's not a Chromatic. That's all of them." |
| Exit | Beam-out, card, results | "He was here. And he's still ahead of us." |

New code: hold-zone beat, mirror-beam beat, boss framework, The Queue, the
Stacks map, Decoy Beacon. Card: Stun Grenade / Decoy Beacon.

## Level 4: Wire Room

**Story:** the Basement's switchboard. Raze's signal shattered here; pieces of
him are scattered across the room, and the greens are hunting them.

**Map:** a cable maze with wide junctions, plenty of sightlines for green
turrets.

| Beat | Play | Comms (gist) |
|---|---|---|
| Wave | **Greens debut**: a few, plus violets | "Greens. They don't chase. They show up where you're going." |
| **Gather** (task) | Six fragments of Raze's signal are scattered around; pick them all up. Each fades if a Chromatic sits on it too long (marked with arrows) | "Those are pieces of Raze. Grab them before they're eaten." |
| Wave | Greens and yellows | |
| **Tuning** (puzzle) | Three dials (floor switches), each cycling through three frequencies. Match the pattern on the big display; it lights each dial that's right | "Match the signal. When all three are right, the door opens." |
| Exit | Beam-out, card, results | "Every piece. The door ahead is his." |

New code: gather beat, tuning beat, Wire Room map. No card (Chroma only).

## Level 5: Raze's Room (second boss, rescue)

**Story:** Raze's room, where the hoarded signal has walled him in. Break the
hoard, beat what feeds on it, and bring him home.

**Map:** a vault with a raised core in the middle; four signal anchors around
the edge.

| Beat | Play | Comms (gist) |
|---|---|---|
| Wave | All three types | "This is it. He's in there." |
| **Break the hoard** (task) | Shoot four signal anchors (like Level 1's servers but tougher) while greens blink around you | "Four anchors are holding the wall. Break them." |
| Wave | All three, heavier | |
| **Boss: Signal Hoarder** | A giant green that blinks around the room, leaving turret nodes behind it. Destroy the nodes to make it solid, then hit it | "It's eating everything he was. Make it let go." |
| **Rescue** | Walk to Raze's Echo. A short comms scene: Raze speaks for the first time, as a gold light (no portrait yet) | Raze: a few lines. Who he was, that he knows Null |
| Exit | Beam-out together, card, results: **RAZE UNLOCKED** | "You found him." |

New code: anchors (reuses the servers beat), boss two, Raze as a speaker,
the unlock, Arc Discharge and Spin Up as F abilities.

---

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
3. **Checkpoints:** not for now. Dying restarts the whole level (owner's call);
   revisit if the levels turn out long.
4. **The F slot:** a second ability key on desktop and a second round button
   on touch (the HUD already reserves F).
5. **Boss framework:** health bar at the top, phases, a death sequence.

## Build order

One level at a time, each tested on desktop and phone, then merged:

1. Engineering above, plus **Level 2** (escort, valves, Cold Storage map).
2. **Level 3** (hold zone, mirror beam, The Queue, Decoy Beacon).
3. **Level 4** (gather, tuning).
4. **Level 5** (anchors, Signal Hoarder, rescue, F abilities, Raze unlock).

Each step also: comms lines for both operators, a playtest script, the docs.
