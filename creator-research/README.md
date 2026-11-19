# Creator research tool

A 1minus1 tool that finds and checks creators from the platforms' own data. You write a brief (niches, countries, languages, a follower range, products), it searches YouTube, pulls each channel's numbers, has Claude score the fit with a one-line reason, and gives a person a list to review, approve and export.

It is a separate project from the creator seeding hub and from the French practice app that shares this repository. Everything for it lives in this `creator-research/` folder.

Built from "Creator research tool - scope and research" (19 November 2026).

## What is built

| Scope item | Status |
| - | - |
| Brief with niches, countries, languages, follower range, products, exclusions | Built |
| Product searches first, then niche searches per country and language | Built. Claude writes extra search terms in each language; you can add and remove searches before starting |
| Subscribers, median views on the last 10 to 20 videos, videos per month, country, language | Built |
| Instagram, TikTok and Twitch handles read from the creator's YouTube descriptions | Built. See limits below |
| One creator record across platforms | Built. A handle linked from two channels raises a "possible duplicate" warning rather than merging by itself |
| Claude fit score 1 to 5, one-line reason, warnings | Built, not yet run against the live API (no key in the build environment) |
| Review screen with filters, approve, reject, shortlist, edit | Built |
| Export of the approved list with counts by country, niche and size | Built (.xlsx, opens in Excel and Google Sheets) |
| A real count of who fits, and a note of what could not be checked | Built ("The count" and "Not checked" tabs) |
| Which search found which creator; date and source on every number | Built |
| Daily limits: stop, queue, resume next day | Built and tested |
| Delete a creator on request | Built. They are also skipped by later searches |
| Adding creators by hand (TikTok, Instagram or YouTube handles and links) | Built. They join the same list, review and export. Follower numbers for TikTok are typed in by a person and marked as such |
| Instagram lookups (version 2) | Code written against Meta's documented Business Discovery API but **never run**. Off until the Meta app exists |
| TikTok (version 3) | **Not built.** Waiting on the decision between the four options. Linked TikTok handles are recorded as "not checked" |
| Scheduled re-checks (version 3) | A "Re-check numbers" button per brief. No automatic schedule yet |
| Twitch, saved briefs per client, link to the seeding hub | Not built |

## Running it

Needs Node 22 and PostgreSQL 14 or later.

```bash
cd creator-research
npm install
cp .env.example .env    # then fill it in
npm run migrate         # with DATABASE_URL set
npm run dev             # http://localhost:3000
```

### On your own computer, at no cost

With Docker Desktop installed, this runs the tool and its database together:

```bash
cd creator-research
cp .env.example .env    # then fill in APP_PASSWORD, YOUTUBE_API_KEY and ANTHROPIC_API_KEY
docker compose up -d --build
```

Open http://localhost:3000 and sign in with your name and the password you set. It is reachable from that computer only. A run only makes progress while the computer is on; it carries on from where it stopped. The data is kept between restarts. `docker compose down` stops it; adding `-v` also deletes the data.

To try the screens before any keys exist, set `DATA_MODE=demo`. Demo mode uses invented channels and a keyword scorer in place of Claude, says so on every screen, and marks its export file DEMO. Give demo mode its own database: it stores the invented channels and counts its searches against the same daily allowance table.

For production:

```bash
npm run build
npm run migrate
node .output/server/index.mjs
```

Environment settings (see `.env.example`):

