import { readFileSync } from 'fs';
import { join } from 'path';

import { passedNudge, stealNudge } from '../functions/src/copy';
import { pokeNudge } from '../functions/src/pokeCopy';

/**
 * The background alert check (Kotlin, runs with the app closed) carries its own
 * copy of the push text. Jest cannot run Kotlin, so this checks the source:
 * every line the server would push must appear in AlertCopy.kt, word for word,
 * once `${x}` is written the Kotlin way as `$x`.
 */
const kotlin = readFileSync(
  join(__dirname, '../android/app/src/main/java/com/kasrat/alerts/AlertCopy.kt'),
  'utf8',
);

const asKotlin = (s: string) => s.replace(/\{\{(\w+)\}\}/g, '$$$1');

describe('AlertCopy.kt matches the server copy', () => {
  const lines = [
    passedNudge('{{passer}}', '{{club}}', 'savage'),
    passedNudge('{{passer}}', '{{club}}', 'warm'),
    stealNudge('{{thief}}', '{{yourClub}}', 2, 'savage'),
    stealNudge('{{thief}}', '{{yourClub}}', 2, 'warm'),
  ];

  it.each(lines.flatMap(l => [l.title, l.body]))('%s', line => {
    // The block count is built separately in Kotlin as `$n`.
    const k = asKotlin(line).replace('2 blocks', '$n');
    expect(kotlin).toContain(k);
  });

  it('has every nudge line', () => {
    (['poke', 'challenge', 'cheer'] as const).forEach(kind => {
      for (let seed = 0; seed < 3; seed += 1) {
        const { body } = pokeNudge(kind, 'X', seed);
        expect(kotlin).toContain(`"${body}"`);
      }
    });
  });
});
