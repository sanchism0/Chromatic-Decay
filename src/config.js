// CHROMATIC DECAY — Config
// All tunable values live here. Admin Panel reads/writes this object.

export const CONFIG = {
  // ── Player ──────────────────────────────────────────────────
  player_base_hp:              100,
  player_base_damage:          10,
  player_base_fire_rate:       2,      // shots per second
  player_move_speed:           240,    // px/sec
  player_fire_slow_multiplier: 0.7,
  player_projectile_speed:     480,    // px/sec
  player_projectile_range:     650,    // max travel distance px
  player_pickup_radius:        50,     // residual magnetic pull px
  player_size:                 14,     // sprite half-width px (total 14×14)

  // ── Map ─────────────────────────────────────────────────────
  map_width:  1174,   // ~39% smaller than original 1920 (~37 tiles)
  map_height: 1174,
  tile_size:  32,

  // ── Enemies ─────────────────────────────────────────────────
  enemies: {
    violet: {
      base_hp:              30,
      move_speed:           72,       // 1.5 × 60, −20%
      aggro_range:          0,
      projectile_damage:    0,
      projectile_fire_rate: 0,
      residual_drop:        5,
      spawn_weight:         1.0,
      color:                '#5200ff',
      edge_color:           '#7B4FFF',
      glow_color:           '#5200ff',
      size:                 10,       // radius px
      shape:                'octagon',
    },
    yellow: {
      base_hp:              50,
      move_speed:           96,       // 2 × 60, −20%
      aggro_range:          150,
      projectile_damage:    0,
      projectile_fire_rate: 0,
      residual_drop:        8,
      spawn_weight:         0.8,
      color:                '#e9ff6a',
      edge_color:           '#f5ffaa',
      glow_color:           '#e9ff6a',
      size:                 11,
      shape:                'circle',
    },
    green: {
      base_hp:              60,
      move_speed:           144,      // 3 × 60, −20%
      aggro_range:          200,
      projectile_damage:    12,
      projectile_fire_rate: 0.8,
      residual_drop:        12,
      spawn_weight:         0.6,
      color:                '#8dff6a',
      edge_color:           '#c0ffaa',
      glow_color:           '#8dff6a',
      size:                 13,
      shape:                'triangle',
    },
    orange: {
      base_hp:              70,
      move_speed:           60,       // 1 × 60 (halved — shooters stay back)
      aggro_range:          180,
      projectile_damage:    18,       // +20%
      projectile_fire_rate: 1,
      residual_drop:        18,
      spawn_weight:         0.4,
      color:                '#fd6c1d',
      edge_color:           '#FF9A5C',
      glow_color:           '#fd6c1d',
      size:                 12,
      shape:                'diamond',
    },
    pink: {
      base_hp:              900,
      move_speed:           55,       // slow drift between dashes
      aggro_range:          300,
      projectile_damage:    250,      // 1000% boost (×10)
      projectile_fire_rate: 2.0,      // high fire rate
      residual_drop:        60,
      spawn_weight:         0.05,
      color:                '#f81d78',
      edge_color:           '#ff6aaa',
      glow_color:           '#f81d78',
      size:                 15,       // smaller — was 22, was getting stuck
      shape:                'square',
    },
  },

  // ── Scaling ──────────────────────────────────────────────────
  hp_scale_per_minute:     0.15,
  base_spawn_interval:     3.0,   // seconds between spawns
  spawn_acceleration:      0.1,   // seconds faster per elapsed minute
  min_spawn_interval:      0.5,
  max_simultaneous_pinks:  1,
  max_enemies:             60,    // hard cap

  // ── Population mix — [violet, yellow, green, orange, pink] ──
  // Rows correspond to time brackets below
  population_mix: [
    [1.00, 0.00, 0.00, 0.00, 0.00],  // 0–2 min
    [0.60, 0.40, 0.00, 0.00, 0.00],  // 2–5 min
    [0.30, 0.35, 0.35, 0.00, 0.00],  // 5–9 min
    [0.15, 0.25, 0.35, 0.25, 0.00],  // 9–14 min
    [0.10, 0.15, 0.30, 0.40, 0.05],  // 14–20 min
    [0.05, 0.10, 0.25, 0.50, 0.10],  // 20+ min
  ],
  population_time_brackets: [0, 2, 5, 9, 14, 20],   // minutes

  // ── Residuals ────────────────────────────────────────────────
  residual_base_threshold:   50,
  residual_threshold_increase: 30,
  residual_size:             5,    // orb radius px

  // ── Echoes ───────────────────────────────────────────────────
  echo_spawn_interval:  15,    // seconds
  echo_hp_restore:      12,
  echo_channel_time:    3.0,   // seconds to rescue
  echo_max_count:       4,     // max on map at once

  // ── Score weights ────────────────────────────────────────────
  kill_weight:     10,
  echo_weight:     50,
  time_weight:     1,    // per second survived
  upgrade_weight:  100,
  fragment_weight: 500,

  // ── Particles ────────────────────────────────────────────────
  max_particles: 200,

  // ── Camera ───────────────────────────────────────────────────
  camera_zoom: 2.2,   // how many world px = 1 screen px (higher = more zoomed in)

  // ── Lore feed ────────────────────────────────────────────────
  lore_hold_duration: 3.5,   // seconds blurb stays visible
  lore_fade_in:       0.3,
  lore_fade_out:      0.5,

  // ── Fragment system ───────────────────────────────────────────
  // Dev mode: one fragment spawns every run (for skill tree testing)
  // Set fragment_dev_mode false when all five trees are ready
  fragment_dev_mode:          true,     // true = dev mode, false = full game
  active_test_fragment:       'raze',   // only this fragment spawns in dev mode
  fragment_spawn_zone_start:  0.66,     // fragment only spawns past this % of map width
  fragment_edge_padding:      64,       // never spawns within this distance of map edge
  fragment_placement_attempts: 500,     // max attempts before fallback placement

  // ── Wave system ───────────────────────────────────────────────
  seconds_per_bonus_level:    50,       // banked seconds needed for 1 extra level
  target_time_seconds:        900,      // 15 min — bonus window threshold (not a deadline)
  time_bonus_per_second:      100,      // score pts per second under target time
  boss_spawn_threshold:       0.5,      // next sequential boss spawns at this HP fraction

  // Kill score per enemy type
  kill_points: {
    violet:  10,
    yellow:  12,
    green:   18,
    orange:  30,
    pink:    150,
  },
};
