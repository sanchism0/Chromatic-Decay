# CHROMATIC DECAY — Game Design Document
*Version 3.0 — Planning Phase*

---

## 1. Game Overview

**Title:** Chromatic Decay
**Genre:** Top-down arcade shooter, roguelike progression
**Style:** 8-bit pixel art with signal/frequency visual language
**Mode:** Single-player, near-endless survival with hi-score leaderboard
**Platform Target:** Browser (HTML5 Canvas), hosted via GitHub Pages

**Elevator Pitch:**
You are Null — a network maintenance technician who survived the Collapse by accident. Armed with a Pulse Emitter he built himself, he moves through the dead zones of a world dissolved by signal saturation, fighting corrupted data constructs and rescuing fragmented minds before they're consumed. Every run ends. Every run tells more of the story. Every Fragment found permanently changes what the next run inherits.

**Level Structure:** The game is built zone by zone. Level 1 — The Basement — is the complete first experience. Future levels add new environments and mechanics while the same character, Archive, and save data carry through.

---

## 2. World & Lore

### The Collapse
In 2187, Earth's electromagnetic spectrum collapsed — not from war, but from signal saturation. Humanity had pumped so much wireless data into the atmosphere that reality's underlying color frequencies destabilized. Physics held. Perception didn't. The world became a gray void where nothing has form unless it's broadcasting a signal.

### The Chromatics
Corrupted data constructs that absorbed the lost frequencies. Each one is a stolen wavelength — not evil exactly, but hungry. They consume what remains of human consciousness to sustain their signal. They are identified and categorized by color, which corresponds to the frequency band they absorbed.

### The Player — NULL

Not a soldier. Not a chosen one. A network maintenance technician who happened to be in a Faraday-shielded server basement doing routine cable work when the Collapse happened. The shielding kept him analog. Three days later he came up expecting rescue. The gray was already everywhere.

Null isn't special. He's stubborn. He keeps going back into the decay because someone has to, and because every Echo he pulls back is someone who had a life before the signal ate it. He doesn't talk much. The **Pulse Emitter** wasn't issued to him — he built it himself from decommissioned hardware in that basement. It fires coherent light, the only thing that disrupts Chromatic frequency locks.

Each run represents Null pushing deeper into the decay. Runs end. He resets. But the Fragments he's rescued stay rescued — their signal permanently woven into the Pulse Emitter. The next run inherits everything the last one earned.

### The Echoes
Fragments of human and digital consciousness still broadcasting faintly — trapped in signal loops, slowly being consumed. Most Echoes are anonymous and provide an **Adrenaline Spike** on rescue (partial HP restore). But rare Echoes are **Warden Fragments** — named constructs with identity, skill, and history. Rescuing a Fragment permanently expands what future Wardens can become.

---

## 3. The Warden Archive — Meta-Progression System

### How It Works
Five **Warden Fragments** exist in the game — one per class. All five are distributed across Level 1. They don't gate behind later levels — the full Archive is earnable from the very first zone. Later levels carry the same save data forward.

- Every run, all five Fragments are guaranteed to spawn somewhere on the Level 1 map
- Each Fragment spawns in a different location each run — randomized within the furthest third of the map
- They never spawn near standard Echo pickups or each other
- A faint signal pulse marks their location — subtle, visible only when the screen isn't chaotic
- Chromatics don't target Fragments but will be in the way
- **You will find at most one Fragment per run** — push deep, find one, the run continues

**First time a Fragment is rescued:**
- A unique lore blurb fires at the bottom of the screen
- That class's full trait tree is **permanently unlocked** for all future runs
- The Fragment is logged in the Archive (accessible from the main menu)
- Stored in localStorage — persists across sessions, survives browser close

**All subsequent runs:**
- Previously found Fragments' trait trees are available in the upgrade pool
- Already-found Fragments still spawn on the map as standard Echo heals
- Players who've found all five have the full game — carries into every future level

### New Player Arc
- **Run 1** — Base upgrades only. Map feels large and slightly threatening. Finding a Fragment is a genuine discovery moment.
- **Runs 2–5** — Each run adds a tree. Build variety grows noticeably.
- **Run 6+** — Full Archive unlocked. Every run from here is a complete roguelike experience. Level 2 opens.
- **Level 2+** — New zones, new enemies, new hazards. Same Null, same Archive, same Pulse Emitter.

### The Five Warden Fragments

| Fragment | Class | Who They Were | Discovery Blurb |
|---|---|---|---|
| **Sable** | Warden | A server farm's load balancer. Spent its entire existence making sure nothing collapsed under pressure. | *"Ran 847 servers without a single outage. Now it's keeping you alive. Same job really."* |
| **Raze** | Breaker | A decommissioned trading algorithm. Made billions in microseconds until regulators pulled the plug. | *"Caused three flash crashes before breakfast. You're in good hands."* |
| **Lumen** | Ghost | A VPN service. Professionally invisible. Routed around every obstacle ever placed in front of it. | *"Helped 40 million people disappear online. Happy to return the favor."* |
| **Cord** | Weaver | A smart home hub. Knew every device, every schedule, every pattern in the house. Controlled all of it quietly. | *"Used to turn the lights off when you left a room. Now it does that to enemies."* |
| **Voss** | Herald | A social media recommendation engine. Its entire purpose was making other things go viral. | *"Spent six years making cats famous. Pivoting to combat felt natural."* |

---

## 4. Core Mechanics

### Movement
- Top-down, 8-directional movement via WASD
- Player sprite always faces the mouse cursor — aim and movement are independent
- Move speed reduces by 30% while firing (configurable in Admin Panel as `player_fire_slow_multiplier`)
- This creates real class feel: Ghost hates standing still to shoot, Warden barely notices the slow

### Shooting
- **PC:** Hold SPACE to fire. Mouse cursor determines aim direction. WASD moves independently.
- Player can strafe, circle-strafe, and move in any direction while aiming anywhere
- Projectiles fire from player toward cursor position continuously while SPACE is held
- Releasing SPACE stops firing and restores full move speed instantly
- Base damage is a flat value applied against enemy base HP
- Traits modify damage multiplier, fire rate, projectile count, spread, and behavior

