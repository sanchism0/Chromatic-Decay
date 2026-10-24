# Character 4: Lumen, the skeleton (draft)

Started Oct 25, 2026 from the owner's brief: *"a skeleton guy that fires basic
and slow but converts enemies to corrupted versions that turn white and fight
for you. He's white colour palette."* Unlocked by clearing **Level 10**.
Everything below marked **(proposal)** is waiting for the owner's call.

## Who he is (proposal)

- **Name: Lumen** (owner's call), the Fragment already listed in the Archive.
- **Description (from the Archive):** a VPN service. Professionally invisible.
  Routed around every obstacle ever placed in front of it. *"Helped 40 million
  people disappear online. Happy to return the favor."*
- **What he is now:** what's left of an Echo once every bit of its colour has
  been taken: just the frame, bone-white. Most Echoes that far gone stop
  remembering who they were. He didn't. He can't hold colour any more, but he
  can **pull it out of a Chromatic**, and what's left obeys him.
- **Why it matters to the story:** he's white, like Null. Dex and Juno
  should be uneasy about that, and it sets up chapter 6 (who Null really is).
- **Voice:** dry, patient, a little funny about being dead. Few words, like Null,
  but warmer.
- **Where he's found:** at the end of the second chapter, Levels 6–10 (the
  story doc's "The Exchange", the old trading floor). Level 10's boss fight
  ends with him; clearing it unlocks him. Raze (Level 5) comes first, so he'd
  be the fourth playable character.

## How he plays (proposal)

**Gun: Bone Caster.** One slow round at a time (slower to fire than Raze's
Heavy, and the round itself travels slowly), with moderate damage. Bad at
crowds on its own. The army is the point.

**Convert (passive, his whole identity):** when one of his rounds lands the
killing blow, the Chromatic doesn't drain away. Its colour bleeds out and it
rises as a **Hollow**: the same ghost, turned white, fighting for him.
- **A Hollow keeps its type's behaviour**, aimed at enemies:
  - violets chase and drain enemies by touch;
  - yellows lunge at them;
  - greens stay put and shoot them.
- **Up to 3 at once.** Converting a fourth releases the oldest.
- **Each lasts 12 s**, or until it's taken enough hits. When it goes, its colour
  finally drains into him, so he still earns Chroma (just later).
- Enemies treat Hollows as targets too, which takes pressure off him.
- Hollows don't count as enemies for clearing a wave.

**Why it's fun:** every kill is a choice of target. Kill the yellow and get a
lunging bodyguard, or kill the green and get a turret where you want it.

## Look

- **Palette:** bone white and pale grey, with soft ash shading and dark eye
  sockets that glow faintly white. Pixel art like Dex and Juno (32×44
  cells), drawn in code until real art exists.
- **His rounds:** a slow white pulse with a dark core, so they read
  differently from Dex's and Juno's bright white shots.
- **Hollows:** white ghosts with a **dark core** (an inverted Chromatic), so
  they never get confused with Echoes (the white health pickups) or with Null.
  Soft and additive like every other light; no flashing.
- **Sound:** glassy, hollow tones; the conversion is a low resonant chime.
  No bone rattles (too toy-like).

## Story cards for him (proposal, one per level replayed)

| Card | What it does |
|---|---|
| Deep Hollow | Hollows last 20 s |
| Fourth Bone | Up to 4 Hollows |
| Last Rites (E) | Convert one living enemy under half health on the spot |
| Exit Node (F) | Every Hollow detonates in a soft white burst that stuns |

## Things that need building

- Allies as a system: enemies targeting something other than the player,
  Hollow AI per type, friendly fire rules. This is the big piece of work.
- His sprite (code-drawn pixel art), gun, round visuals, sounds.
- Character select, Story agent/operator pairings, leaderboard column
  (D/J/R becomes D/J/R/L).
- Levels 6–10 themselves: none planned yet.

## Questions for the owner

1. **Convert on kill** (proposed), or convert a living enemy once it drops
   low?
2. **How long Hollows last** and **how many at once** (proposed 12 s, 3)?
3. **His story:** friend from the start, or does he start out working for
   Null (or against Dex and Juno) and switch sides at Level 10?
4. **Levels 6–10:** keep the story doc's "Exchange" chapter, or a new zone
   built around him?
