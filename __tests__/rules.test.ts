/**
 * Firestore security rules, exercised against the real emulator.
 *
 * These are not unit tests of our code — they test the rules file, which is the
 * only thing standing between a social feature and a stranger reading your
 * friends list or pushing text to your lock screen. Every case here is a thing
 * a modified client would try.
 *
 * Run with: npm run test:rules  (starts the emulator around jest)
 */
import fs from 'fs';
import path from 'path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

const ALICE = 'alice';
const BOB = 'bob';
const TODAY = '2026-08-26';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'kasrat-rules-test',
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();

  // Seed both people as real accounts, bypassing rules the way the console or
  // a Cloud Function would.
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    for (const [uid, handle] of [
      [ALICE, 'alice'],
      [BOB, 'bob'],
    ]) {
      await setDoc(doc(db, 'handles', handle), { uid });
      await setDoc(doc(db, 'profiles', uid), {
        name: uid,
        handle: `@${handle}`,
        handleLower: handle,
      });
      await setDoc(doc(db, 'users', uid), { fcmToken: `token-${uid}` });
    }
  });
});

const asAlice = () => env.authenticatedContext(ALICE).firestore();
const asBob = () => env.authenticatedContext(BOB).firestore();
const asAnon = () => env.unauthenticatedContext().firestore();

const pokeDoc = (from: string, to: string, kind: string, day: string) =>
  `${from}_${to}_${kind}_${day}`;

const pokePayload = (from: string, to: string, kind = 'poke', day = TODAY) => ({
  fromUid: from,
  toUid: to,
  kind,
  day,
  message: 'is thinking of you.',
  read: false,
  createdAt: serverTimestamp(),
});

describe('profiles', () => {
  it('lets a signed-in user read a stranger profile, so search works', async () => {
    await assertSucceeds(getDoc(doc(asAlice(), 'profiles', BOB)));
  });

  it('refuses profile reads to anyone not signed in', async () => {
    await assertFails(getDoc(doc(asAnon(), 'profiles', BOB)));
  });

  it('refuses a profile carrying a handle claimed by someone else', async () => {
    // The whole point of the claim document: Alice cannot publish as @bob.
    await assertFails(
      setDoc(doc(asAlice(), 'profiles', ALICE), {
        name: 'Alice',
        handle: '@bob',
        handleLower: 'bob',
      }),
    );
  });

  it('refuses writing to another user profile', async () => {
    await assertFails(
      setDoc(doc(asAlice(), 'profiles', BOB), {
        name: 'Not Bob',
        handle: '@bob',
        handleLower: 'bob',
      }),
    );
  });

  it('refuses a malformed handle', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'handles', 'ab'), { uid: ALICE });
    });
    await assertFails(
      setDoc(doc(asAlice(), 'profiles', ALICE), {
        name: 'Alice',
        handle: '@ab',
        handleLower: 'ab', // too short
      }),
    );
  });
});

describe('handles', () => {
  it('refuses claiming a handle for somebody else', async () => {
    await assertFails(setDoc(doc(asAlice(), 'handles', 'newname'), { uid: BOB }));
  });

  it('allows claiming a free handle for yourself', async () => {
    await assertSucceeds(setDoc(doc(asAlice(), 'handles', 'newname'), { uid: ALICE }));
  });

  it('refuses stealing an existing claim', async () => {
    // create-only: Alice cannot overwrite Bob's claim even though she is signed in.
    await assertFails(setDoc(doc(asAlice(), 'handles', 'bob'), { uid: ALICE }));
  });
});

describe('private user document', () => {
  it('never lets one user read another push token', async () => {
    // The single most important rule here: friend search must not become a
    // way to harvest FCM tokens.
    await assertFails(getDoc(doc(asAlice(), 'users', BOB)));
  });

  it('lets a user read their own', async () => {
    await assertSucceeds(getDoc(doc(asAlice(), 'users', ALICE)));
  });
});

describe('friends', () => {
  it('lets a user manage their own list', async () => {
    await assertSucceeds(
      setDoc(doc(asAlice(), 'users', ALICE, 'friends', BOB), {
        name: 'Bob',
        handle: '@bob',
      }),
    );
  });

  it('refuses reading someone else list', async () => {
    await assertFails(getDoc(doc(asAlice(), 'users', BOB, 'friends', ALICE)));
  });

  it('refuses adding yourself to someone else list', async () => {
    await assertFails(
      setDoc(doc(asAlice(), 'users', BOB, 'friends', ALICE), {
        name: 'Alice',
        handle: '@alice',
      }),
    );
  });
});

