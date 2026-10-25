// CHROMATIC DECAY — Raze's Story: his own lines for Levels 1–5
//
// The levels are the same for everyone; only the talking changes. Raze can't
// rescue himself or pull his own memories out of the walls, so his runs have
// their own reasons (owner's direction):
//   · Retraining. Years in a cage left him slow; Null sends him back down.
//   · Taking back his tricks. The Chromatics drained him for years and kept
//     copies of how he hunts (the greens' flanking is his). Each floor holds
//     some of it: clearing a floor gives the trick back (his card).
//   · His own hunt: something called him down the night he was taken, and it
//     sounded like a friend. Each level turns up a little more of it; at the
//     end he knows it was never in the Basement.
// Nobody wants to be on the line for him, because they're a bit afraid of
// him, so it rotates: Dex (lost a coin toss), Juno, Dex, Juno, then both at
// once for his room. The kids are loud and funny; Raze is baffled by them,
// jumpy in ways he won't explain (lifts, queues, small rooms), and warms up
// slowly: "kid" until the very end, when he uses their names.
//
// RAZE_OPS: who's on the line for him, by level. RAZE_BEATS: per level, one
// entry per beat (same order as the level's beats in level.js) with the
// fields that replace the standard lines. POST_RESCUE_L5: Level 5 for Dex and
// Juno once Raze is free (the cage is empty; he heckles from the line).
// RAZE_SCENES: his scenes before and after levels, by level (game.js plays
// them like story.js's INTROS / OUTROS). RAZE_OUTCOMES: his results lines.

const D = (face, text) => ({ who: 'dex',  face, text });
const J = (face, text) => ({ who: 'juno', face, text });
const R = (face, text) => ({ who: 'raze', face, text });
const N = text => ({ who: 'null', text });

export const RAZE_OPS = { 1: 'dex', 2: 'juno', 3: 'dex', 4: 'juno', 5: 'juno' };