### Controls Summary — PC
| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Aim |
| Hold SPACE | Fire Pulse Emitter |
| ESC | Pause |
| Mouse click (upgrade screen) | Select trait card |

### Map
- Tiled arena — bounded, not infinite
- Large enough that Fragments won't be stumbled into accidentally
- Obstacles provide cover and create chokepoints — ruins of gray infrastructure
- Echoes and Fragments pulse with faint light — visible but not intrusive
- Layout varies between runs

### Death & Run End
- Player HP reaches zero → run ends
- Frequency Score calculated
- Player enters 3 initials for leaderboard
- Archive updated if new Fragment was found
- Option to start new run immediately

---

## 5. Stat Architecture

All balance lives here. Every value below is exposed in the Admin Config Panel (Section 12).

### Player Base Stats
| Stat | Description | Default Value |
|---|---|---|
| `player_base_hp` | Starting health pool | 100 |
| `player_base_damage` | Damage per projectile | 10 |
| `player_base_fire_rate` | Shots per second | 2 |
| `player_move_speed` | Units per second (full) | 4 |
| `player_fire_slow_multiplier` | Speed multiplier while firing | 0.7 |
| `player_projectile_speed` | Projectile travel speed | 8 |

### Enemy Base Stats (per type)
Each enemy has:
- `base_hp` — raw health pool relative to player base damage
- `move_speed` — units per second
- `aggro_range` — distance at which enemy notices player (0 = passive)
- `projectile_damage` — damage per enemy shot (0 = non-shooter)
- `projectile_fire_rate` — shots per second (0 = non-shooter)
- `residual_drop` — Residuals dropped on death
- `spawn_weight` — relative probability in the spawn pool

### Scaling Formula
```
scaled_hp = base_hp * (1 + (elapsed_minutes * hp_scale_per_minute))
spawn_interval = max(min_spawn_interval, base_spawn_interval - (elapsed_minutes * spawn_acceleration))
```
All coefficients configurable in Admin Panel.

---

## 6. Enemy Roster — The Chromatics

### VIOLET — *The Wanderers*
- **Lore:** Youngest Chromatics. Freshly formed, still organizing signal. Probably someone's Spotify playlist that never got played.
- **Behavior:** Passive. Wanders randomly. Does not notice the player.
- `base_hp`: 30 | `move_speed`: 1.5 | `aggro_range`: 0 | `projectile_damage`: 0 | `residual_drop`: 5
- `spawn_weight`: High early, fades as later types appear

### BLUE — *The Curious*
- **Lore:** Coherent enough to develop awareness. Absorbed communications infrastructure. Drifts toward you like it's trying to get a signal.
- **Behavior:** Notices player at medium range. Drifts slowly toward them. No attack.
- `base_hp`: 50 | `move_speed`: 2 | `aggro_range`: 150px | `projectile_damage`: 0 | `residual_drop`: 8

### GREEN — *The Hunters*
- **Lore:** Fed enough to develop predatory instinct. Absorbed biological and agricultural networks. They know what a living thing looks like.
- **Behavior:** Actively chases player. Appears in loose groups.
- `base_hp`: 60 | `move_speed`: 3 | `aggro_range`: 200px | `projectile_damage`: 0 | `residual_drop`: 12

### ORANGE — *The Broadcasters*
- **Lore:** Absorbed media, advertising, propaganda loops. Learned to weaponize signal. Of course they did.
- **Behavior:** Shoots short-range bursts at player. Moderate aggro. Not fast.
- `base_hp`: 70 | `move_speed`: 2 | `aggro_range`: 180px | `projectile_damage`: 15 | `projectile_fire_rate`: 1 | `residual_drop`: 18

### RED — *The Architects* (Boss Tier)
- **Lore:** Ancient Chromatics. Absorbed city-scale networks — power grids, emergency services, air traffic control. They think they're still running critical infrastructure.
- **Behavior:** Slow, massive HP, fires sustained beams. Spawns solo first, occasionally pairs late game. Creates spatial pressure rather than chasing.
- `base_hp`: 500 | `move_speed`: 1 | `aggro_range`: 300px | `projectile_damage`: 25 | `projectile_fire_rate`: 0.5 | `residual_drop`: 60
- Hard cap on simultaneous Reds (starts at 1)

### Population Mix Over Time
| Time Range | Violet | Blue | Green | Orange | Red |
|---|---|---|---|---|---|
| 0–2 min | 100% | 0% | 0% | 0% | 0% |
| 2–5 min | 60% | 40% | 0% | 0% | 0% |
| 5–9 min | 30% | 35% | 35% | 0% | 0% |
| 9–14 min | 15% | 25% | 35% | 25% | 0% |
| 14–20 min | 10% | 15% | 30% | 40% | 5% |
| 20+ min | 5% | 10% | 25% | 50% | 10% |

*All percentages configurable in Admin Panel.*

---

## 7. Residuals & Upgrade System

### Residuals
Fragments of reclaimed frequency data shed by disrupted Chromatics. Physical pickups that spawn at enemy death location. Player moves over them to collect (small magnetic pull radius). Threshold cost increases with each upgrade taken.

### Upgrade Prompt
At each threshold, player is presented with **3 randomized trait cards**. Choose one. Game pauses during selection. Cards are weighted based on which class trees are unlocked and which traits have already been taken.

### Base Upgrade Pool (Always Available)
Available from run one, before any Fragments are found.

| Trait | Effect |
|---|---|
| *Pulse Amplifier* | Increase base damage |
| *Rapid Cycle* | Increase fire rate |
| *Signal Boost* | Increase move speed |
| *Frequency Shield* | Increase max HP |
| *Multicast* | Fire an additional projectile (slight spread) |
| *Extended Range* | Increase projectile travel distance |
| *Residual Attractor* | Increase pickup radius |
| *Overcharge Cell* | Increase projectile speed |

---

## 8. The Five Classes & Full Trait Lists

Class is never chosen directly. Trait selections accumulate and the system determines archetype after 4+ class-specific traits are taken. Character visuals shift to reflect the emerging class.

---

### CLASS 1 — WARDEN
**Unlocked by:** Rescuing Sable
**Question it answers:** How long can you hold the line?
**Identity:** Sustain, protection, Echo synergy. Gets stronger the more punishment it absorbs.
**Visual:** White/silver luminescence. Shield aura grows more visible as HP stays high.
**Playstyle:** Slow and deliberate. Hold zones. Let enemies come to you.

