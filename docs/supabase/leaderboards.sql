-- CHROMATIC DECAY — leaderboard tables
-- Paste into the Supabase SQL editor and run once. Safe to run again.

-- Arcade runs: add when each run happened (for the weekly board), who played
-- it, and allow full names (not just 3 initials)
alter table scores add column if not exists created_at timestamptz not null default now();
alter table scores add column if not exists agent text;
alter table scores add column if not exists player_id text;
alter table scores alter column initials type text;

create index if not exists scores_platform_score on scores (platform, score desc);
create index if not exists scores_platform_created on scores (platform, created_at);

-- One row per player (per device): Story progress and lifetime Chroma
create table if not exists players (
  id              text primary key,
  name            text not null,
  platform        text,
  story_points    int not null default 0,      -- a point per level cleared with each character
  furthest_level  int not null default 0,
  story_agents    text not null default '',    -- 'd', 'j', 'r' for each character with a clear
  story_at        timestamptz,                 -- when story_points last went up (ties: earliest wins)
  lifetime_chroma bigint not null default 0,   -- violet 1, yellow 10, green 100, orange 1000, pink 10000
  updated_at      timestamptz not null default now()
);

-- The game uses the public (anon) key, so these rules let anyone read the
-- boards and post their own rows
alter table scores  enable row level security;
alter table players enable row level security;

drop policy if exists "scores read"    on scores;
drop policy if exists "scores insert"  on scores;
drop policy if exists "players read"   on players;
drop policy if exists "players insert" on players;
drop policy if exists "players update" on players;

create policy "scores read"    on scores  for select using (true);
create policy "scores insert"  on scores  for insert with check (true);
create policy "players read"   on players for select using (true);
create policy "players insert" on players for insert with check (true);
create policy "players update" on players for update using (true) with check (true);