export const RAZE_BEATS = {
  // Server Floor: Dex on the line. The servers logged the night he was taken.
  1: [
    { lines: [D('neutral', "Server Floor. These racks logged everything that happened down here. Including the night they took you."),
              R('stern', 'Then I want to read it. Clear the room.'),
              D('shocked', "Hey, that's my line. I do the 'clear the room' line.")],
      done: [D('cocky-grin', 'Okay. That was very efficient.'), R('neutral', 'That was slow.')] },
    { lines: [D('neutral', 'The servers need power. Three relays still hold charge: get close and pull it into your rifle.'),
              D('worried', 'Anything touching a relay drains it, so keep them off.')],
      firstCharge: [D('shocked', "It's coming through gold. The charge is matching your signal."), R('uneasy', '...It used to do that. I forgot.')],
      eachDone: [
        [D('determined', "One. You're glowing a bit. Is that normal?"), R('stern', 'Yes.')],
        [D('laughing', 'Two. You hum when you charge. Did you know you hum?'), R('angry', 'I do not hum.')],
        [D('neutral', "That's all three. Whatever was in them is in you now."), R('neutral', 'Good. It was mine first.')],
      ] },
    { lines: [D('worried', 'That woke the rest of them up. Yellows in the mix.'), R('smirk', 'Good. I was getting bored.')],
      done: [D('neutral', "That's the last of them. Now the servers.")] },
    { lines: [D('determined', "Four servers, one near each corner. Shoot each one to wake it. I've marked them."),
              D('worried', "It's drawing a swarm. You don't have to fight them all."),
              R('stern', 'I know how swarms work, kid. Half of them learned it from me.')],
      eachDone: [
        [D('determined', 'One.')],
        [R('uneasy', "Two. There. That's the night. Something called me down here.")],
        [D('worried', 'Three. Called you? Who?'), R('stern', 'Wake the last one.')],
      ],
      done: [D('shocked', "That's all four. It's a signal, calling your name. Over and over."),
             R('snarl', "It sounded like a friend. I'm going to find out whose voice it was. Then I'm going to put it out."),
             D('worried', "...Okay. Back to the door. I'll pull you out.")] },
    { extract: [D('cocky-grin', 'Got you. Coming home.'), R('neutral', "Don't call it home. It's weird.")] },
  ],

  // Cold Storage: Juno on the line. Recordings of him, frozen into the floor.
  2: [
    { lines: [J('neutral', "Cold Storage. I'm on the line this time. Dex says he needs a lie-down."),
              R('stern', 'He talked for an hour straight.'),
              J('smirk', "That's him calm. The whole floor's iced over, so you'll slide. Clear the aisles.")],
      done: [J('alarmed', 'Clear. Hang on, your signal just spiked...')] },
    { lines: [J('soft-smile', 'Your dash throws a net now. You go one way, the net flies back the other. Shoot anything it catches.'),
              J('focused', "Three drives are frozen into the floor. Recordings of you, hunting. They've been training on them."),
              R('smirk', "Then they've been studying the best. I'll take those back.")],
      eachDone: [[J('focused', 'One drive.')], [R('stern', 'Two. I used to be faster than this.')]],
      objective: s => `Take back the frozen drives (${s.drives}/3)` ,
      done: [J('alarmed', "That's all three."),
             R('uneasy', "I watched one. The night they took me. I walked right in. Like I was answering a call.")] },
    { lines: [J('concerned', 'They heard the ice crack. Here they come.'),
              J('smirk', 'Tip: dash through a hit just as it lands. A perfect dash, and it comes straight back.'),
              R('stern', 'I know. I invented it.')],
      done: [J('soft-smile', "That's the last of them. Now the lift.")] },
    { lines: [J('focused', "The lift's frozen solid, and those three coolant tanks are why. Bullets won't touch that ice."),
              J('neutral', 'Net a tank, then shoot: the round follows the net in and cracks it. Twice each.')],
      done: [J('alarmed', "That's it, the lift's moving! Get on.")] },
    { extract: [J('soft-smile', 'Hold on. Going down.'), R('uneasy', '...I hate lifts.')] },
  ],

  // The Stacks: Dex again (Juno "has a thing"). A tape of his own voice.
  3: [
    { lines: [D('neutral', 'The Stacks. Every stream nobody ever played ended up here, on tape.'),
              R('stern', 'And somewhere in it, a copy of how I set a snare. Clear the floor.')],
      done: [D('cocky-grin', "Clear. Hold on, something's coming through on your end.")] },
    { lines: [D('laughing', "A snare. Throw it over anything: the first ones across it are stuck."),
              R('smirk', 'I know what a snare is, kid.'),
              D('determined', "There's a recording of you in that terminal. Stand in its ring while it pulls. Anything stuck in a snare doesn't count.")],
      half: [D('determined', 'Halfway. Keep them out.')],
      objective: s => (s.blocked ? `Clear the ring to keep pulling (${s.hold}%)` : `Pull the recording (${s.hold}%)`),
      done: [D('shocked', "Got it. It's you, on a radio: 'I'm coming down. Keep the line open.'"),
             R('uneasy', "I said that to whoever called me. I don't remember who.")] },
    { lines: [D('worried', 'Something heard that. Here they come.')],
      done: [D('neutral', 'Clear. Now the vault in the middle.')] },
    { lines: [D('neutral', 'The vault only opens to light. Bounce the beam from that wall emitter into it.'),
              D('determined', 'The mirrors are sealed in. Throw a snare over the wall to turn one.')],
      eachDone: [[D('determined', 'One mirror.')], [R('smirk', 'Two. This is a puzzle for children.')]],
      done: [D('shocked', "It's open. Wait... something's coming up out of it.")] },
    { lines: [D('shocked', "That's not a Chromatic. That's all of them. Every stream nobody played."),
              R('uneasy', "A queue. Why is it always a queue down here?"),
              D('determined', 'Those rings it sends out: dash straight through them.')],
      split: [D('worried', "It's splitting! Snare the pack and pick them off.")],
      done: [D('laughing', "It's breaking up... it's gone!"), D('determined', "The vault's open. Get in, I'll pull you out.")] },
    { extract: [D('cocky-grin', 'Got you.'), R('neutral', '...Thanks for the toaster story.')] },
  ],

  // Wire Room: Juno. The greens' flanking is his; the last recordings.
  4: [
    { lines: [J('focused', "The Wire Room. The Basement's old switchboard. And greens."),
              R('stern', "The way they jump ahead of you? That's mine. They learned it from me. Clear the board.")],
      done: [J('alarmed', "Clear. Huh. Your rifle's pulling something off the board...")] },
    { lines: [J('soft-smile', 'Your rounds punch through cable now. Straight through one bundle.'),
              J('focused', "Six junction boxes hold the last recordings of you. I've marked them."),
              J('neutral', "They're shielded. Plain fire glances off. Shoot through a cable bundle into each one.")],
      eachDone: [[J('focused', 'One.')], [R('uneasy', 'Two. The same voice again. It knows my name.')], [J('focused', 'Three. Halfway.')],
                 [R('stern', "Four. It's not one of these. It learned to talk.")], [J('focused', 'Five. One more.')]],
      objective: s => `Take back the recordings (${s.pieces}/6)`,
      done: [J('alarmed', "That's all six."), R('neutral', 'Good. Nobody hunts with my tricks but me.')] },
    { lines: [J('concerned', 'They felt that. Greens and yellows, coming in.')],
      done: [J('soft-smile', 'Clear. Now the door.')] },
    { lines: [J('focused', "The door's locked to a frequency. Match the three dials to the big display."),
              J('neutral', 'Shoot through a cable into a dial to turn it.')] },
    { lines: [J('alarmed', "It's open! Wait... the board's overloading. The floor cables just went live!"),
              J('alarmed', 'RUN! Down the corridor to the far door. Dash straight through the live wires!'),
              R('angry', 'I just got OUT of a basement!')] },
    { extract: [J('laughing', 'Got you! That was way too close.'), R('laughing', "...Ha. That was fun. Don't tell Null I said that.")] },
  ],

  // His room: Juno and Dex both on the line. The hoard is growing back on
  // the core where they kept him.
  5: [
    { lines: [J('alarmed', "The core. Something's growing on it. Right where the cage was."),
              R('stern', "The hoard, trying to put itself back together. Clear the room."),
              D('cocky-grin', "He said my line. I'm letting him have it.")],
      done: [J('focused', 'Clear.'), R('neutral', '...Something just came back to me.')] },
    { lines: [J('soft-smile', 'Your rifle can hold a laser round now. One shot, straight through everything in its way.'),
              J('focused', 'Four anchors are feeding the hoard. Plain fire glances off them.'),
              D('determined', 'Line two up and one laser fills a light on both. Two lights each.')],
      eachDone: [[D('cocky-grin', 'One!')], [J('focused', 'Two.')], [R('smirk', 'Three. Keep up.')]],
      objective: s => `Hit each anchor with 2 Laser Rounds (${s.anchors}/4 broken)`,
      done: [J('alarmed', "That's the last anchor. Something's coming up through the floor..."), R('snarl', 'Hello again.')] },
    { lines: [D('worried', "It's back. It leaves a turret every time it jumps, and it can't be hurt while any are up."),
              J('focused', 'Take them all out and their light comes back at it. That stuns it.'),
              R('stern', "And dash through its bursts. I had years to watch it.")],
      phase: [[R('angry', 'Calling for help. Still a coward.')], [D('worried', "It's calling more!"), R('snarl', "Let it. I'm not in a cage this time.")]],
      done: [R('neutral', '...There. Now it stays dead.')] },
  ],
};

