# French practice

A personal French drill app built from Jonathan's lesson notes with Charlotte. It is a static site, hosted on GitHub Pages, that works on a laptop and a phone from one URL:

**https://jonathanchill.github.io/Test-Jon/**

No backend, no accounts, no API keys, no analytics. Progress lives in the browser's localStorage on each device, with export and import to move it between devices.

## What is in it

- A unit map in course order. Priority 1 units are the ones that keep coming up in lessons.
- Each unit opens with a plain-English explanation of the rule, then drills.
- Exercise types so far: flashcards (French to English and English to French) and gap-fill. Multiple choice, transformation, error spotting, translation, dictation and open prompts arrive in later milestones.
- Answer checking ignores case, spacing, apostrophe style and final punctuation, accepts listed alternatives, and treats a missing accent as "nearly" (it shows the accented form). Wrong gender, agreement or conjugation is wrong.
- Spaced repetition (a simplified SM-2) on every item. Anything answered wrong goes into the mistake bank until it is answered correctly twice in a row.
- Items marked **verify with Charlotte** were reconstructed from unclear transcripts or corrected without her, so ask about them next lesson.
- Vulgar items are hidden unless switched on in Settings.

## Milestones

| | Scope | Status |
| - | - | - |
| M1 | Scaffold, Pages deploy, content schema and validation, Units 1 and 4, flashcards and gap-fill | done |
| M2 | All units, spaced-repetition review session, mistake bank deck, error-spotting and the other exercise types | next |
| M3 | Audio: text to speech at three speeds, dictation, audio-only mode, Unit 11, installable PWA with offline support | |
| M4 | Speaking drills, mastery stats, "today's lesson" mode, export/import polish | |

## Local development

Needs Node 20.19+ or 22.12+.

```
npm install
npm run dev        # http://localhost:5173/Test-Jon/
```

Other commands:

```
npm run validate   # check every content file against the schema and cross-file rules
npm test           # unit tests (answer checking, scheduling, progress export/import, content, routing)
npm run build      # typecheck and production build into dist/
npm run preview    # serve dist/ locally
```

## Deployment

Every push runs the CI workflow (`.github/workflows/ci.yml`): validate content, run tests, build. Pushes to `main` also run the deploy workflow (`.github/workflows/deploy.yml`), which repeats those checks and then publishes `dist/` to GitHub Pages using `actions/upload-pages-artifact` and `actions/deploy-pages`. The deploy job cannot run if validation or tests fail. The workflow can also be started by hand from the Actions tab.

### Enabling Pages (one-off)

1. Open the repo on GitHub, then **Settings** (the repo's settings, not your account's).
2. In the left sidebar choose **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**. Do not pick "Deploy from a branch".
4. Go to the **Actions** tab, open **Deploy to GitHub Pages** in the left list, click **Run workflow**, keep `main`, and run it. Any later push to `main` redeploys automatically.
5. After a minute or two the site is live at `https://jonathanchill.github.io/Test-Jon/`. The URL also appears at the top of the Pages settings page and on the deploy job.

Note: GitHub Pages from a **private** repository needs a paid GitHub plan. On a free account the repo must be public for the site to publish. The content rules below already assume the site is publicly reachable.

### Repo name

The site is served under `/<repo name>/`, so Vite needs to know it. It is one constant, `REPO_NAME`, at the top of `vite.config.ts`. If the repo is renamed, change that value and push. To build for the root of a domain instead, set `VITE_BASE=/` when building.

### Privacy

The site is reachable by anyone with the URL. Content therefore contains no personal details: vocabulary and generic example sentences only. The page carries `<meta name="robots" content="noindex, nofollow">` and `robots.txt` disallows all crawlers, which keeps it out of search results but is not security.

## Progress on two devices

Laptop and phone do not sync. In **Settings** use **Export progress as JSON** on one device, get the file to the other (AirDrop, email to yourself, a shared folder), then **Import progress from JSON** there. Importing merges rather than replaces: for each item the more recently answered copy wins, so it is safe to import in both directions.

## Adding a lesson

Content lives in `content/units/*.json`, one file per unit, validated against `content/schema.json`. Nothing in `src/` needs to change to add material.

The expected workflow after a lesson:

1. Open the repo in Claude Code and paste the new lesson notes (or a transcript).
2. Ask it to convert them into items in the schema, tagged `"source": "lesson"` with the lesson date, and to append them to the right unit file(s) without duplicating items that are already there. Anything reconstructed from an unclear transcript, or corrected by Claude rather than Charlotte, gets `"check": true` and a `note` saying why.
3. It runs `npm run validate` and `npm test`, then commits and pushes to `main`.
4. The deploy workflow publishes the new content within a couple of minutes.

You can also edit the JSON by hand. The rules the validator enforces:

- Every item has `id` (unit prefix plus a three-digit number, e.g. `subj-041`, unique across all files), `unit` (must equal the file name), `type`, `fr`, `en` (UK English), `register` (`neutral`, `informal`, `slang`, `vulgar`), `source` (`lesson`, `sheet`, `added`), `lesson_date` (ISO date, or `null` unless the source is `lesson`), `check` and `tts`.
- Type-specific fields: `gapfill` needs `prompt_fr` with exactly one `___` and `answers` (the missing word or words; the first answer filled into the prompt must equal `fr`). `choice` needs `choices` and `answers`. `transform`, `errorspot`, `translate` and `dictation` need `answers` including `fr` itself. `open` needs `prompt_fr` and `model`.
- `note` is optional but required when `check` is true. Keep it to one line: the reason, or the slip it corrects.
- No two items of the same type in one unit may share the same `fr`.

A minimal example:

```json
{
  "id": "subj-041",
  "unit": "subjunctive",
  "type": "gapfill",
  "prompt_fr": "Il faut que tu ___ la vérité",
  "answers": ["dises"],
  "fr": "Il faut que tu dises la vérité",
  "en": "You have to tell the truth",
  "note": "dire becomes que tu dises",
  "register": "neutral",
  "source": "lesson",
  "lesson_date": "2026-10-07",
  "check": false,
  "tts": true
}
```

To add a whole new unit, create `content/units/<id>.json` with `id`, `title`, `priority`, a unique `order`, an `explanation` (paragraphs separated by blank lines, `- ` bullets, `**bold**`), and `items`. Then add the unit to `CURRICULUM` in `src/content/curriculum.ts` so it appears on the map in the right place.
