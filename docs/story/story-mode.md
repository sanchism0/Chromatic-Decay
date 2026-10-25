# Story Mode

The **Prologue** (`src/story.js`) and **Level 1** (`src/level.js`) are built;
later levels are planned. Tone and writing rules are below. Read them before
writing any line.

## The cast

| | Role | Voice |
|---|---|---|
| **Dex** | Hits it until it works. Magnetron rig, electric "pew". | Loud, cocky, warm underneath. Keeps score. |
| **Juno** | Reads the signal first. Antenna coil, glass "ping". | Dry, precise, teases him back. Notices everything. |
| **Null** | The white, faceless leader. Shown only as white light. | Few words. Never explains more than he has to. |
| **Raze** | The marksman. Long gold coat, mechanical arm, long rifle. | Sharp, menacing, a bit unhinged; dark humour; threatens first. Portraits: neutral, stern, smirk, laughing, uneasy, shocked, angry, snarl |

Dex and Juno used to run districts side by side. Three years ago Juno asked
for her own district; they still share one radio channel and compare kill
counts every night. Partners, rivals, something more: it's left open, and
the story leans on it.

**Raze** is the man everyone is trying to reach (owner's definition, Oct 25,
2026): an OG who was fighting the Chromatics long before Dex and Juno, a famous
marksman (long rifle, powerful shots, long range, a hunter, tricky, gets out of
anything) and **Null's oldest partner**, so Null's bond with Dex and Juno is
relatively new. The Chromatics took him alive and have kept him in the
Basement for years, draining his memories into the hoard; it's left him a bit
crazy. He threatens people, especially early on, and Dex and Juno are a little
afraid of him. The Basement arc (Levels 1–5) is the mission to rescue him; he
becomes playable (gold, `#FFD23F`, never orange) after Level 5. **He's a person, not an Echo.** **Sable** (a server load balancer) is kept for a possible fourth
character.

## Writing rules (from the owner's feedback)

- **Tone:** mysterious, a bit dark, optimistic. Pace like Mega Man Legends.
- **Banter like Legolas and Gimli:** friendly rivalry, keeping score, with a
  subtle flirt ("coworkers who aren't allowed to date"). Keep it light.
- **They're civilians, not soldiers.** Techy and good with their emitters. No
  sectors, ranks, call signs or military jargon.
- **Say the mission in the dialogue.** Every level opens with why they're there
  and closes with what they got. No on-screen mission banners.
- **Few, short lines.** One or two lines per section. Cut asides. Players
  shouldn't have to click through screens.
- **Never talk over a fight.** Briefings hold enemies back; follow-ups wait for
  the event they describe.
- **Echoes aren't people.** Call them Echoes.
- **Write every line twice:** once for Dex on comms, once for Juno, using their
  expression names (`dialogue.js` `SPEAKERS`).
- **Desktop and phone wording differ.** "Press Q" vs "Tap AUTO", never both.

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
   calling a name, *Raze*: the best shot Null ever knew, taken years ago. "I need one of
   you to go in, and the other to stay on the line to keep them alive." They
   argue. "You've had this argument for three years. Settle it."
3. **Who goes in?** The character select picks the agent.
4. **Tutorial.** The real game, no waves, and the agent can't die. The operator
   talks them through:
   walk → dash → fire the emitter → auto-fire → a violet → colour comes back
   to you → two yellows (they lunge) → rescue an Echo → "Raze is deeper in.
   That's who we came for."
5. **Prologue complete** → Arcade or Title.

One press (Space, click, tap) moves to the next line. Skip any scene with Esc or the SKIP button. Finishing it sets
`chromatic_decay_prologue_done` in localStorage, for later unlocks.

## Level 1: "Server Floor" (built)

| Beat | Comms (gist) | Play |
|---|---|---|
| Wave | Raze's signal went dark here; the servers logged everything. Clear the Chromatics first. | 3 groups of violets, a yellow |
| Relays | The servers need power. Pull the charge out of three relays; keep them off. | Stand near relays; up to 4 violets drain them. "It's coming through green/pink": the power takes your colour |
| Wave | That woke the rest of them up. Yellows in the mix. | Violets and yellows |
| Servers | Four servers hold Raze's logs. Shoot each to wake it. A swarm is coming; you don't have to fight them all. | Shoot 4 marked racks near the corners; up to 10 enemies roam |
| Exit | That's all four; there's his trace: Raze went down, to Cold Storage. Get back to the door. "Got you. Coming home." | Walk to the door → beam-out → card unlock → results |

Section power-ups (Level 1 only) and the kept card are in `docs/decisions.md`.

## Level 2: "Cold Storage" (built)