| Trait | Effect | Lore Blurb |
|---|---|---|
| *Signal Barrier* | Absorbing damage builds a shield that reflects a portion back | *"Sable ran redundant systems. You do too now."* |
| *Resonant Recovery* | Echo rescues heal over time instead of instantly, but heal for more total | *"Distributed recovery. More efficient that way."* |
| *Anchor Pulse* | Standing still for 2s creates a damage-reducing field around you | *"Load balancers don't move. They absorb."* |
| *Last Frequency* | Below 20% HP, all damage taken is halved | *"Sable's last failsafe. Still works."* |
| *Uptime Protocol* | Killing an enemy while shield is active refreshes a portion of the shield | *"99.9% uptime wasn't luck. It was design."* |
| *Redundant Systems* | Gain a second HP bar that regenerates slowly after 8s without damage | *"Always had a backup. Always."* |
| *Capacity Surge* | Max HP increases each time you rescue an Echo | *"More users. More load. Scale accordingly."* |
| *Distributed Defense* | Damage taken is reduced for 3s after any kill | *"Traffic spike handled. Back to normal operations."* |
| *Cold Reboot* | Once per run, automatically revive at 25% HP on death | *"Sable rebooted 1,200 times. One more isn't a problem."* |
| *Fortress Mode* | Significantly reduced move speed but massively increased damage reduction (toggle) | *"Full defensive posture. Not going anywhere."* |

---

### CLASS 2 — BREAKER
**Unlocked by:** Rescuing Raze
**Question it answers:** How much damage can you deal before everything falls apart?
**Identity:** Burst offense, kill-chaining, explosive reactions. Fragile but devastating.
**Visual:** Cracking orange fracture lines across sprite, intensify after kills.
**Playstyle:** Always slightly out of control. Lean into it.

| Trait | Effect | Lore Blurb |
|---|---|---|
| *Cascade Protocol* | Killing an enemy within 2s of another triggers a chain pulse AoE | *"Raze called these 'acceptable market corrections.'"* |
| *Overclock* | Fire rate doubles for 4s after taking damage. Cooldown applies. | *"High risk tolerance. It's a feature."* |
| *Frequency Shatter* | Enemies below 25% HP explode on death, damaging nearby enemies | *"Liquidation event. Everything must go."* |
| *Volatile Signal* | Projectile damage increases the longer it travels before hitting | *"Momentum-based pricing. Classic Raze."* |
| *Flash Crash* | Every 10th shot deals 5x damage | *"Once a decade. Completely unpredictable. Catastrophic."* |
| *Margin Call* | Killing 5 enemies in 6s grants a brief period of invincibility | *"Raze always knew when to go all in."* |
| *Leveraged Position* | Damage dealt increases as your HP decreases | *"Raze operated best under pressure. Familiar?"* |
| *Short Squeeze* | Enemies that survive a hit move slower for 3s | *"Trap set. Exit blocked. Classic play."* |
| *Algorithmic Aggression* | Each consecutive kill without taking damage increases damage by 5%, stacks to 50% | *"Compounding returns. Raze's favorite thing."* |
| *Circuit Breaker* | Once per run, all enemies on screen are stunned for 3s | *"The regulators always hated this one."* |

---

### CLASS 3 — GHOST
**Unlocked by:** Rescuing Lumen
**Question it answers:** Can they even catch you?
**Identity:** Mobility, evasion, damage tied to movement. Position is the weapon.
**Visual:** Partially translucent sprite, violet shimmer, afterimage trail at speed.
**Playstyle:** Always moving. Standing still feels wrong and mechanically is wrong.

| Trait | Effect | Lore Blurb |
|---|---|---|
| *Kinetic Pulse* | Damage scales with how fast you're moving when you fire | *"Lumen never sent data at rest. Neither should you."* |
| *Phase Step* | Short invincibility dash on cooldown | *"Rerouting. Please hold."* |
| *Slip Signal* | Taking damage grants a burst of move speed for 3s | *"Lumen's response to throttling: go faster."* |
| *Afterimage* | Moving fast periodically leaves a decoy that draws enemy aggro briefly | *"40 million users thought they knew where Lumen was. None of them did."* |
| *Zero Footprint* | Standing still makes you invisible to non-shooting enemies after 2s | *"No logs. No trace. No presence."* |
| *Tunneling* | Passing through enemy projectiles has a chance to phase them harmlessly | *"Lumen routed through some sketchy infrastructure. It learned to slip through."* |
| *Encrypted Movement* | Every 5s of continuous movement grants a stacking damage bonus | *"Sustained throughput. That's where Lumen shined."* |
| *Exit Node* | After rescuing an Echo, instantly dash to a random safe map location | *"Always had an exit strategy."* |
| *Dark Routing* | Briefly become untargetable after each kill | *"You were never here."* |
| *Bandwidth Burst* | Activate for 6s of massively increased speed and fire rate. Long cooldown. | *"Full pipe, no throttle. Lumen only did this in emergencies."* |

---

### CLASS 4 — WEAVER
**Unlocked by:** Rescuing Cord
**Question it answers:** What if the battlefield worked for you?
**Identity:** Map control, traps, area denial. Reshape engagements before they happen.
**Visual:** Deep teal/cyan tones, geometric patterns appear on the ground around player.
**Playstyle:** Cerebral and reactive. You're setting up kills before they happen.

| Trait | Effect | Lore Blurb |
|---|---|---|
| *Signal Snare* | Place slow-field traps on the map. Limited charges, recharge over time. | *"Cord had a geofence for every room. Same principle."* |
| *Dead Zone* | Mark a map area — enemies entering take passive damage | *"Do Not Disturb. Cord took that setting seriously."* |
| *Frequency Web* | Projectiles leave a brief damaging trail on the ground | *"Cord wired every corner of the house. Force of habit."* |
| *Echo Anchor* | Rescued Echoes leave a temporary protective field where they were found | *"Cord marked every safe space. Old instinct."* |
| *Automation Routine* | After standing still for 3s, turret-mode fires automatically in all directions | *"Cord ran on schedules. 7am: lights on. 7:05am: enemies dead."* |
| *Motion Detection* | Enemies entering screen edge are briefly highlighted and slowed | *"Cord knew when anyone walked into any room. Every room."* |
| *Overclocked Thermostat* | Leave a heat zone trail that damages enemies walking through it | *"Someone cranked the heat up. Cord didn't appreciate that."* |
| *Network Sweep* | Periodic pulse damages all enemies in a large radius. Scales with active traps. | *"Cord ran diagnostics every hour. This is the armed version."* |
| *Smart Perimeter* | Traps automatically reposition toward highest enemy density | *"Adaptive automation. Cord was always learning the household."* |
| *Full Lockdown* | Freeze all non-Red enemies in place for 4s. Long cooldown. | *"Cord once locked a family out of their own house for a firmware update. Ruthless."* |