// Level 5 for Dex and Juno once Raze is free: the cage is empty, the hoard is
// growing back on the core, and Raze is on the line now, heckling.
// op: the operator ('dex' or 'juno'); agent: who's in.
export function POST_RESCUE_L5(op, agent) {
  const L = (face, text) => ({ who: op, face, text });
  const f = (dexFace, junoFace) => (op === 'dex' ? dexFace : junoFace);
  const dex = agent === 'dex';
  return [
    { lines: [L(f('worried', 'concerned'), "Raze's room. The cage is empty now... but something's growing on the core."),
              R('stern', "The hoard, putting itself back together. I'm on the line too. Don't embarrass me."),
              L(f('angry', 'annoyed'), 'Great. Two voices in your ear. Clear the room.')],
      done: [L(f('cocky-grin', 'smirk'), 'Clear.'), R('smirk', 'Not bad. For a kid.')] },
    { lines: [L(f('laughing', 'soft-smile'), dex ? "Your emitter's holding a charge you can dump all at once. One big electric blast, point blank." : "Your coil can run unstable now. For a few seconds, whatever you hit starts to decay."),
              L(f('determined', 'focused'), 'Four anchors are feeding the hoard. Plain fire glances off them.'),
              L(f('neutral', 'focused'), dex ? 'Each one takes two blasts. Get close and let it go.' : 'Go unstable and pour it into one until its lights fill. Two lights each.')],
      done: [L(f('shocked', 'alarmed'), "That's the last anchor. Something's coming up through the floor..."),
             R('snarl', "It's back. Kill it again. Slower this time.")] },
    { done: [R('neutral', '...Good. Stay dead.')] },
  ];
}

