#!/usr/bin/env node
/**
 * Vendors the exercise catalogue from free-exercise-db.
 *
 *   node scripts/build-exercise-data.mjs
 *
 * Source: https://github.com/yuhonas/free-exercise-db  (Unlicense/public domain)
 *
 * The output is committed, so the app ships with the whole library and works
 * with no network and no API key. This script exists so refreshing it is one
 * command rather than a hand-edit nobody can reproduce.
 *
 * Two files come out, and the split is deliberate:
 *
 *   catalog.json       ~200KB  every screen needs it (browse, search, generate)
 *   instructions.json  ~600KB  only the exercise detail screen needs it
 *
 * Metro has no code splitting, so both end up in the bundle either way — but
 * `instructions.json` is `require`d lazily, so the text of 873 exercises is not
 * parsed on a cold start just to draw a list of muscle groups.
 *
 * Image paths are NOT stored: every image is `{id}/{n}.jpg`, so storing the
 * list again would be 60KB of redundancy. See `exerciseImage()`.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'exercises');

/** Fields the app actually reads. Anything else is dropped. */
const CATALOG_FIELDS = [
  'id',
  'name',
  'primaryMuscles',
  'secondaryMuscles',
  'equipment',
  'level',
  'mechanic',
  'force',
  'category',
];

const main = async () => {
  process.stdout.write(`Fetching ${SOURCE}\n`);
  const res = await fetch(SOURCE);
  if (!res.ok) {
    throw new Error(`Source returned ${res.status}`);
  }
  const raw = await res.json();

  if (!Array.isArray(raw) || raw.length < 500) {
    throw new Error(`Unexpected payload: ${raw?.length} entries`);
  }

  const catalog = [];
  const instructions = {};
  let imagesDerivable = true;

  for (const e of raw) {
    // Guard the assumption that image paths are derivable from the id. If the
    // upstream layout ever changes, fail loudly here rather than shipping an
    // app whose every exercise image 404s.
    if (e.images?.length && !e.images[0].startsWith(`${e.id}/`)) {
      imagesDerivable = false;
    }

    const entry = {};
    for (const f of CATALOG_FIELDS) {
      const v = e[f];
      // Upstream uses null for unknown mechanic/force/equipment. Drop the key
      // instead so the TypeScript type can be honestly optional.
      if (v !== null && v !== undefined) {
        entry[f] = v;
      }
    }
    entry.imageCount = e.images?.length ?? 0;
    catalog.push(entry);

    if (e.instructions?.length) {
      instructions[e.id] = e.instructions;
    }
  }

  if (!imagesDerivable) {
    throw new Error(
      'Image paths no longer derive from the exercise id — update exerciseImage().',
    );
  }

  catalog.sort((a, b) => a.name.localeCompare(b.name));

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog));
  writeFileSync(join(OUT_DIR, 'instructions.json'), JSON.stringify(instructions));

  const kb = n => `${Math.round(n / 1024)}KB`;
  process.stdout.write(
    `Wrote ${catalog.length} exercises\n` +
      `  catalog.json       ${kb(JSON.stringify(catalog).length)}\n` +
      `  instructions.json  ${kb(JSON.stringify(instructions).length)}\n`,
  );
};

main().catch(e => {
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
});
