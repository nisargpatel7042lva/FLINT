import { NEVER_SAY, TONES } from '../src/services/ego';
import {
  EXCUSE_REASONS,
  excuseId,
  excuseLine,
  isProtectedReason,
} from '../src/services/excuses';

describe('excuse tax', () => {
  /* Rest and injury are real answers; neither voice ever jabs them. */
  it('shows rest and injury neutrally in both voices', () => {
    TONES.forEach(tone => {
      expect(excuseLine('Priya', 'rest', tone)).toBe(excuseLine('Priya', 'rest', 'warm'));
      expect(excuseLine('Priya', 'injured', tone)).not.toMatch(/move|goal|ahead/i);
    });
    expect(isProtectedReason('rest')).toBe(true);
    expect(isProtectedReason('motivation')).toBe(false);
  });

  it('never mentions bodies or insults', () => {
    TONES.forEach(tone =>
      EXCUSE_REASONS.forEach(r => {
        const line = excuseLine('Priya', r, tone).toLowerCase();
        NEVER_SAY.forEach(w => expect(line).not.toMatch(new RegExp(`\b${w}\b`)));
      }),
    );
  });

  it('is one excuse per person per day', () => {
    expect(excuseId('abc', '2026-10-01')).toBe('abc_2026-10-01');
  });
});
