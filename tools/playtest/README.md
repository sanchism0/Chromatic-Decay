# Headless playtests

Playwright scripts that drive the real game in Chromium, take screenshots and
print what happened. They are how every change in this repo has been checked
before merging. There is no unit-test suite; these are the tests.

## Running

```bash
# 1. Serve the repo (from the repo root). Restart it if a script can't connect.
python3 -m http.server 8766 --bind 127.0.0.1 &

# 2. Run a script. The first argument is where screenshots go.
node tools/playtest/level1.js /tmp/out desk dex     # desk | phone | land,  dex | juno
node tools/playtest/storyflow.js /tmp/out            # add "phone" for a phone viewport
node tools/playtest/level2.js /tmp/out desk dex     # desk | phone | land,  dex | juno
node tools/playtest/level3.js /tmp/out desk juno    # same args
node tools/playtest/boards.js /tmp/out desk          # desk | phone; add "offline" to cut the database
node tools/playtest/lunge.js /tmp/out
node tools/playtest/pierce.js /tmp/out
node tools/playtest/settings.js /tmp/out desk      # desk | phone
node tools/playtest/green.js /tmp/out
node tools/playtest/comms.js /tmp/out desk          # desk | phone | land
```

Each script ends with `no errors` or `ERRORS …` (page errors and console errors).
Look at the screenshots too: most bugs found here were layout overlaps that only
showed up in a picture.

## How they work

- `game.js` is served through a route that appends `window.__ev = s => eval(s);`,
  so a script can read and set anything inside the game module, for example
  `ev('state')`, `ev('level.beat.type')`, `ev('player.hp = 100')`. This only
  happens inside the test, never in the shipped file.
- Clicks need a held press (mouse down, ~90 ms, up). A plain `mouse.click` is
  too quick for the game's one-frame click detection.
- A player name must exist, or Arcade and Story stop at the name screen:
  scripts call `ev("setPlayerName('TEST')")` right after loading.
- `boards.js` fakes the Supabase REST API (scores, players, counts, CORS) in the
  page, because the sandbox usually can't reach supabase.co.
- `level1.js` keeps the player's health topped up during the busy last section
  (enemies keep coming there by design).

| Script | Covers |
|---|---|
| `level1.js` | Story map → character select → Level 1 start to finish: waves, relays (drain + charge), power-ups, the four servers, extraction beam-out, card unlock, results, a death and restart |
| `level2.js` | Level 2: the cold map, the start kit, the dash ability screen, Shock Dash stun/jam or Parting Charge damage, ice sliding, drives, bullets vs dash on the tanks, the lift, card saved |
| `storyflow.js` | Prologue: intro scene, pick, tutorial steps, end card |
| `boards.js` | Name entry, Arcade run posting, rank and personal best, player sync, cycling all six boards (arrows, keys, swipe) |
| `lunge.js` | Yellow lunge: windup, hit, sidestep miss, stun cancels |
| `pierce.js` | Piercing rounds hit each enemy once |
| `green.js` | Green blink: reforms ahead of a running player, can't be hit while faded, fires its volley, holds still and keeps shooting when you stand near it, six greens land spread out, stun cancels a blink |
| `level3.js` | Level 3: stacks map, the thrown ability (grenade stuns / beacon lures), the terminal hold blocked until the ring is cleared, mirrors turned by thrown abilities, The Queue (ring damage, dash through, splits, time to kill), vault exit, card |
| `arc.js` | Arc Round: only the last round of a Dex burst is electric; it jumps to an enemy within range, not one further away |
| `grenadeaim.js` | Touch grenade: a tap throws nothing; press and drag shows the landing ring; letting go throws it there. Prints the phone zoom |
| `comms.js` | Comms box just below the middle on desktop, at the top on phones; no shooting while a line is up; the game freezes with enemies around; Space moves the line on without dashing |
| `settings.js` | Settings: every switch, changing the name (and cancelling), dev panel only with `?dev` |