---

### CLASS 5 — HERALD
**Unlocked by:** Rescuing Voss
**Question it answers:** What if you weren't fighting alone?
**Identity:** Companion summons, Echo weaponization, indirect damage. You're a hub.
**Visual:** Warm gold tones, orbiting Echo fragments visually circle the player.
**Playstyle:** Managing companions and positioning them is the skill expression.

| Trait | Effect | Lore Blurb |
|---|---|---|
| *Echo Guard* | Rescued Echoes briefly orbit you as a damage-absorbing shield before departing | *"Voss always had an audience. Now they're useful."* |
| *Signal Remnant* | Killed enemies have a small chance to leave a temporary ally | *"Voss could make anything go viral. Even loyalty."* |
| *Resonant Lure* | Summon a decoy signal that draws enemies toward it for a few seconds | *"Clickbait. Voss invented clickbait. This is just the combat version."* |
| *Frequency Choir* | Each active companion slightly increases your fire rate | *"Engagement metrics. More followers, more reach."* |
| *Viral Cascade* | Companions explode for AoE damage when they expire | *"Voss believed every post should end with impact."* |
| *Sponsored Content* | Companions periodically drop Residuals while active | *"Monetization. Voss never missed an opportunity."* |
| *Algorithm Boost* | Rescuing an Echo has a chance to immediately summon a companion | *"Voss always knew how to amplify a moment."* |
| *Cross-Platform Push* | Active companions increase your projectile count by 1 each (max +3) | *"Syndication deal. Content everywhere."* |
| *Engagement Loop* | Killing an enemy near a companion resets that companion's timer | *"Keep them engaged. Retention was everything to Voss."* |
| *Going Viral* | Spawn 5 companions simultaneously. Massive cooldown. | *"One post. Eleven million impressions overnight. Voss called it Tuesday."* |

---

## 9. Subclass System

When trait selections split roughly evenly between two archetypes, the system assigns a subclass. Named identity only — slightly weights future upgrade offerings toward both parent classes.

| Subclass | Between | Identity | Visual |
|---|---|---|---|
| **BULWARK** | Warden + Breaker | Absorbs punishment and converts it to burst. The tank who hits back. | Silver with orange fracture lines |
| **PHANTOM** | Breaker + Ghost | All-in on aggression and speed. Hits hard, moves faster after each kill. | Orange glow with violet transparency |
| **DRIFTER** | Ghost + Weaver | Leaves chaos behind as they move. Traps and trails follow their path. | Translucent with teal geometric ground marks |
| **ARCHITECT** | Weaver + Herald | Controls the map and fills it with allies. Rarely shoots directly. | Teal/cyan with gold companion orbits |
| **SENTINEL** | Herald + Warden | Sustains through companions and Echo healing. Outlasts through attrition. | Gold tones with silver luminescence |

---

## 10. Echo / Healing System

- Standard Echoes spawn at timed intervals in random map locations
- They pulse faintly — visible but not intrusive
- Player walks over Echo to rescue (1–2 second channel, interruptible)
- Rescue triggers **Adrenaline Spike**: restores a portion of HP
- If a Chromatic reaches an Echo first, Echo is consumed — Chromatic gains a brief speed boost
- Warden Fragment Echoes behave identically but trigger the Archive unlock on rescue
- Some traits modify Echo interactions (faster rescue, area heal, companion spawn, etc.)

---

## 11. Lore Feed System

### Design Principles
- Short blurbs only. Max 2 lines. No paragraphs.
- Displayed at bottom of screen, subtitle style
- Fade in 0.3s → hold 3–4s → fade out 0.5s
- Never interrupts gameplay
- Triggers on **first encounter only** per run
- Player can toggle **On/Off** in settings (default: On)

### Trigger Events & Sample Blurbs

| Trigger | Blurb |
|---|---|
| First Violet encountered | *"Violet. Youngest signal. Probably a streaming queue that never got played."* |
| First Blue notices player | *"It turned toward you. Curious. Your Wi-Fi router used to do that."* |
| First Green chases player | *"Green knows prey. It absorbed everything that ever ran a supply chain."* |
| First Orange shot fired | *"It broadcast at you. Learned that from about forty billion ad impressions."* |
| First Red spawns | *"One Red. Used to keep the lights on for a whole city. Now it just wants yours out."* |
| First Echo rescued | *"A fragment of something. You pulled it back. It won't last but it helped."* |
| First Echo consumed | *"Too slow. It finished the feed. You'll be faster next time."* |
| First upgrade taken | *"The emitter found a new resonance. You feel it in your hands."* |
| Sable found | *"Ran 847 servers without a single outage. Now it's keeping you alive. Same job really."* |
| Raze found | *"Caused three flash crashes before breakfast. You're in good hands."* |
| Lumen found | *"Helped 40 million people disappear online. Happy to return the favor."* |
| Cord found | *"Used to turn the lights off when you left a room. Now it does that to enemies."* |
| Voss found | *"Spent six years making cats famous. Pivoting to combat felt natural."* |
| Class emergence — Warden | *"You keep standing between things. Sable would approve."* |
| Class emergence — Breaker | *"Everything at once. Raze would call this efficient."* |
| Class emergence — Ghost | *"You were never here. Lumen taught you well."* |
| Class emergence — Weaver | *"The map is a system. Cord always said that."* |
| Class emergence — Herald | *"You're not alone out there. Voss knew that was the whole point."* |
| Subclass — Bulwark | *"You hit back. Every time. That's not strategy, that's personality."* |
| Subclass — Phantom | *"Fast and lethal. The Chromatics haven't figured out which direction to run yet."* |
| Subclass — Drifter | *"You leave a mess wherever you go. Somehow it's working."* |
| Subclass — Architect | *"The map is yours. The enemies just don't know it yet."* |
| Subclass — Sentinel | *"You and everything around you. Outlast them all."* |
| Player near death | *"Signal coherence critical. You're starting to dissolve."* |
| 10-minute survival | *"Ten minutes. Most Wardens don't make it this far."* |
| 20-minute survival | *"Twenty minutes. There are maybe three recorded instances of this."* |
| All 5 Fragments found (lifetime) | *"You found all of them. The Archive is complete. Now survive anyway."* |