| Setting | What it is |
| - | - |
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_CA_CERT` | For a managed database such as DigitalOcean's: the contents of its CA certificate, so the connection is encrypted and verified |
| `APP_PASSWORD` | Team password. Required in production: the app refuses to serve without it |
| `YOUTUBE_API_KEY` | Google Cloud project with the YouTube Data API v3 switched on |
| `ANTHROPIC_API_KEY` | For search terms and scoring |
| `SCORING_MODEL` | Default `claude-haiku-5-5`, the cheapest model, chosen for cost. `claude-opus-5-5` judges fit more sharply at roughly 40 times the price |
| `YOUTUBE_SEARCH_DAILY_LIMIT`, `YOUTUBE_UNITS_DAILY_LIMIT` | Default 100 and 10,000. Raise only if Google grants more |
| `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID` | Leave empty until the Meta app is ready |

Keys go in environment settings only. They are never logged, returned by the API, or shown on a screen.

**Signing in.** Everyone uses the one team password, with their own name as the username. That name is recorded on every approval, edit and export.

**Run one copy.** The background run lives inside the app and takes a database lock, so a second copy would simply wait. Set `WORKER_ENABLED=false` on any extra copy.

## How a run works

1. **Brief saved.** The search plan is written and shown on the Searches tab. Nothing has been searched yet.
2. **Start.** Product searches run first, then niche searches, each scoped to a country and language. Each costs one of the day's searches.
3. **Numbers.** Channels are looked up 50 at a time (1 unit). Channels inside the follower range get their recent uploads read (2 units each). Channels below the brief's smallest follower count, or with a hidden count, are counted but go no further.
4. **Links.** Instagram, TikTok and Twitch handles are read from the channel and video descriptions and attached to the same creator.
5. **Scoring.** Claude reads the description, recent titles and the videos the searches found, and returns a score, reason, warnings and niches.
   Claude is also shown the decisions people have already made on the brief (up to 12 each of approved, shortlisted and rejected, plus any notes), so later scoring follows the reviewer's judgement. Review 20 to 30 creators, then use "Save and score again" on the Export tab.
6. **Review.** A person approves, shortlists, rejects or edits. Edited scores are never overwritten by a later scoring run.
7. **Export.** Approved creators only, after ticking a confirmation. The file records who approved it.

When a daily limit is reached the brief shows "Waiting for daily limit" and carries on by itself after the reset (midnight Pacific time for YouTube).

Set the brief's smallest follower count to the smallest size you might ever want (10,000, say) and slice by size afterwards with the size filter. That is one run for both the 50,000-and-above list and the smaller creators.

## The seven rules, and where each is enforced

1. **Never contacts a creator.** There is no code that sends anything to a creator.
2. **Official sources, source on every number.** Version 1 calls only the YouTube Data API. Each account stores `source` and `checked_at`, shown in the creator panel and the export.
3. **Stays inside daily limits.** `server/lib/quota.ts` takes from the day's allowance in one atomic statement before every call. If YouTube itself reports the quota spent, the day is marked full.
4. **Public information only, delete on request.** "Delete this creator" removes the creator, accounts, scores and evidence, and keeps only a hash so later searches skip them.
5. **No audience claims.** Country is the creator's own declared country, or marked "estimate". Claude is told never to state audience location or age as fact; any view goes in a field labelled as an estimate.
6. **No gambling or casino content.** Flagged by Claude, with a keyword net behind it. A flagged creator cannot be approved or shortlisted, singly or in bulk, until a person opens the record and clears the flag. That action is logged.
7. **Nothing goes to a client unapproved.** The export contains only creators with status "approved" and needs an explicit confirmation.

## What to know before relying on it

- **Not yet run against the real YouTube or Claude APIs.** The build environment had no keys. The pipeline is tested end to end against PostgreSQL with a stand-in YouTube client. Expect to fix small things on the first live run, and allow the day the scope sets aside for tuning the scoring.
- **Channel links come from descriptions.** YouTube's API does not return the link buttons on a channel's About tab, so handles are read from the channel description and recent video descriptions. Creators who list their Instagram only in the link buttons will show no linked account. This is a gap against the scope.
- **Median views include Shorts.** The sample is the last 20 uploads of any kind.
- **YouTube only.** Creators who are only on TikTok or Instagram will not appear.
- **Country can be missing.** Many channels do not declare one. Claude's estimate is marked as such and can be corrected in the creator panel.
- **Search results are capped at 50 videos per search**, one page. More coverage comes from more search terms, not deeper pages.
- **The privacy check in the scope is still to do.** The tool stores public data about real people in the UK and EU. Deletion on request is built; the lawful-basis question needs someone qualified.

## Tests

```bash
npm test                                   # unit tests
TEST_DATABASE_URL=postgres://... npm test   # also runs the pipeline against a real database (it is wiped first)
npm run typecheck
```

## Where things are

```
db/migrations/        the schema
server/lib/           the logic, with no web framework in it
  pipeline.ts         search, numbers, links, scoring: one small step at a time
  youtube.ts          the official Data API client and what each call costs
  claude.ts           the scoring and search-term prompts
  quota.ts            daily allowances
  rules.ts            gambling net, numeric warnings, leave-out list
  store.ts            review list, counts, deletion
  export.ts           the client sheet
  demo.ts             invented data for demo mode
  instagram.ts        version 2, not yet run
server/api/           the HTTP routes
server/plugins/worker.ts   the background run
app/                  the screens
```

## Still open from the scope

1. Which TikTok option to accept.
2. Whether 1minus1 qualifies for the TikTok One Creator Marketplace API.
3. Whether the Meta app needs app review for Business Discovery.
4. Who owns the tool and approves lists.
5. Internal only, or something to offer clients later. The single team password suits internal use only.