// Merge a level's overrides into its beats (only the fields given change)
export function applyLines(beats, overrides) {
  (overrides || []).forEach((o, i) => { if (o && beats[i]) Object.assign(beats[i], o); });
  return beats;
}

// ── Scenes ────────────────────────────────────────────────────
// Portraits: Raze on the right, whoever's on the line on the left
export const RAZE_SIDES = { raze: 'right', dex: 'left', juno: 'left', null: 'left' };

// Before Level 1 as Raze: why he's going back down, and who drew the short straw
const RAZE_FLOOR_INTRO = [
  { caption: 'A WEEK AFTER THE BASEMENT  ·  ONE RADIO CHANNEL' },
  N("You're going back down."),
  R('stern', 'I just got out.'),
  N("Your hands shake on the reload. You flinch every time a lift moves. You're not ready, and you know it."),
  R('angry', 'I was hunting these things before you knew what to call them.'),
  N('And they learned from you. Every trick they drained out of you, they kept a copy of.'),
  R('uneasy', "...The greens. The way they flank. That's mine."),
  N('The Basement is still full of what they copied. Take it back. One floor at a time.'),
  R('smirk', "Retraining. You're sending me back to school."),
  N("I'm sending you hunting. With someone on the line."),
  R('stern', 'I work alone.'),
  N('Not anymore.'),
  D('worried', '...So who is on the line?'),
  J('smirk', 'We flipped a coin.'),
  D('shocked', 'It had two heads, Juno. I checked.'),
  R('snarl', "Kid. Talk while I'm aiming and I'll come back up there."),
  D('cocky-grin', 'Cool. Cool cool cool. Love the energy.'),
  { card: 'SERVER FLOOR' },
];

// Before Level 3 as Raze: the lift down, Dex talking, the toaster
const RAZE_STACKS_INTRO = [
  { caption: 'THE LIFT DOWN  ·  ONE RADIO CHANNEL' },
  D('neutral', "Juno has 'a thing'. So it's me again."),
  R('stern', 'Lucky me.'),
  D('cocky-grin', 'You want to hear about our first Chromatic? Great story.'),
  R('uneasy', "No. Is the lift slowing down? It feels like it's slowing down."),
  D('laughing', 'Behind a laundromat, the week the colour went. I hit it with a toaster.'),
  R('shocked', '...A toaster.'),
  D('cocky-grin', 'A bit of green came off it and lit up the laundromat sign. First lit window on the block.'),
  R('laughing', 'Ha! The end of the world, and you kids fought it with kitchenware.'),
  D('shocked', 'Was that a laugh? Juno! He laughed!'),
  R('snarl', 'Tell anyone and I will... the lift stopped. Why did the lift stop.'),
  D('neutral', "Because we're there. You're fine. Go."),
  { card: 'THE STACKS' },
];

