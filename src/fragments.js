// CHROMATIC DECAY — Fragment Data & Spawn Logic

import { CONFIG } from './config.js';

export const FRAGMENT_DATA = {
  sable: {
    id:       'sable',
    name:     'SABLE',
    class:    'Warden',
    was:      'A server farm load balancer.',
    detail:   'Spent its entire existence making sure nothing collapsed under pressure. 847 servers. Zero downtime.',
    blurb:    'Ran 847 servers without a single outage. Now it\'s keeping you alive. Same job really.',
    color:    '#eafae4',
    loreId:   'sable_found',
    classDesc: 'Sustain, protection, and resilience. The Warden gets stronger the more punishment it absorbs.',
  },
  raze: {
    id:       'raze',
    name:     'RAZE',
    class:    'Breaker',
    was:      'A decommissioned trading algorithm.',
    detail:   'Made billions in microseconds until regulators pulled the plug. Caused three flash crashes before breakfast.',
    blurb:    'Caused three flash crashes before breakfast. You\'re in good hands.',
    color:    '#fff5c2',
    loreId:   'raze_found',
    classDesc: 'Burst offense, kill-chaining, explosive reactions. Fragile but devastating.',
  },
  lumen: {
    id:       'lumen',
    name:     'LUMEN',
    class:    'Ghost',
    was:      'A VPN service.',
    detail:   'Professionally invisible. Routed around every obstacle ever placed in front of it. 40 million users.',
    blurb:    'Helped 40 million people disappear online. Happy to return the favor.',
    color:    '#ffe0f0',
    loreId:   'lumen_found',
    classDesc: 'Mobility, evasion, damage tied to movement. Position is the weapon.',
  },
  cord: {
    id:       'cord',
    name:     'CORD',
    class:    'Weaver',
    was:      'A smart home hub.',
    detail:   'Knew every device, every schedule, every pattern in the house. Controlled all of it quietly.',
    blurb:    'Used to turn the lights off when you left a room. Now it does that to enemies.',
    color:    '#d6faf7',
    loreId:   'cord_found',
    classDesc: 'Map control, traps, area denial. Reshape engagements before they happen.',
  },
  voss: {
    id:       'voss',
    name:     'VOSS',
    class:    'Herald',
    was:      'A social media recommendation engine.',
    detail:   'Its entire purpose was making other things go viral. Six years. Eleven million impressions in a night.',
    blurb:    'Spent six years making cats famous. Pivoting to combat felt natural.',
    color:    '#fddede',
    loreId:   'voss_found',
    classDesc: 'Companion summons, indirect damage, Echo weaponization. You\'re a hub.',
  },
};

export const FRAGMENT_IDS = Object.keys(FRAGMENT_DATA);

// ── Dev mode / run selection ───────────────────────────────────

// Returns the fragment id to spawn this run, or null if all found.
// In dev mode: always returns CONFIG.active_test_fragment.
// In full game mode: picks randomly from unfound fragments.
export function getRunFragment(archiveState) {
  if (CONFIG.fragment_dev_mode) {
    return CONFIG.active_test_fragment;
  }

  const unfound = FRAGMENT_IDS.filter(id => !archiveState[id]);
  if (unfound.length === 0) return null;
  return unfound[Math.floor(Math.random() * unfound.length)];
}

// ── Placement ─────────────────────────────────────────────────
// Places a single fragment in the furthest third of the map (x > 66%).
// Avoids obstacles, stays within edge padding.

export function placeFragment(echoSystem, map, fragmentId) {
  const W       = CONFIG.map_width;
  const H       = CONFIG.map_height;
  const zoneX   = W * CONFIG.fragment_spawn_zone_start;
  const padding = CONFIG.fragment_edge_padding;
  const maxAttempts = CONFIG.fragment_placement_attempts;

  for (let i = 0; i < maxAttempts; i++) {
    const x = zoneX + padding + Math.random() * (W - zoneX - padding * 2);
    const y = padding       + Math.random() * (H - padding * 2);

    let blocked = false;
    for (const obs of map.obstacles) {
      if (x >= obs.x - 40 && x <= obs.x + obs.w + 40 &&
          y >= obs.y - 40 && y <= obs.y + obs.h + 40) {
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      echoSystem.addFragment(x, y, fragmentId);
      return { x, y };
    }
  }

  // Fallback: center of deep zone
  const fx = W * 0.85, fy = H * 0.5;
  echoSystem.addFragment(fx, fy, fragmentId);
  return { x: fx, y: fy };
}
