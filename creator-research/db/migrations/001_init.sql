-- Creator research tool: version 1 schema.
-- Holds public, business-related information only. Every number carries the
-- date it was checked and the source it came from.

create table briefs (
  id            bigserial primary key,
  client        text not null,
  name          text not null,
  niches        text[] not null default '{}',
  countries     text[] not null default '{}',       -- ISO 3166-1 alpha-2, e.g. GB, FR
  languages     text[] not null default '{}',       -- ISO 639-1, e.g. en, fr
  follower_min  integer not null default 10000,
  follower_max  integer,                            -- null = no upper limit
  products      text[] not null default '{}',       -- client product and similar ones
  exclusions    text[] not null default '{}',       -- creators to leave out (names, handles, channel URLs)
  notes         text not null default '',
  status        text not null default 'draft'
                check (status in ('draft','running','waiting_quota','complete','paused')),
  status_note   text not null default '',
  created_by    text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- The search plan and its record: which query was run, when, and what it cost.
create table searches (
  id            bigserial primary key,
  brief_id      bigint not null references briefs(id) on delete cascade,
  platform      text not null default 'youtube',
  kind          text not null check (kind in ('product','niche')),
  term          text not null,
  niche         text,                               -- which brief niche this term belongs to
  region        text not null,                      -- country the search was scoped to
  language      text not null,
  status        text not null default 'queued'
                check (status in ('queued','done','failed','skipped')),
  term_source   text not null default 'brief',      -- brief | claude | person
  result_count  integer,
  new_channels  integer,
  error         text,
  run_at        timestamptz,
  created_at    timestamptz not null default now(),
  unique (brief_id, platform, term, region, language)
);
create index searches_queue on searches (brief_id, status, kind, id);

-- One record per creator, however many platforms they are on.
create table creators (
  id               bigserial primary key,
  name             text not null,
  country          text,                            -- creator's own country, never the audience's
  country_source   text not null default 'unknown'
                   check (country_source in ('declared','estimate','person','unknown')),
  language         text,
  language_source  text not null default 'unknown'
                   check (language_source in ('declared','estimate','person','unknown')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table accounts (
  id                  bigserial primary key,
  creator_id          bigint not null references creators(id) on delete cascade,
  platform            text not null check (platform in ('youtube','instagram','tiktok','twitch')),
  platform_id         text,                         -- e.g. YouTube channel id; null until looked up
  handle              text,
  url                 text not null,
  title               text,
  description         text,
  followers           bigint,                       -- null = no public number
  median_recent_views bigint,
  videos_sampled      integer,
  posts_per_month     numeric(6,1),
  made_for_kids       boolean,
  last_post_at        timestamptz,
  uploads_ref         text,                         -- YouTube uploads playlist id
  recent_items        jsonb not null default '[]',  -- recent public videos/posts: title, url, date, views
  check_status        text not null default 'pending'
                      check (check_status in ('pending','checked','no_public_numbers','not_found','unchecked')),
  source              text not null,                -- where the numbers came from
  link_source         text,                         -- for linked accounts: where the link was found
  checked_at          timestamptz,
  created_at          timestamptz not null default now()
);
create unique index accounts_platform_id on accounts (platform, platform_id) where platform_id is not null;
create unique index accounts_platform_handle on accounts (platform, lower(handle)) where platform <> 'youtube' and handle is not null;
create index accounts_creator on accounts (creator_id);

-- A creator's standing on one brief. Fit is always relative to a brief.
create table brief_creators (
  brief_id        bigint not null references briefs(id) on delete cascade,
  creator_id      bigint not null references creators(id) on delete cascade,
  niches          text[] not null default '{}',
  stage           text not null default 'found'
                  check (stage in ('found','checked','out_of_range','not_checkable','left_out','scored')),
  fit_score       smallint check (fit_score between 1 and 5),
  reason          text,
  warnings        text[] not null default '{}',
  estimate_note   text,                             -- always worded as an estimate
  excluded_reason text,                             -- e.g. gambling; blocks approval until a person clears it
  score_source    text,                             -- model id, or 'demo-heuristic', or 'person'
  scored_at       timestamptz,
  score_error     text,
  score_attempts  smallint not null default 0,
  status          text not null default 'found'
                  check (status in ('found','shortlisted','approved','rejected')),
  review_note     text not null default '',
  reviewed_by     text,
  reviewed_at     timestamptz,
  edited          boolean not null default false,   -- a person changed score/reason/warnings
  created_at      timestamptz not null default now(),
  primary key (brief_id, creator_id)
);
create index brief_creators_stage on brief_creators (brief_id, stage);

-- The videos or posts that put a creator on the list, tied to the search that found them.
create table evidence (
  id            bigserial primary key,
  brief_id      bigint not null references briefs(id) on delete cascade,
  creator_id    bigint not null references creators(id) on delete cascade,
  search_id     bigint references searches(id) on delete set null,
  platform      text not null default 'youtube',
  item_id       text not null,
  url           text not null,
  title         text not null,
  published_at  timestamptz,
  found_at      timestamptz not null default now(),
  unique (brief_id, platform, item_id, search_id)
);
create index evidence_creator on evidence (brief_id, creator_id);

-- Daily usage against each platform's limits. The day is the platform's own
-- quota day (YouTube resets at midnight Pacific time).
create table quota_usage (
  provider  text not null,
  bucket    text not null,
  day       date not null,
  used      integer not null default 0,
  primary key (provider, bucket, day)
);

-- Creators deleted on request. Only a hash is kept so they are not re-added.
create table suppressions (
  platform      text not null,
  id_hash       text not null,
  created_at    timestamptz not null default now(),
  primary key (platform, id_hash)
);

create table exports (
  id           bigserial primary key,
  brief_id     bigint not null references briefs(id) on delete cascade,
  approved_by  text not null,
  creator_count integer not null,
  created_at   timestamptz not null default now()
);

create table audit_log (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  actor     text not null,
  action    text not null,
  brief_id  bigint,
  detail    jsonb not null default '{}'
);
