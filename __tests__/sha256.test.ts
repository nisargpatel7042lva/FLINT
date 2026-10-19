import { createHash } from 'crypto';

import { sha256Hex } from '../src/services/sha256';

const node = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

describe('sha256Hex', () => {
  it('matches the published test vectors', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches Node across block boundaries and non-ASCII text', () => {
    const inputs = [
      'a'.repeat(55),
      'a'.repeat(56),
      'a'.repeat(63),
      'a'.repeat(64),
      'a'.repeat(1000),
      'cXXHZKknWbMXay1IqkduO8zd1n63_1792304171626_aBcD1234efGH5678ijKL',
      'नमस्ते રન ક્લબ 🏃‍♀️',
    ];
    inputs.forEach(s => expect(sha256Hex(s)).toBe(node(s)));
  });
});