---

## 12. Admin Config Panel Spec

Separate password-protected browser panel at `/admin`. Exposes all tunable values without touching code.

### What's Tunable

**Player Stats** — Base HP, Damage, Fire Rate, Move Speed, Projectile Speed

**Per-Enemy Stats** (one row per type) — Base HP, Move Speed, Aggro Range, Projectile Damage, Fire Rate, Residual Drop, Spawn Weight

**Scaling Coefficients** — HP scale per minute, Spawn acceleration, Min spawn interval, Max simultaneous Reds

**Population Mix Table** — Editable percentage weights per time bracket per enemy type

**Upgrade System** — Residuals required per upgrade threshold, Skill weights per class

**Echo System** — Spawn interval, HP restored per rescue, Channel time

**Archive System** — Toggle Fragment spawns on/off (for testing), Fragment spawn zone radius

**Lore Feed** — Toggle lore globally (for testing), Blurb hold duration

### Panel Requirements
- Changes apply immediately to a test session
- Export config as JSON
- Import config from JSON
- Reset to defaults button
- Plain-language label per value

---

## 13. Visual Direction

### Aesthetic Philosophy

Chromatic Decay runs on a strict visual hierarchy: **the world is dark, the enemies are vivid, the player is light.** Everything else serves that rule.

The map is near-black — a cold digital void with barely-visible tile structure. Enemies are the only saturated color in the world. They are impossible to miss, immediately readable, and visually threatening. The player is pure white — not colorful, but luminous. You find yourself the same way you find a flashlight in a dark room. As your class emerges, a near-white pastel tint bleeds into your glow — never saturated enough to compete with enemies, always distinct enough to read.

This hierarchy exists for gameplay clarity first, lore second. But the lore holds: Chromatics are stolen frequencies, vivid and corrupted. The Signal Warden is analog — coherent white light, the one thing that doesn't belong to the spectrum.

No anti-aliasing. No gradients on solid objects. Glow effects are the exception — they should feel like light leaking from a screen, not decoration.

---

### Color Palette — Full Spec

Three-tier hierarchy: dark world, vivid enemies, light player. Every hex value serves one of those three roles.

#### World & Environment
| Element | Hex | Notes |
|---|---|---|
| Map background | `#0D0E12` | Near-black with a cold blue undertone — space, void, deep digital dark |
| Map tile (base) | `#13151C` | Slightly lighter than background — subtle tile grid visibility |
| Map tile (alt) | `#181A23` | Checkerboard partner — almost invisible, just enough to feel like structure |
| Obstacle fill | `#1E2130` | Cold dark slate — infrastructure ruins feel heavy and permanent |
| Obstacle edge | `#2A2E42` | Slightly lighter edge — gives obstacles dimensionality without gradients |
| Signal noise overlay | `#FFFFFF` at 2% opacity | Subtle static texture pass over the whole map — feels like a dying screen |

#### Player Character
Player is always pure white — the brightest, most readable object on screen. Class colors are near-white pastels that tint the glow only. Never saturated. Never competing with enemies.

| State | Hex | Notes |
|---|---|---|
| Base fill | `#FFFFFF` | Pure white — coherent light in a corrupted world |
| Outline | `#E8F0FF` | Barely-there cool white edge |
| No class (early run) | `#FFFFFF` glow | White shadowBlur only — no tint yet |
| Warden emergence | `#eafae4` glow | Mint white — cool, protective, barely a color |
| Breaker emergence | `#fff5c2` glow | Pale yellow — warm white, energy building |
| Ghost emergence | `#ffe0f0` glow + 65% opacity | Blush white — partially transparent, hard to pin down |
| Weaver emergence | `#d6faf7` glow | Pale cyan — cool, technical, geometric marks on ground |
| Herald emergence | `#fddede` glow | Soft blush — warm white, companions orbit in same tint |

#### Chromatic Enemies
Enemies own the vivid saturated colors. All five pop hard against the near-black map. Color + shape = instant threat read. No enemy color appears anywhere on the player.

| Enemy | Primary Hex | Edge Hex | Shape | Notes |
|---|---|---|---|---|
| Violet | `#5200ff` | `#7B4FFF` | Octagon | Electric purple — corrupted system memory, barely formed |
| Yellow | `#e9ff6a` | `#f5ffaa` | Circle | Acid yellow — drifting, curious, impossible to miss |
| Green | `#8dff6a` | `#c0ffaa` | Triangle | Lime — biological networks gone predatory, vivid and aggressive |
| Orange | `#fd6c1d` | `#FF9A5C` | Diamond (rotated) | Hot broadcast orange — loud, weaponized signal |
| Pink | `#f81d78` | `#ff6aaa` | Heavy square | Hot pink boss — large, slow, unmistakable threat tier |

#### Projectiles
| Source | Hex | Notes |
|---|---|---|
| Pulse Emitter (player) | `#FFFFFF` | Pure white — matches player, coherent and clean |
| Pulse Emitter trail | `#E8F0FF` at 40% opacity | Faint cool-white fade behind each shot |
| Orange enemy shot | `#fd6c1d` | Matches enemy color exactly |
| Pink boss beam | `#f81d78` with `#ff6aaa` core | Two-tone beam — bright edge, hot core |
| Yellow enemy pulse | `#e9ff6a` | Short range burst, matches enemy |
| Green enemy projectile (future) | `#8dff6a` | If Hunters gain ranged attack in later update |

