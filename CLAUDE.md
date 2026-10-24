# Chromatic Decay: start here

A top-down light-and-ghosts shooter in vanilla JS + HTML5 Canvas. No build step,
no framework, no npm dependencies: open `index.html` and it runs.

- **Live game:** https://sanchism0.github.io/Chromatic-Decay/ (GitHub Pages, serves `main`)
- **Repo:** `sanchism0/Chromatic-Decay`
- **Leaderboards:** Supabase project `kzjvbygxtnyedrfeqmmt` (tables `scores`, `players`)

Read these before changing anything:

| Doc | What's in it |
|---|---|
| `docs/decisions.md` | **What the owner likes and dislikes, and why things are the way they are.** The most important doc here. |
| `docs/roadmap.md` | Where things stand, known issues, and the recommended next steps |
| `docs/architecture.md` | How the code fits together, file by file, and the systems inside |
| `docs/design/core-loop.md` | Game design: Story unlocks Arcade, Chroma, characters, levels, leaderboards |
| `docs/design/character-skeleton.md` | Draft: character 4, the white skeleton who converts enemies (unlocked at Level 10) |
| `docs/story/story-mode.md` | Story, characters, tone, prologue and level plan |
| `tools/playtest/README.md` | How to test (headless Playwright scripts) |
| `chromatic-decay-gdd.md` | The original planning doc. **Mostly out of date**; see its banner |

## The game in one paragraph

Ten years after the Collapse, colour only exists where something still
broadcasts; the Chromatics (ghosts of stolen light) took the rest. **Dex** (toxic
lime) and **Juno** (lilac/pink) are civilian techs who fight them with
hand-built Pulse Emitters that fire coherent light. **Null**, a faceless white
light, sends them into the Basement to rescue **Raze**, an Echo that still knows
who he is. In **Story Mode** one character goes in (the agent) and the other
talks them through it on comms (the operator). Clearing levels banks **Chroma**
and earns **Story cards**. **Arcade Mode** is a 15-wave survival run where
those earned cards join the upgrade deck. Six online leaderboards track Arcade
scores, Story progress and lifetime Chroma.

## How to work with the owner

- **Don't merge, or open PRs, until the owner says so.** They say "merge",
  "merge it" or "merge everything". Everything else is build, test, push to the
  branch, update the test build, report.
- **Test before reporting.** Run the relevant playtest scripts and look at the
  screenshots. Say plainly what you checked and what you couldn't check.
- **Show, don't describe.** After a change, update the test build (below) so the
  owner can try it on their phone. They test on desktop *and* phone, portrait and
  landscape.
- **Keep replies short and concrete.** Lead with what changed and what to try.
  The owner isn't a programmer: give click-by-click steps for anything outside
  the game (Supabase, GitHub settings).
- **The owner thinks out loud.** A message that brainstorms ("I'm just thinking
  out loud", "don't take any of these actions") wants ideas and a
  recommendation, not code. A message that ends a question ("…is that right?")
  wants an answer, not a change.
- **Mid-turn messages are normal.** They often arrive while you're working; fold
  them in.
- When the owner says something feels wrong ("it's like impossible", "that is
  bullshit"), it's a firm rule from then on. Record it in `docs/decisions.md`.

## Git and release workflow

Work on the branch you're given (historically `claude/learning-scroll-app-qc27g7`).
When the owner says merge:

1. `git fetch origin main`. If the last PR from your branch was already merged,
   restart the branch from main (`git checkout -B <branch> origin/main`, keeping
   any unmerged commits) and push with `--force-with-lease`.
2. Commit with a clear message ending in the attribution trailers the session
   gives you. **Never put a model name or ID in commits, PRs or code.**
3. Push, open a PR into `main` with the GitHub MCP tools, and merge it (pass the
   full 40-character head SHA). PR bodies: Summary + Testing sections.
4. GitHub Pages picks up `main` within a minute or two.
5. If you have the claude.ai artifact tool, republish the preview copies (see
   below).

### claude.ai previews (optional, if you have the Artifact tool)

Two artifacts mirror the game for quick phone testing. The page file is the
repo's `index.html`; pass changed source files in the publish's `files` map
(`{"src/game.js": "src/game.js", …}`):

- **Main copy:** https://claude.ai/artifact/RiHVqjedEYdX1MkRwNuNs5 (republish after a merge)
- **Test build:** https://claude.ai/artifact/6yjUiWyz4NKLKD9gNAzVAZ (publish unmerged work here)

If a publish is refused because a file "is not what you last saw", check its
hash against the previous `main` (`git show <sha>:src/x.js | sha256sum`), read
it with the artifact read action, then publish again.

**claude.ai artifacts can't reach Supabase.** Scores there say "saved on this
device". Real leaderboard testing happens on the GitHub Pages site.

## Testing

```bash
python3 -m http.server 8766 --bind 127.0.0.1 &
node tools/playtest/level1.js /tmp/out desk dex
```

See `tools/playtest/README.md`. Also run `node --input-type=module --check < src/<file>.js`
on edited files: plain `node --check` doesn't catch every module syntax error.
After a large edit of `game.js`, compare its function list with the last commit:
an over-wide cut once deleted seven unrelated functions.

## Rules that have bitten before

- **No flashing.** No blinking, strobing or white-flash effects anywhere, ever.
- **No toy-like sounds** (springs, boings). Electric, glassy, lightning-like.
- **E and F do nothing when their slot is empty.** Never fall back to another action.
- **Light is smooth; people and objects are pixel art.** Glows and ghosts are
  soft and additive; characters, racks, floor and Echoes are crisp pixel art
  drawn 1 art pixel = 1 screen pixel.
- **Desktop and phone get their own wording.** Never "Press E (or tap the button
  on a phone)". Check `'ontouchstart' in window` and say one or the other.
- **Don't add on-screen banners for story.** The comms dialogue carries the story.
- **Level 1 must not be annoying.** If a section is frustrating, cap the enemies.
- **New sound effects connect to `_sfxBus()`** in `audio.js` so the Settings switch mutes them.
- **Developer tuning is hidden:** open the game with `?dev`, then Settings → DEVELOPER TUNING.
