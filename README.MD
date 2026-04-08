# CHROMATIC DECAY

> A top-down arcade shooter set in a world dissolved by signal saturation.

You are a Signal Warden — the last analog human in a grayscale void — fighting corrupted data constructs called Chromatics. Rescue fragmented digital consciousnesses, collect Residuals, and evolve into one of five emergent classes before your signal collapses.

Every run ends. Every run tells more of the story.

---

## Play

**Live:** `https://[username].github.io/chromatic-decay`

No install. Open in any browser. Playable on desktop and mobile.

---

## Status

> 🔴 Pre-build — planning complete, development not yet started

---

## What's in This Repo

```
chromatic-decay/
├── index.html              # Game entry point (coming soon)
├── chromatic-decay-gdd.md  # Full game design document
├── README.md               # This file
```

---

## Game Design

Full design doc lives at [`chromatic-decay-gdd.md`](./chromatic-decay-gdd.md). It covers:

- World & lore — The Collapse, the Chromatics, the Signal Wardens
- All five enemy types with base stats and behavior
- Five classes (Warden, Breaker, Ghost, Weaver, Herald) with 10 traits each
- Five subclasses for split-path builds
- The Warden Archive — meta-progression via named Fragment rescues
- Lore feed system — in-game story blurbs triggered by first encounters
- Stat architecture and scaling formulas
- Admin config panel spec — tune all balance values without touching code
- Mobile controls spec — dual stick layout, HUD adjustments, landscape lock
- Supabase leaderboard spec — shared hi-score board across all players

---

## Stack

| Layer | Tool |
|---|---|
| Game engine | Vanilla JS + HTML5 Canvas |
| Hosting | GitHub Pages |
| Leaderboard | Supabase (free tier) |
| Multiplayer (future) | Partykit |
| Dev environment | Claude Code |

---

## Build Order

- [ ] Desktop core — movement, shooting, enemies, Residuals, upgrades
- [ ] Class system — trait cards, class emergence, visual shifts
- [ ] Warden Archive — Fragment spawns, permanent unlocks, Archive menu
- [ ] Lore feed — blurb triggers, subtitle display, on/off toggle
- [ ] Admin config panel — tunable values, JSON export/import
- [ ] Supabase leaderboard — score POST on run end, GET on leaderboard screen
- [ ] Mobile controls — dual stick joysticks, HUD layout, landscape lock
- [ ] Polish — audio, death animations, class visual effects, performance tuning

---

## The Five Classes

| Class | Unlocked By | Identity |
|---|---|---|
| **Warden** | Rescuing Sable | Sustain, protection, Echo synergy |
| **Breaker** | Rescuing Raze | Burst offense, kill-chaining, high risk/reward |
| **Ghost** | Rescuing Lumen | Mobility, evasion, damage tied to movement |
| **Weaver** | Rescuing Cord | Map control, traps, area denial |
| **Herald** | Rescuing Voss | Companion summons, indirect damage |

Classes emerge from trait selections — never chosen directly.

---

## The Warden Fragments

Five named digital constructs hidden in the far reaches of each map. Find one for the first time and that class tree unlocks permanently across all future runs.

| Fragment | Was | Unlocks |
|---|---|---|
| **Sable** | A server farm load balancer | Warden tree |
| **Raze** | A decommissioned trading algorithm | Breaker tree |
| **Lumen** | A VPN service | Ghost tree |
| **Cord** | A smart home hub | Weaver tree |
| **Voss** | A social media recommendation engine | Herald tree |

---

## Leaderboard

Shared hi-score board via Supabase. All players on any device see the same board. Enter 3 initials at run end. Scores ranked by Frequency Score — a weighted formula factoring kills, Echoes rescued, survival time, and traits taken.

---

*Built for the Signal Wardens. You know who you are.*