describe('nudges', () => {
  it('lets you nudge a real account', async () => {
    await assertSucceeds(
      setDoc(
        doc(asAlice(), 'pokes', pokeDoc(ALICE, BOB, 'poke', TODAY)),
        pokePayload(ALICE, BOB),
      ),
    );
  });

  it('enforces the daily cap structurally', async () => {
    const ref = pokeDoc(ALICE, BOB, 'poke', TODAY);
    await assertSucceeds(
      setDoc(doc(asAlice(), 'pokes', ref), pokePayload(ALICE, BOB)),
    );
    // Second one the same day collides: create-only, and the id is taken.
    await assertFails(
      setDoc(doc(asAlice(), 'pokes', ref), pokePayload(ALICE, BOB)),
    );
  });

  it('counts a challenge separately from a nudge', async () => {
    await assertSucceeds(
      setDoc(
        doc(asAlice(), 'pokes', pokeDoc(ALICE, BOB, 'poke', TODAY)),
        pokePayload(ALICE, BOB, 'poke'),
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(asAlice(), 'pokes', pokeDoc(ALICE, BOB, 'challenge', TODAY)),
        pokePayload(ALICE, BOB, 'challenge'),
      ),
    );
  });

  it('refuses a nudge whose id does not match its contents', async () => {
    // Without this, a client could pick a fresh id every time and the cap
    // would be decorative.
    await assertFails(
      setDoc(doc(asAlice(), 'pokes', 'anything-i-like'), pokePayload(ALICE, BOB)),
    );
  });

  it('refuses forging the sender', async () => {
    await assertFails(
      setDoc(
        doc(asAlice(), 'pokes', pokeDoc(BOB, ALICE, 'poke', TODAY)),
        pokePayload(BOB, ALICE),
      ),
    );
  });

  it('refuses nudging a uid with no account', async () => {
    await assertFails(
      setDoc(
        doc(asAlice(), 'pokes', pokeDoc(ALICE, 'ghost', 'poke', TODAY)),
        pokePayload(ALICE, 'ghost'),
      ),
    );
  });

  it('refuses nudging yourself', async () => {
    await assertFails(
      setDoc(
        doc(asAlice(), 'pokes', pokeDoc(ALICE, ALICE, 'poke', TODAY)),
        pokePayload(ALICE, ALICE),
      ),
    );
  });

  it('refuses an unknown kind', async () => {
    await assertFails(
      setDoc(
        doc(asAlice(), 'pokes', pokeDoc(ALICE, BOB, 'shout', TODAY)),
        pokePayload(ALICE, BOB, 'shout'),
      ),
    );
  });

  it('refuses creating one already marked read', async () => {
    await assertFails(
      setDoc(doc(asAlice(), 'pokes', pokeDoc(ALICE, BOB, 'poke', TODAY)), {
        ...pokePayload(ALICE, BOB),
        read: true,
      }),
    );
  });

  it('lets both parties read it and nobody else', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(
        doc(ctx.firestore(), 'pokes', pokeDoc(ALICE, BOB, 'poke', TODAY)),
        { ...pokePayload(ALICE, BOB), createdAt: new Date() },
      );
    });
    const id = pokeDoc(ALICE, BOB, 'poke', TODAY);
    await assertSucceeds(getDoc(doc(asAlice(), 'pokes', id)));
    await assertSucceeds(getDoc(doc(asBob(), 'pokes', id)));
    await assertFails(getDoc(doc(asAnon(), 'pokes', id)));
  });

  it('lets the recipient mark it read, and only that field', async () => {
    const id = pokeDoc(ALICE, BOB, 'poke', TODAY);
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'pokes', id), {
        ...pokePayload(ALICE, BOB),
        createdAt: new Date(),
      });
    });

    await assertSucceeds(updateDoc(doc(asBob(), 'pokes', id), { read: true }));
    // The sender is not the one who reads it.
    await assertFails(updateDoc(doc(asAlice(), 'pokes', id), { read: true }));
    // And nobody gets to rewrite the nudge itself.
    await assertFails(
      updateDoc(doc(asBob(), 'pokes', id), { read: true, kind: 'challenge' }),
    );
  });

  it('never lets anyone delete a nudge', async () => {
    const id = pokeDoc(ALICE, BOB, 'poke', TODAY);
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'pokes', id), {
        ...pokePayload(ALICE, BOB),
        createdAt: new Date(),
      });
    });
    await assertFails(deleteDoc(doc(asAlice(), 'pokes', id)));
    await assertFails(deleteDoc(doc(asBob(), 'pokes', id)));
  });
});