| Beat | Comms (gist) | Play |
|---|---|---|
| Wave | Raze's trace led down here, where they froze the old data. The whole floor's iced over. Clear the aisles. "Your signal just spiked..." | Violets, then yellows, down long aisles. Then the dash ability screen |
| Drives | Your dash crackles now (Dex) / leaves a charge (Juno). Raze's trace is split across three drives frozen into the floor. | Grab three drives, sliding on the ice while up to 4 enemies interrupt. Ends: Raze went down, to The Stacks |
| Wave | They heard the ice crack. | Yellows in the aisles |
| Tanks | The lift's frozen; three coolant tanks are why. Bullets won't touch the ice: dash through it (Dex) / dash away from it (Juno). | Two dash-ability hits per tank; a few violets get in the way |
| Exit | "The lift's moving! Get on." / "Hold on. Going down." | Ride the lift: beam-out, card (first time), results |

## Level 3: "The Stacks" (built)

**Before it, a scene on the lift down** (`STACKS_INTRO` in `story.js`, plays
after the character pick, skippable): the agent in the lift, the operator on
the line. Ten years of this; their first Chromatic behind the laundromat (Dex
hit it with a toaster, a bit of green went into the laundromat sign, the first
lit window on the block); why they fight: every Chromatic unravelled gives a
little colour back, the only reason their districts are lit, and the
Chromatics keep taking whatever stops broadcasting. Ends on the flirt (Juno:
"I care about the scoreboard" / Dex: "I'm louder about it when it's you").

| Beat | Comms (gist) | Play |
|---|---|---|
| Wave | Every stream nobody ever played ended up here, on tape. Raze left part of his signal in this. "Hold on, I'm sending you something." | Big violet groups. Then the thrown ability screen |
| Hold | A stun grenade (Dex) / a decoy beacon (Juno). There's something of Raze's in that terminal: stand in its ring while it pulls. Keep everything else out. | 22 s in the ring; Chromatics in it pause the pull. Ends: "It's a memory. His. I can hear him in it." |
| Wave | Something heard that. | Violets and yellows |
| Beam | The vault only opens to light. Throw your grenade/beacon over the pocket walls to turn the mirrors. | Three mirrors; the beam reaches the vault: "Something's coming up out of it." |
| Boss | "That's not a Chromatic. That's all of them." Dash through the rings. "It's splitting!" | The Queue. "It's gone. The vault's open. Get in." |
| Exit | "Got you. And one of his memories with you." | Into the vault: beam-out, card, results |

## Level 4: "Wire Room" (built)

**Before it, a scene** (`WIRE_INTRO` in `story.js`): scoreboard banter (was The
Queue one kill or forty?) until **Null cuts in**. What they pulled from the
Stacks was one of Raze's memories; the Chromatics have been taking him apart
for years, one memory at a time, feeding the hoard. The rest are locked in the
Wire Room's switchboard. If they just go get him, they'll find "a light that
answers to his name and doesn't know it". Why him? "Because he remembers the
Collapse from the inside."

| Beat | Comms (gist) | Play |
|---|---|---|
| Wave | The Basement's old switchboard, where they locked up what they took from Raze. Greens: they show up where you're going. | Violets and greens. Then Arc Round / Ricochet |
| Gather | Six junction boxes have Raze's memories in them; they're shielded: arc into them (Dex) / bounce shots into them (Juno). | Six boxes, then walk over each memory. Ends: "Everything they took from him." |
| Wave | They felt that. | Greens and yellows |
| Tuning | His door's locked to a frequency: match the dials to the display. | Three dials |
| Escape | "The board's overloading. The floor cables just went live! RUN!" | 22 s, four live wires (dash through), alarm, red edge |
| Exit | "Got you! That was way too close." | Through the far door: card, results |

## Level 5: "Raze's Room" (built)

**Before it** (`INTROS.raze` in `story.js`): Null on what to expect. He and Raze
go back to the first night; Dex and Juno have known Null a few years. "He'll
threaten you. Let him." "Don't turn your back on him. Not yet."

| Beat | Comms (gist) | Play |
|---|---|---|
| Wave | "That's him. On the core." Raze: "Another one of Null's errand kids. Stay out of my sightline." | All three types. Then Arc Discharge / Spin Up (F) |
| Anchors | Four anchors feed his cage; plain fire glances off; use the F ability. Raze heckles ("Left one next. Are you blind?") | Up to 5 enemies |
| Boss | The Signal Hoarder: "the thing that's been eating me". Turrets shield it; dash through its bursts; it calls swarms ("Coward.") | Checkpoint. Its death ends the level |

**After it** (`OUTROS.raze`): Raze points his rifle at the agent, insults
their emitter, jokes about having had "a lot of time to practice my aim". Then
Null: "You took your time." / "I thought you were gone." / "I WAS gone." Raze
remembers Null owes him; Null needs what he remembers of the Collapse. "Your
kids can carry my bags." Card: RAZE IS OUT.