// Before Level 4 as Raze: Juno, the scoreboard, and noodles
const RAZE_WIRE_INTRO = [
  { caption: 'BEFORE THE WIRE ROOM  ·  ONE RADIO CHANNEL' },
  J('focused', "My turn again. Dex is 'resting his voice'."),
  R('smirk', 'Small mercies.'),
  J('smirk', 'He wants to know what you count The Queue as. One, or forty.'),
  R('neutral', 'You two keep score?'),
  J('soft-smile', 'Every night, for ten years. Whoever loses buys the noodles.'),
  R('shocked', '...There are noodles?'),
  J('laughing', "There's a place on Fourth. Still lit."),
  R('uneasy', 'Put me down for four hundred. And noodles.'),
  J('smirk', "That's not how the scoreboard works."),
  R('smirk', 'It is now.'),
  { card: 'WIRE ROOM' },
];

// Before Level 5 as Raze: back to the room they kept him in
const RAZE_ROOM_INTRO = [
  { caption: 'THE LAST DOOR  ·  ONE RADIO CHANNEL' },
  N("The hoard is growing back. On the core. Where they kept you."),
  R('stern', 'I know where they kept me.'),
  N("You don't have to be the one who goes in."),
  R('snarl', 'Yes. I do.'),
  D('neutral', "We're both on the line this time."),
  J('soft-smile', 'Nobody flipped a coin.'),
  R('uneasy', '...Fine. Keep the channel open.'),
  D('cocky-grin', 'Never closed it.'),
  { card: "RAZE'S ROOM" },
];

// After Level 5 as Raze: the quiet, the noodles, and where the voice is
const RAZE_ROOM_OUTRO = [
  { caption: "THE CORE  ·  WHAT'S LEFT OF THE HOARD" },
  R('uneasy', "It's quiet. I used to dream about it being quiet."),
  J('soft-smile', 'You did good.'),
  D('cocky-grin', "You did GREAT. Top of the scoreboard. I'm putting you down for four hundred."),
  R('laughing', 'And noodles.'),
  D('laughing', 'And noodles.'),
  N('Raze. The voice that called you down that night.'),
  R('stern', "It was never down here. Whatever it is, it's up top. Somewhere with signal."),
  N('Then we find it.'),
  R('smirk', 'We. Listen to him.'),
  R('neutral', '...Dex. Juno. Keep the channel open.'),
  J('soft-smile', 'Always.'),
  D('shocked', 'He said our names. Juno. He said our NAMES.'),
  { card: 'THE BASEMENT IS QUIET' },
];

// By level: scenes before (intro) and after (outro) Raze's runs
export const RAZE_SCENES = {
  intro: { 1: RAZE_FLOOR_INTRO, 3: RAZE_STACKS_INTRO, 4: RAZE_WIRE_INTRO, 5: RAZE_ROOM_INTRO },
  outro: { 5: RAZE_ROOM_OUTRO },
};

// The results screen's line for Raze's runs, by level
export const RAZE_OUTCOMES = {
  1: 'Something called him down the night he was taken. It sounded like a friend.',
  2: 'His frozen recordings taken back. He walked in like he was answering a call.',
  3: "A tape of his own voice, and The Queue broken. 'I'm coming down. Keep the line open.'",
  4: 'Every recording taken back. Nobody hunts with his tricks but him.',
  5: "The hoard is gone for good. Whatever called him down is up top, somewhere with signal.",
};
