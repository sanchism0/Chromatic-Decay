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
| 4 | **To decide.** Chain Arc went into Level 1 instead (Arc Round replaced Kinetic Finish). Option: a stronger version where every round jumps | **To decide.** Suggestion: **Ricochet** (passive, from the Level 1 sampler): shots bounce off racks |
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
left part of his signal in a terminal here, and the vault in the middle holds
something huge.

**Map:** eight tall tape towers in a ring round an open centre (the vault and
the boss arena), gaps facing up, down, left and right. Three **sealed pockets**
(racks on all four sides) hold the beam mirrors. Sepia floor, amber lights.

**Built around the thrown ability** (Dex: Stun Grenade, Juno: Decoy Beacon),
granted after the first wave:

| Beat | Play | Comms (gist) |
|---|---|---|
| Wave | Violets in big groups, a few yellows; then the ability screen | "The Stacks. Every stream nobody ever played ended up here." |
| **Hold** (task) | Stand in the terminal's ring while it pulls Raze's signal (22 s). Any Chromatic in the ring that isn't stunned stops the pull and drains it: Dex stuns them where they stand, Juno throws the beacon outside the ring to pull them out. Up to 5 enemies, many yellows | "Anything else in the ring stops the pull." |
| Wave | Violets and yellows together | "Something heard that." |
| **Beam** (puzzle) | A beam runs from a wall emitter, above the racks, through three mirrors sealed in the pockets. Land the ability on a mirror (thrown over the walls) to turn it; the beam shows where each one points. All three right and the vault opens. Abilities recharge twice as fast here; up to 3 enemies | "The mirrors are sealed in. Throw your grenade/beacon over the wall." |
| **Boss: The Queue** | A huge violet (900 health, about 35 s of shooting) rises from the vault and drifts after you. It winds up and sends out rings: dash through them (untouchable mid-dash, and a perfect dodge refunds the dash). At 75%, 50% and 25% it splits off five violets. When it dies, everything left dissolves | "That's not a Chromatic. That's all of them." |
| Exit | Walk into the open vault: beam-out, card, results | "Got you. And a piece of him with you." |

Code: `hold`, `beam` and `boss` beats in `level.js`, `decoy.js`, the Stacks map
(`STACKS` in `map.js`) and palette.

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

New code: gather beat, tuning beat, Wire Room map, the Level 4 ability (to decide). To be reshaped around that ability.

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

1. Engineering above, plus **Level 2** (dash abilities, ice, drives, frozen tanks, Cold Storage map). Built.
2. **Level 3** (hold zone, mirror beam, The Queue, Decoy Beacon). Built.
3. **Level 4** (gather, tuning).
4. **Level 5** (anchors, Signal Hoarder, rescue, F abilities, Raze unlock).

Each step also: comms lines for both operators, a playtest script, the docs.