#### UI & HUD
| Element | Hex | Notes |
|---|---|---|
| HUD background bar | `#0D0E12` at 80% opacity | Same as map bg — HUD doesn't interrupt the world |
| HP bar fill | `#8dff6a` → `#fd6c1d` → `#f81d78` | Lime full, orange mid, pink critical — uses enemy colors as danger language |
| HP bar background | `#1E2130` | Same as obstacle fill — consistent dark language |
| Residual counter | `#B8882A` | Aged gold — Residuals feel valuable, not gamey |
| Score text | `#8A8E99` | Same as player base — muted, readable, not distracting |
| Lore blurb text | `#C4C8D4` | Slightly brighter than UI text — readable but not glaring |
| Lore blurb background | `#0D0E12` at 70% opacity | Barely-there pill behind subtitle text |

#### Echoes & Fragments
| Element | Hex | Notes |
|---|---|---|
| Standard Echo pulse | `#C4C8D4` at 60% → 0% | Cool silver pulse animation — faint, human |
| Fragment Echo pulse | `#E8F4FF` at 80% → 0% | Brighter than standard — worth investigating |
| Residual orb | `#B8882A` with `#E8C86A` core | Gold with bright center — dropped by enemies, collectable |
| Adrenaline Spike flash | `#C45A1A` bloom | Brief warm flash on rescue — biological, urgent |

---

### Code-Drawn Graphics Spec

No sprites required to ship. All visuals are Canvas-drawn geometric primitives with particle systems. This is a design choice, not a limitation — the grayscale world with vivid Chromatics reads as intentional and cohesive.

#### Player Shape
- Base: 14x14px square, slightly rounded corners (rx 2px)
- Direction indicator: small 4px triangle on the facing edge
- Fill: `#FFFFFF` — pure white, always
- Outline: 1.5px stroke in class emergence color (white `#FFFFFF` before class emerges)
- Class glow: `shadowBlur: 14`, `shadowColor` = near-white pastel of current class
- Ghost class only: `globalAlpha: 0.65` — player is partially transparent

#### Enemy Shapes — Distinct per Type
Each enemy has a unique silhouette so color + shape = instant read.

| Enemy | Color | Shape | Size | Notes |
|---|---|---|---|---|
| Violet | `#5200ff` | Soft octagon | 10px radius | Youngest — rounded, barely formed |
| Yellow | `#e9ff6a` | Circle | 11px radius | Smooth, drifting, no hard edges |
| Green | `#8dff6a` | Jagged triangle | 13px | Aggressive geometry — points outward |
| Orange | `#fd6c1d` | Diamond (rotated sq) | 12x12px | Broadcasting shape — signal icon energy |
| Pink | `#f81d78` | Heavy square | 22x22px | Boss weight — twice the size of others, unmissable |

#### Particle Systems
| Effect | Description |
|---|---|
| Enemy death | 6–8 small squares explode outward, fade to Residual gold, 0.4s duration |
| Residual collect | Brief golden ring expand from player position, 0.2s |
| Player hit | 4 white sparks outward, 0.3s — reads as pain without screen shake |
| Pulse Emitter shot | Small white square projectile, 3px, leaves 3-frame white trail |
| Class emergence | Expanding ring in class color, 1.2s, fills screen edge |
| Echo rescue | Upward-drifting white particles, 0.8s — feels like something departing |
| Adrenaline Spike | Warm orange pulse ring from player, 0.5s |
| Fragment discovery | Sustained golden particle burst, 1.5s — distinct from everything else |

#### Map Construction
- Tile size: 32x32px
- Map size: 1920x1920px (60x60 tiles) — large enough to hide Fragments
- Obstacles: rectangular dark blocks, 64–192px wide, placed to create natural corridors and chokepoints
- No decorative detail on obstacles — silhouette only
- Optional: 1px `#2A2E42` grid lines at very low opacity for tile structure feel

---

### Rendering Notes for Developer

```
// Recommended Canvas context settings
ctx.imageSmoothingEnabled = false  // crisp pixels, no anti-aliasing
ctx.globalCompositeOperation = 'source-over'  // default

// For glow effects (class aura, Fragment pulse)
ctx.shadowBlur = 12
ctx.shadowColor = '#ffe0f0'  // example: Ghost class (pastel on player)

// Enemy glow colors (vivid — match primary hex)
// Violet: #5200ff | Yellow: #e9ff6a | Green: #8dff6a | Orange: #fd6c1d | Pink boss: #f81d78

// Player class glow colors (pastel — near-white only)
// Warden: #eafae4 | Breaker: #fff5c2 | Ghost: #ffe0f0 | Weaver: #d6faf7 | Herald: #fddede

// Always reset shadowBlur to 0 after glow elements — expensive if left on

// Particle performance
// Cap total active particles at 200
// Use object pooling — pre-allocate particle array, reuse dead particles
// Reduce cap to 100 on mobile (auto-detect via screen width < 768px)
```

---

## 14. Audio Direction

- Chiptune/synthesizer score that evolves with enemy intensity
- Each Chromatic has a distinct audio signature (Violet: high/soft, Red: low/droning)
- Pulse Emitter: clean electronic crack
- Adrenaline Spike: brief analog heartbeat — intentionally different from everything else
- Fragment discovery: distinct warm tone, different from standard Echo rescue
- Lore blurb: subtle static crackle on appear
- Class emergence: short musical motif unique to each class
- Death: signal flatline

---

## 15. Leaderboard Spec

- Player enters 3 initials on run end
- **Frequency Score:**
```
frequency_score = (kills * kill_weight) + (echoes * echo_weight) + (seconds_survived * time_weight) + (upgrades * upgrade_weight) + (fragments_found * fragment_weight)
```
- All score weights configurable in Admin Panel
- Leaderboard displays: rank, initials, score, class reached, survival time, date
- Top 10 entries displayed, scrollable to top 50
- Local localStorage fallback if Supabase is unreachable
- See Section 17 for full online leaderboard implementation spec

---

## 16. Mobile Controls Spec

### Target Experience
The game must be fully playable on a phone browser with no keyboard. Share a URL — brothers open it on their phone, hit play, no install required. Controls must feel responsive and natural for an arcade shooter, not like an afterthought.

### Control Scheme — Two Finger (Primary)
Designed to mirror PC controls as closely as possible. Movement and aim are independent. Firing is intentional, not automatic.