**Once Raze is free** (Level 5 cleared by anyone), Level 5 changes for
everyone: the cage is empty and the hoard is knotting itself back together on
the core. Dex and Juno get no Null warning before it and no meeting after; Raze
is on the line now, heckling ("Don't embarrass me", "Kill it again. Slower
this time"). Results: "The Signal Hoarder is down again."

## Raze's Story (built)

Same levels, same tasks; only the talking changes (`src/razestory.js`). He
can't rescue himself or pull his own memories out of the walls, so his runs
have their own reasons:

- **Retraining.** Null sends him back down: his hands shake on the reload, he
  flinches at lifts.
- **Taking back his tricks.** The Chromatics drained him for years and kept
  copies of how he hunts (the greens' flanking is his). Each floor holds some:
  the frozen drives and junction boxes are *recordings* of him, not memories.
  Clearing a floor gives a trick back: that's his card.
- **His own hunt.** Something called him down the night he was taken, and it
  sounded like a friend. Each level turns up a little more; at the end he knows
  it was never in the Basement: "it's up top. Somewhere with signal."

**Who's on the line rotates**, because nobody wants the job (they're a bit
afraid of him): Level 1 Dex (lost a coin toss with two heads), 2 Juno (Dex
"needs a lie-down"), 3 Dex (Juno "has a thing"), 4 Juno (Dex is "resting his
voice"), 5 both, unasked. The kids are loud and funny; Raze is baffled by them
and jumpy in ways he won't explain (lifts, queues, small rooms). He warms up
slowly: "kid" until the last scene, when he uses their names.

| Level | Scene before | Comms (gist) |
|---|---|---|
| 1 Server Floor | Null sends him back down; Dex drew the short straw ("Talk while I'm aiming and I'll come back up there") | The servers logged the night he was taken: a signal calling his name. "It sounded like a friend." Dex: "That's my line!" |
| 2 Cold Storage | none | Recordings of him, frozen into the floor; "I walked right in. Like I was answering a call." Perfect-dash tip: "I invented it." "...I hate lifts." |
| 3 The Stacks | The lift down: the toaster story, and Raze laughs ("you kids fought it with kitchenware") | A tape of his own voice: "I'm coming down. Keep the line open." "Why is it always a queue down here?" "Thanks for the toaster story." |
| 4 Wire Room | Juno, the scoreboard and noodles ("Put me down for four hundred. And noodles.") | The greens' flank is his. The same voice in every recording. "I just got OUT of a basement!" "That was fun. Don't tell Null." |
| 5 Raze's Room | Back to where they kept him; both kids on the line ("Nobody flipped a coin") | The hoard growing on the core; "I'm not in a cage this time." After: the quiet, noodles, the voice is up top, "Dex. Juno. Keep the channel open." |

Results lines are his own too (`RAZE_OUTCOMES`).

## Later (planned)

| # | Level | Story beat |
|---|---|---|
| 2 | Cold Storage | Raze's trail goes colder. Dash abilities, ice, frozen drives and tanks (built) |
| 3 | The Stacks | Thrown abilities, terminal hold, mirror beam, first boss The Queue (built) |
| 4 | Wire Room | Greens arrive in force; gather fragments; tuning puzzle |
| 5 | Raze's Room | Boss: Signal Hoarder. Rescue Raze; he becomes playable |

The gameplay plan for each is in `docs/design/core-loop.md`.

## Possible chapters after the Basement

Each chapter is one zone with a short intro on the radio, a level with scripted
objectives (not endless waves), a set-piece encounter, and a short outro.

1. **The Basement** (Levels 1–5 above).
2. **The Exchange.** An old trading floor. Orange broadcasters. A
   survive-the-timer objective. (Sable, a load balancer, is a candidate for
   character 4 later.)
3. **The Feed.** A dead social network. Lumen. Stealth, sightlines, staying
   unseen.
4. **The Grid.** The power district. Cord. Traps and switches; route the power.
5. **The Hall of Cats.** Voss. A lighter chapter, with an escort.
6. **Null.** What he actually is, and why he only ever appears as white light.
   The ending turns on who's been in the field and who's been on the phone.

Threads to pay off along the way:
- What called Raze down the night he was taken, in a friend's voice. It's up
  top, somewhere with signal (Raze's Level 5 ending).
- Why Juno left the partnership.
- What Null wants with Echoes that still remember themselves.
- The operator getting cut off, with one level played without the voice in your ear.

## Arcade experiments (parked)

Arcade stays the test bed. Ideas the owner liked:
- **Map secrets** that unlock things: hidden rooms behind racks, a dead
  terminal that takes a code, an Echo that only appears if you stand still
  in the dark.
- Unlocks: shot colours, emitter skins, lore entries, a story-mode bonus scene.
