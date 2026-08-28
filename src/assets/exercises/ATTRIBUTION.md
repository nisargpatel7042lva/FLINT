# Exercise data

`catalog.json` and `instructions.json` are generated — do not edit them by hand.
Regenerate with:

```bash
node scripts/build-exercise-data.mjs
```

## Source

**free-exercise-db** — <https://github.com/yuhonas/free-exercise-db>

873 exercises with muscle tagging, equipment, difficulty and step-by-step
instructions.

## Licence

Released under **The Unlicense** — public domain. There is no attribution
requirement, no share-alike clause and no commercial restriction. This file
exists because knowing where data came from matters even when the licence does
not compel it, and because the next person to touch this needs to know it is
vendored rather than authored.

## Images

Not vendored. They are served from jsDelivr:

```
https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/{id}/{n}.jpg
```

The full image set is several hundred megabytes, which does not belong in an
APK. Paths are derived from the exercise id (`exerciseImage()` in
`src/services/exercises.ts`); the build script fails loudly if upstream ever
stops following that convention.

Consequence to be aware of: **exercise images need a network connection.** The
catalogue itself — names, muscles, equipment, instructions, and every generated
session — works fully offline.

## Alternatives considered

- **wger** (<https://wger.de>, AGPL, REST API) — good data, but a network
  dependency with rate limits for something that should work in a basement gym.
- **ExerciseDB / RapidAPI** — not open source, needs a key, has a request cap.