**Left Thumb — Move**
- Virtual joystick, fixed position bottom-left
- Controls 8-directional WASD-equivalent movement
- Joystick base always visible; thumb drags from center
- Activates on any touch within the left zone — no precise tap required

**Right Thumb — Aim & Fire**
- Virtual joystick, fixed position bottom-right
- Direction of right stick = aim direction (translates mouse position to angle)
- **Firing is active while right thumb is held down** — mirrors hold SPACE on PC
- Releasing right thumb stops firing and restores full move speed
- Player sprite rotates to face right stick direction in real time

**The mechanic carries perfectly:**
- One finger = move only, full speed, no shooting
- Two fingers = move + aim + fire, 30% speed reduction while firing
- Lift right thumb = stop firing, speed restores instantly
- Natural rhythm of press/release creates same tension as PC hold SPACE

**Pause Button**
- Top-right corner, large tap target (min 44x44px)
- Opens pause menu with resume, settings, quit

**Upgrade Selection**
- Game pauses, 3 trait cards presented vertically centered
- Large full-width tap targets — no precision required
- Brief haptic feedback on selection where supported

### Fallback Scheme — Single Stick (Simpler Option)
For casual players who find two-thumb coordination difficult.

- Left joystick only — movement direction = aim direction
- Tap and hold anywhere on right half of screen to fire
- Lower skill ceiling but easier for non-gamers in the family
- Configurable in settings

### HUD Layout Adjustments for Mobile
Desktop HUD cannot be used as-is. Mobile layout requires:

| Element | Desktop Position | Mobile Position |
|---|---|---|
| HP bar | Top-left | Top-left, larger |
| Residual counter | Top-right | Top-center |
| Score | Top-center | Top-right, smaller |
| Lore blurbs | Bottom-center | Above left joystick zone |
| Pause button | N/A | Top-right, large tap target |
| Class indicator | Bottom-left | Top-left, below HP |

Joystick zones occupy the bottom 35% of the screen on each side. No game UI should overlap these zones.

### Screen & Orientation
- **Landscape orientation required** — game locks to landscape on mobile
- Prompt displayed if player opens in portrait: *"Rotate your device to play"*
- Target minimum screen width: 375px (iPhone SE baseline)
- Canvas scales to fill screen width, maintaining aspect ratio

### Performance Targets for Mobile
- 60fps on devices from 2020 or newer
- 30fps minimum acceptable on older devices
- Particle effects and visual trail density should auto-reduce if frame rate drops below 45fps
- Admin Panel toggle: `mobile_reduce_particles` (default: auto)

### Touch-Specific UX Notes
- Tap anywhere on title screen to start — no small button required
- All menus use full-width buttons, minimum 48px height
- Leaderboard initial entry uses native mobile keyboard (3-character input, auto-caps)
- No hover states — all interactive elements have active/pressed visual states instead
- Archive menu is scrollable with swipe

---

## 17. Online Leaderboard — Supabase Spec

### Why Supabase
- Free tier handles low-traffic family use comfortably (up to 500MB database, 2GB bandwidth/month)
- Hosted Postgres — no backend server to maintain
- REST API available out of the box — game calls it directly with fetch()
- No backend code to write or deploy
- If the project grows, scaling is straightforward

### Database Schema

**Table: `scores`**
| Column | Type | Description |
|---|---|---|
| `id` | uuid | Auto-generated primary key |
| `initials` | varchar(3) | Player's 3-letter entry |
| `score` | integer | Final Frequency Score |
| `class_reached` | varchar(20) | Final class or subclass name |
| `survival_seconds` | integer | Total run duration in seconds |
| `kills` | integer | Total enemies killed |
| `echoes_rescued` | integer | Total Echoes rescued |
| `fragments_found` | integer | Warden Fragments found this run |
| `upgrades_taken` | integer | Total trait cards taken |
| `created_at` | timestamp | Auto-set on insert |

### API Calls the Game Makes

**POST a score (on run end):**
```
POST https://<project>.supabase.co/rest/v1/scores
Headers: apikey, Content-Type: application/json
Body: { initials, score, class_reached, survival_seconds, kills, echoes_rescued, fragments_found, upgrades_taken }
```

**GET top 10 scores (leaderboard screen):**
```
GET https://<project>.supabase.co/rest/v1/scores?select=*&order=score.desc&limit=10
Headers: apikey
```

Both calls use the Supabase **anon public key** — safe to include in client-side JS since Row Level Security (RLS) restricts what it can do.

### Security Setup
- RLS enabled on `scores` table
- Anon key policy: INSERT allowed (anyone can post a score), SELECT allowed (anyone can read leaderboard)
- No UPDATE or DELETE via anon key — scores are permanent once posted
- No authentication required — this is intentional for frictionless family play
- Score validation: server-side check that score values are within plausible ranges (configurable max values in Admin Panel to catch obvious tampering)

### Leaderboard UI Behavior
- Loads on run end screen and on main menu leaderboard tab
- Shows loading state while fetching ("Retrieving signal records...")
- Falls back to localStorage board silently if fetch fails
- Displays: Rank / Initials / Score / Class / Time Survived / Date
- Highlight current run's entry if it makes the top 10
- Refresh button to pull latest without reloading the page

### Setup Steps (for build phase)
1. Create free Supabase project at supabase.com
2. Create `scores` table using schema above
3. Enable RLS, add anon INSERT and SELECT policies
4. Copy project URL and anon key into game config
5. Test POST and GET from browser console before wiring into game
6. Add Supabase URL and key to Admin Panel for easy rotation if needed

---

## 18. Build Order

Recommended sequence to avoid rework and keep momentum:

1. **Desktop core game** — movement, shooting, enemies, Residuals, upgrade prompt
2. **Class system** — trait cards, class emergence, visual shifts
3. **Archive system** — Fragment spawns, permanent unlocks, Archive menu
4. **Lore feed** — blurb triggers, subtitle display, on/off toggle
5. **Admin Config Panel** — expose all tunable values, JSON export/import
6. **Supabase leaderboard** — schema setup, POST on run end, GET on leaderboard screen
7. **Mobile controls** — dual stick joysticks, HUD layout adjustments, landscape lock
8. **Polish** — audio, death animations, class visual effects, performance tuning

---

## 19. Level Progression — Zone Map

The game is built level by level. Each zone has a distinct visual identity, enemy mix, and environmental character. Same character, same weapon, same Archive — new world each level. Sonic 2 structure.

| Level | Zone Name | Setting | Dominant Enemies | New Mechanic |
|---|---|---|---|---|
| **1** | **The Basement** | The server room where Null survived — half-functional, flickering, claustrophobic | Violet, Yellow | Core game. All 5 Fragments available. |
| **2** | **The Exchange** | Collapsed stock trading floor — dead screens, data ghost loops, financial system echoes | Green, Orange | Trap obstacles — live data feeds damage on contact |
| **3** | **The Grid** | City power infrastructure — transformers, blown substations, open exposed corridors | Orange, Pink boss | Environmental hazard — live charge zones on the floor |
| **4** | **The Feed** | Dead social media data center — server walls, viral content loops as hazards | All types | Echo corruption — some Echoes are traps, not heals |
| **5** | **The Void** | Deep signal space — no physical reference, pure abstraction, reality breaking down | All types, escalated | Map geometry shifts mid-run |

Archive unlocks in Level 1 carry through every subsequent level. No re-earning required.

---

## 20. Level 1 — The Basement (Full Spec)

### Story Context

This is where Null starts. He comes back here because it's the last place the world made sense — the server basement where he survived the Collapse. The building above is dead. The Chromatics found the residual signal in the servers and moved in.

Sable — the load balancer — lived in this building. It's still here somewhere in the deep racks.

**Opening lore blurb (first run only):**
*"Three days underground. You came up expecting rescue. The gray was already everywhere."*

---

### Visual Identity

**Tone:** Cold, functional, claustrophobic. A real place that existed before the Collapse — not abstract signal space yet. The world feels like it had purpose once.

**Key visual elements — all code-drawn:**

| Element | Description | Hex |
|---|---|---|
| Floor base | Standard dark tile grid | `#0D0E12` / `#13151C` |
| Server rack obstacles | Tall thin rectangles in rows — create natural corridors | `#1E2130` edge `#2A2E42` |
| Emergency floor strips | Faint red glow along map edges — the building's last power | `#3A0A0A` |
| Dead screen panels | Dark flat rectangles on obstacle faces — blank monitors | `#1A1C28` |
| Cable tray lines | Faint horizontal marks at ceiling height — infrastructure memory | `#2A2E42` at 30% opacity |
| Collapsed center | Large open area — raised floor has given way, clearing for heaviest spawns | No obstacles, wider gap |

**Atmosphere:** Cold dark center with barely-visible structure. Faint warm red at the map edges from emergency lighting. The deeper into the map, the tighter the corridors and the more visual noise. Where Sable hides feels harder to reach because it is.

---

### Map Layout

```
Size:         1920x1920px (60x60 tiles at 32px each)
Tile size:    32x32px
Density:      Medium — enough cover to use, not enough to feel safe

Layout zones:
┌─────────────────────────────────┐
│  SPAWN AREA                     │
│  Open, few obstacles            │
│  Player starts here             │
├─────────────────────────────────┤
│  MID ZONE                       │
│  Server rack rows               │
│  Corridor structure             │
│  Echo spawns between racks      │
│  Heavy enemy presence           │
├─────────────────────────────────┤
│  COLLAPSED CENTER               │
│  Large open clearing            │
│  Highest enemy spawn density    │
│  Most dangerous area            │
├─────────────────────────────────┤
│  DEEP RACKS                     │
│  Tightest corridors             │
│  Most obstacles                 │
│  Sable + other Fragments hide   │
│  here — furthest from spawn     │
└─────────────────────────────────┘
```

---

### Fragment Placement — Level 1

All five Fragments spawn in the Deep Racks zone every run. Positions are randomized within that zone. Only one will be practically reachable per run given enemy pressure — the others remain as Echo heals if stumbled upon.

| Fragment | Class Unlocked | Guaranteed Zone |
|---|---|---|
| Sable | Warden | Deep Racks — furthest server room |
| Raze | Breaker | Deep Racks — behind obstacle cluster |
| Lumen | Ghost | Deep Racks — near map corner |
| Cord | Weaver | Deep Racks — isolated corridor |
| Voss | Herald | Deep Racks — open pocket near back wall |

---

### Enemy Behavior in Level 1

Level 1 uses the standard population mix table (Section 6). Violet and Yellow dominate early. Green appears mid-run. Orange and Pink boss appear only in longer runs. This gives new players time to learn movement and shooting before things get aggressive.

The Collapsed Center clearing is where the highest enemy density spawns — intentionally the most dangerous area, placed between the player spawn and the Fragments. Getting to the Deep Racks requires crossing it.

---

### Persistence — What localStorage Tracks

```javascript
// Saved on Fragment rescue
chromatic_decay_archive: {
  sable: true,      // Warden unlocked
  raze: false,      // Breaker not yet found
  lumen: false,
  cord: false,
  voss: false
}

// Saved on run end (leaderboard)
chromatic_decay_scores: [
  { initials: 'MAT', score: 8420, class: 'Breaker', time: 612 },
  ...
]

// Saved per session (lore triggers — resets each run)
chromatic_decay_lore_seen: {
  violet_first: true,
  blue_first: false,
  ...
}
```

All three keys managed independently. Archive is permanent. Scores are permanent. Lore triggers reset each run so blurbs fire fresh.

---

## 21. Open Questions / Future Features

- **Online multiplayer:** Co-op Warden mode, Partykit as sync layer
- **Additional enemy types:** White tier — near-endgame only, mechanic TBD
- **Map variety:** Multiple arena layouts unlocked after X runs
- **Echo identity expansion:** Named standard Echoes with one-line identities
- **Additional Fragments:** Subclass-specific Fragments that unlock subclass trait weighting?
- **Warden cosmetics:** Persistent visual unlocks that don't affect balance
- **Soundtrack:** Commission vs. royalty-free chiptune library
- **Score anti-cheat:** Lightweight server-side validation if leaderboard goes public

---

*Document maintained by: Matt*
*Version: 5.1 — PC and mobile controls fully specced: WASD + mouse aim + hold SPACE, two-finger mobile translation, fire slow multiplier*
*Next step: Begin build when ready — upload this doc as context*
