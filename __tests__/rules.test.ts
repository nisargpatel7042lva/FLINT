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
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

import { cityRunId } from '../src/services/cityId';

const ALICE = 'alice';
const BOB = 'bob';
const TODAY = '2026-08-26';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'flint-rules-test',
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

  const aliceProfile = (extra: Record<string, unknown> = {}) => ({
    name: 'Alice',
    handle: '@alice',
    handleLower: 'alice',
    ...extra,
  });

  it('accepts a small JPEG profile photo', async () => {
    await assertSucceeds(
      setDoc(
        doc(asAlice(), 'profiles', ALICE),
        aliceProfile({ photo: 'data:image/jpeg;base64,' + 'A'.repeat(20000) }),
      ),
    );
  });

  it('refuses an oversized photo, a non-JPEG one, and fields a profile has no use for', async () => {
    await assertFails(
      setDoc(
        doc(asAlice(), 'profiles', ALICE),
        aliceProfile({ photo: 'data:image/jpeg;base64,' + 'A'.repeat(160000) }),
      ),
    );
    await assertFails(
      setDoc(
        doc(asAlice(), 'profiles', ALICE),
        aliceProfile({ photo: 'data:text/html;base64,PHNjcmlwdD4=' }),
      ),
    );
    await assertFails(
      setDoc(doc(asAlice(), 'profiles', ALICE), aliceProfile({ phone: '+919999999999' })),
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

describe('groups', () => {
  const GROUP = 'g-iron';
  const CODE = 'WOLF42';
  const CAROL = 'carol';

  /** A group owned by Alice, with the given members. Written past the rules. */
  const seedGroup = (members: string[] = [ALICE], owner = ALICE) =>
    env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'groups', GROUP), {
        name: 'Iron Wolves',
        code: CODE,
        ownerUid: owner,
        memberIds: members,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'groupCodes', CODE), { groupId: GROUP });
    });

  describe('creating', () => {
    it('lets you create a group you own, alone', async () => {
      const db = env.authenticatedContext(ALICE).firestore();
      await assertSucceeds(
        setDoc(doc(db, 'groups', GROUP), {
          name: 'Iron Wolves',
          code: CODE,
          ownerUid: ALICE,
          memberIds: [ALICE],
          createdAt: serverTimestamp(),
        }),
      );
    });

    it('refuses creating a group owned by somebody else', async () => {
      const db = env.authenticatedContext(ALICE).firestore();
      await assertFails(
        setDoc(doc(db, 'groups', GROUP), {
          name: 'Iron Wolves',
          code: CODE,
          ownerUid: BOB,
          memberIds: [BOB],
          createdAt: serverTimestamp(),
        }),
      );
    });

    it('refuses seeding it with people who never agreed to join', async () => {
      const db = env.authenticatedContext(ALICE).firestore();
      await assertFails(
        setDoc(doc(db, 'groups', GROUP), {
          name: 'Iron Wolves',
          code: CODE,
          ownerUid: ALICE,
          memberIds: [ALICE, BOB],
          createdAt: serverTimestamp(),
        }),
      );
    });

    it('refuses an empty or oversized name', async () => {
      const db = env.authenticatedContext(ALICE).firestore();
      const base = {
        code: CODE,
        ownerUid: ALICE,
        memberIds: [ALICE],
        createdAt: serverTimestamp(),
      };
      await assertFails(setDoc(doc(db, 'groups', 'g-empty'), { ...base, name: '' }));
      await assertFails(
        setDoc(doc(db, 'groups', 'g-long'), { ...base, name: 'x'.repeat(61) }),
      );
    });

    it('refuses an anonymous stranger entirely', async () => {
      const db = env.unauthenticatedContext().firestore();
      await assertFails(
        setDoc(doc(db, 'groups', GROUP), {
          name: 'Iron Wolves',
          code: CODE,
          ownerUid: ALICE,
          memberIds: [ALICE],
          createdAt: serverTimestamp(),
        }),
      );
    });
  });

  describe('reading', () => {
    it('lets a member read it', async () => {
      await seedGroup([ALICE, BOB]);
      const db = env.authenticatedContext(BOB).firestore();
      await assertSucceeds(getDoc(doc(db, 'groups', GROUP)));
    });

    it('refuses somebody who is not in it', async () => {
      await seedGroup([ALICE]);
      const db = env.authenticatedContext(BOB).firestore();
      await assertFails(getDoc(doc(db, 'groups', GROUP)));
    });
  });

  describe('joining', () => {
    /*
     * The load-bearing case. A joiner cannot READ the group yet, so the rule
     * has to permit an update from a non-member - while allowing them to add
     * nobody but themselves.
     */
    it('lets a non-member add themselves', async () => {
      await seedGroup([ALICE]);
      const db = env.authenticatedContext(BOB).firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'groups', GROUP), { memberIds: arrayUnion(BOB) }),
      );
    });

    it('refuses adding somebody else', async () => {
      await seedGroup([ALICE]);
      const db = env.authenticatedContext(BOB).firestore();
      await assertFails(
        updateDoc(doc(db, 'groups', GROUP), { memberIds: arrayUnion(CAROL) }),
      );
    });

    it('refuses smuggling a third party in alongside yourself', async () => {
      await seedGroup([ALICE]);
      const db = env.authenticatedContext(BOB).firestore();
      await assertFails(
        updateDoc(doc(db, 'groups', GROUP), { memberIds: [ALICE, BOB, CAROL] }),
      );
    });

    it('refuses taking the group over while joining', async () => {
      await seedGroup([ALICE]);
      const db = env.authenticatedContext(BOB).firestore();
      await assertFails(
        updateDoc(doc(db, 'groups', GROUP), {
          memberIds: arrayUnion(BOB),
          ownerUid: BOB,
        }),
      );
    });

    it('refuses renaming a group you do not own', async () => {
      await seedGroup([ALICE, BOB]);
      const db = env.authenticatedContext(BOB).firestore();
      await assertFails(updateDoc(doc(db, 'groups', GROUP), { name: 'Bob Wolves' }));
    });

    it('lets anyone signed in resolve a code they already know', async () => {
      await seedGroup([ALICE]);
      const db = env.authenticatedContext(BOB).firestore();
      await assertSucceeds(getDoc(doc(db, 'groupCodes', CODE)));
    });

    it('never lets a code be repointed at another group', async () => {
      await seedGroup([ALICE]);
      const db = env.authenticatedContext(BOB).firestore();
      await assertFails(
        setDoc(doc(db, 'groupCodes', CODE), { groupId: 'g-somewhere-else' }),
      );
    });

    it('refuses a code reservation carrying anything but a group id', async () => {
      const db = env.authenticatedContext(ALICE).firestore();
      await assertFails(
        setDoc(doc(db, 'groupCodes', 'NEWONE'), { groupId: GROUP, ownerUid: ALICE }),
      );
    });
  });

  describe('leaving and removing', () => {
    it('lets a member remove themselves', async () => {
      await seedGroup([ALICE, BOB]);
      const db = env.authenticatedContext(BOB).firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'groups', GROUP), { memberIds: arrayRemove(BOB) }),
      );
    });

    it('refuses a member removing anybody else', async () => {
      await seedGroup([ALICE, BOB, CAROL]);
      const db = env.authenticatedContext(BOB).firestore();
      await assertFails(
        updateDoc(doc(db, 'groups', GROUP), { memberIds: arrayRemove(CAROL) }),
      );
    });

    it('lets the owner remove somebody', async () => {
      await seedGroup([ALICE, BOB]);
      const db = env.authenticatedContext(ALICE).firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'groups', GROUP), { memberIds: arrayRemove(BOB) }),
      );
    });

    it('lets the owner add a friend directly', async () => {
      await seedGroup([ALICE]);
      const db = env.authenticatedContext(ALICE).firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'groups', GROUP), { memberIds: arrayUnion(BOB) }),
      );
    });

    it('lets only the owner delete it', async () => {
      await seedGroup([ALICE, BOB]);
      const bob = env.authenticatedContext(BOB).firestore();
      await assertFails(deleteDoc(doc(bob, 'groups', GROUP)));

      const alice = env.authenticatedContext(ALICE).firestore();
      await assertSucceeds(deleteDoc(doc(alice, 'groups', GROUP)));
    });
  });
});

describe('challenges and their streaks', () => {
  const CHALLENGE = 'c-30day';
  const CAROL = 'carol';

  /** A live challenge between Alice and Bob, written past the rules. */
  const seedChallenge = (opponentId: string | null = BOB) =>
    env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'challenges', CHALLENGE), {
        type: 'one_on_one',
        title: '30-day Run Streak',
        inviteTokenHash: 'a'.repeat(64),
        activityKind: 'run',
        creatorId: ALICE,
        opponentId,
        groupId: 'g-pair',
        targetDays: 30,
        sessionsPerDay: 1,
        status: opponentId ? 'active' : 'pending',
        createdAt: serverTimestamp(),
      });
      for (const uid of [ALICE, opponentId].filter(Boolean) as string[]) {
        await setDoc(doc(db, 'challengeStreaks', `${CHALLENGE}_${uid}`), {
          challengeId: CHALLENGE,
          userId: uid,
          currentStreak: 4,
          bestStreak: 9,
          totalActiveDays: 11,
        });
      }
    });

  describe('the challenge itself', () => {
    it('lets both participants read it', async () => {
      await seedChallenge();
      for (const uid of [ALICE, BOB]) {
        const db = env.authenticatedContext(uid).firestore();
        await assertSucceeds(getDoc(doc(db, 'challenges', CHALLENGE)));
      }
    });

    it('refuses a bystander', async () => {
      await seedChallenge();
      const db = env.authenticatedContext(CAROL).firestore();
      await assertFails(getDoc(doc(db, 'challenges', CHALLENGE)));
    });

    it('never lets a client create one directly', async () => {
      const db = env.authenticatedContext(ALICE).firestore();
      await assertFails(
        setDoc(doc(db, 'challenges', 'c-forged'), {
          creatorId: ALICE,
          opponentId: BOB,
          status: 'active',
          targetDays: 30,
        }),
      );
    });

    it('refuses a participant rewriting who is in it, or the token', async () => {
      await seedChallenge();
      const db = env.authenticatedContext(BOB).firestore();
      await assertFails(
        updateDoc(doc(db, 'challenges', CHALLENGE), { opponentId: CAROL }),
      );
      await assertFails(
        updateDoc(doc(db, 'challenges', CHALLENGE), { inviteTokenHash: 'b'.repeat(64) }),
      );
      await assertFails(
        updateDoc(doc(db, 'challenges', CHALLENGE), { targetDays: 1 }),
      );
    });
  });

  describe('challenge streaks', () => {
    /*
     * The regression this exists for. `allow read: if isAuthenticated()` let
     * any signed-in account read every streak document in the database, and
     * the ids are `{challengeId}_{uid}` - guessable by construction.
     */
    it('refuses a bystander reading somebody else\u2019s streak', async () => {
      await seedChallenge();
      const db = env.authenticatedContext(CAROL).firestore();
      await assertFails(getDoc(doc(db, 'challengeStreaks', `${CHALLENGE}_${ALICE}`)));
    });

    it('lets you read your own', async () => {
      await seedChallenge();
      const db = env.authenticatedContext(ALICE).firestore();
      await assertSucceeds(getDoc(doc(db, 'challengeStreaks', `${CHALLENGE}_${ALICE}`)));
    });

    /* Seeing the other person's number IS the feature. */
    it('lets you read your opponent\u2019s', async () => {
      await seedChallenge();
      const db = env.authenticatedContext(BOB).firestore();
      await assertSucceeds(getDoc(doc(db, 'challengeStreaks', `${CHALLENGE}_${ALICE}`)));
    });

    it('never lets anyone write one', async () => {
      await seedChallenge();
      const db = env.authenticatedContext(ALICE).firestore();
      await assertFails(
        updateDoc(doc(db, 'challengeStreaks', `${CHALLENGE}_${ALICE}`), {
          currentStreak: 999,
        }),
      );
    });
  });

  describe('abuse counters', () => {
    it('are invisible to clients, so nobody can see guesses remaining', async () => {
      await env.withSecurityRulesDisabled(async ctx => {
        await setDoc(doc(ctx.firestore(), 'rateLimits', `tokenGuess_${ALICE}`), {
          count: 3,
          windowStart: Date.now(),
        });
      });
      const db = env.authenticatedContext(ALICE).firestore();
      await assertFails(getDoc(doc(db, 'rateLimits', `tokenGuess_${ALICE}`)));
      await assertFails(
        setDoc(doc(db, 'rateLimits', `tokenGuess_${ALICE}`), { count: 0 }),
      );
    });
  });
});

describe('club runs', () => {
  const CLUB = 'club-sunrise';
  const CAROL = 'carol';
  const STARTED = 1_790_000_000_000;

  const seedClub = () =>
    env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'groups', CLUB), {
        name: 'Sunrise Runners',
        kind: 'club',
        code: 'RISE44',
        ownerUid: ALICE,
        memberIds: [ALICE, BOB],
        createdAt: serverTimestamp(),
      });
    });

  /** A legitimate 5km in 30 minutes. */
  const run = (uid: string, overrides: Record<string, unknown> = {}) => ({
    uid,
    kind: 'run',
    distanceKm: 5,
    durationSec: 1800,
    day: '2026-10-01',
    createdAt: serverTimestamp(),
    ...overrides,
  });

  type Db = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>;
  const runDoc = (db: Db, id: string) => doc(db, 'groups', CLUB, 'runs', id);

  it('lets a member post their own run', async () => {
    await seedClub();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(runDoc(db, `${ALICE}_${STARTED}`), run(ALICE)));
  });

  it('lets members read the feed and keeps everyone else out', async () => {
    await seedClub();
    const alice = env.authenticatedContext(ALICE).firestore();
    await setDoc(runDoc(alice, `${ALICE}_${STARTED}`), run(ALICE));

    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(getDoc(runDoc(bob, `${ALICE}_${STARTED}`)));

    const carol = env.authenticatedContext(CAROL).firestore();
    await assertFails(getDoc(runDoc(carol, `${ALICE}_${STARTED}`)));
  });

  it('refuses a non-member posting into the club', async () => {
    await seedClub();
    const db = env.authenticatedContext(CAROL).firestore();
    await assertFails(setDoc(runDoc(db, `${CAROL}_${STARTED}`), run(CAROL)));
  });

  it('refuses posting a run as somebody else', async () => {
    await seedClub();
    const db = env.authenticatedContext(BOB).firestore();
    // Body claims Alice.
    await assertFails(setDoc(runDoc(db, `${ALICE}_${STARTED}`), run(ALICE)));
    // Body claims Bob, id claims Alice.
    await assertFails(setDoc(runDoc(db, `${ALICE}_${STARTED}`), run(BOB)));
  });

  it('refuses posting the same run twice', async () => {
    await seedClub();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(runDoc(db, `${ALICE}_${STARTED}`), run(ALICE)));
    // A second write to the same id is an update, and runs are never updated.
    await assertFails(
      setDoc(runDoc(db, `${ALICE}_${STARTED}`), run(ALICE, { distanceKm: 42 })),
    );
  });

  /*
   * The anti-cheat floor. 10km in 15 minutes is 1:30/km — a car. Without this
   * one drive logged as a run would top the club board for the whole week.
   */
  it('refuses a pace no human can run', async () => {
    await seedClub();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(
        runDoc(db, `${ALICE}_${STARTED}`),
        run(ALICE, { distanceKm: 10, durationSec: 900 }),
      ),
    );
  });

  it('accepts an elite but human pace', async () => {
    await seedClub();
    const db = env.authenticatedContext(ALICE).firestore();
    // 10km in 30:00 is 3:00/km — very fast, entirely real.
    await assertSucceeds(
      setDoc(
        runDoc(db, `${ALICE}_${STARTED}`),
        run(ALICE, { distanceKm: 10, durationSec: 1800 }),
      ),
    );
  });

  it('refuses impossible distances and smuggled fields', async () => {
    await seedClub();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(runDoc(db, `${ALICE}_1`), run(ALICE, { distanceKm: 250, durationSec: 86000 })),
    );
    await assertFails(
      setDoc(runDoc(db, `${ALICE}_2`), run(ALICE, { kind: 'drive' })),
    );
    await assertFails(
      setDoc(runDoc(db, `${ALICE}_3`), run(ALICE, { verified: true })),
    );
  });

  it('refuses a backdated timestamp', async () => {
    await seedClub();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(
        runDoc(db, `${ALICE}_${STARTED}`),
        run(ALICE, { createdAt: new Date('2026-01-01T06:00:00Z') }),
      ),
    );
  });

  it('lets you delete your own run, and nobody else\u2019s', async () => {
    await seedClub();
    const alice = env.authenticatedContext(ALICE).firestore();
    await setDoc(runDoc(alice, `${ALICE}_${STARTED}`), run(ALICE));

    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(deleteDoc(runDoc(bob, `${ALICE}_${STARTED}`)));
    await assertSucceeds(deleteDoc(runDoc(alice, `${ALICE}_${STARTED}`)));
  });

  it('only accepts club or squad as a group kind', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    const base = {
      name: 'Night Owls',
      code: 'OWLS33',
      ownerUid: ALICE,
      memberIds: [ALICE],
      createdAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(db, 'groups', 'g-a'), { ...base, kind: 'club' }));
    await assertSucceeds(setDoc(doc(db, 'groups', 'g-b'), { ...base, kind: 'squad' }));
    await assertFails(setDoc(doc(db, 'groups', 'g-c'), { ...base, kind: 'admin' }));
  });
});

describe('excuses', () => {
  const CHALLENGE = 'c-excuse';
  const CAROL = 'carol';
  const DAY = '2026-10-01';

  type Db = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>;
  const excuseDoc = (db: Db, id: string) => doc(db, 'challenges', CHALLENGE, 'excuses', id);

  const seed = () =>
    env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'challenges', CHALLENGE), {
        type: 'one_on_one',
        creatorId: ALICE,
        opponentId: BOB,
        status: 'active',
        targetDays: 30,
      });
    });

  const excuse = (uid: string, overrides: Record<string, unknown> = {}) => ({
    uid,
    day: DAY,
    reason: 'motivation',
    createdAt: serverTimestamp(),
    ...overrides,
  });

  it('lets a participant file their own excuse, and the rival read it', async () => {
    await seed();
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(excuseDoc(alice, `${ALICE}_${DAY}`), excuse(ALICE)));

    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(getDoc(excuseDoc(bob, `${ALICE}_${DAY}`)));
  });

  it('keeps bystanders out entirely', async () => {
    await seed();
    const alice = env.authenticatedContext(ALICE).firestore();
    await setDoc(excuseDoc(alice, `${ALICE}_${DAY}`), excuse(ALICE));

    const carol = env.authenticatedContext(CAROL).firestore();
    await assertFails(getDoc(excuseDoc(carol, `${ALICE}_${DAY}`)));
    await assertFails(setDoc(excuseDoc(carol, `${CAROL}_${DAY}`), excuse(CAROL)));
  });

  it('refuses filing an excuse on your rival\’s behalf', async () => {
    await seed();
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(setDoc(excuseDoc(bob, `${ALICE}_${DAY}`), excuse(ALICE)));
    await assertFails(setDoc(excuseDoc(bob, `${ALICE}_${DAY}`), excuse(BOB)));
  });

  /* The tax: once "couldn't be bothered" is said, it stays said. */
  it('never lets an excuse be softened after the fact', async () => {
    await seed();
    const alice = env.authenticatedContext(ALICE).firestore();
    await setDoc(excuseDoc(alice, `${ALICE}_${DAY}`), excuse(ALICE));
    await assertFails(
      setDoc(excuseDoc(alice, `${ALICE}_${DAY}`), excuse(ALICE, { reason: 'rest' })),
    );
    await assertFails(deleteDoc(excuseDoc(alice, `${ALICE}_${DAY}`)));
  });

  it('refuses an id that does not match the day, or an unknown reason', async () => {
    await seed();
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(excuseDoc(alice, `${ALICE}_2026-09-01`), excuse(ALICE)));
    await assertFails(
      setDoc(excuseDoc(alice, `${ALICE}_${DAY}`), excuse(ALICE, { reason: 'dog ate it' })),
    );
  });
});

describe('city runs', () => {
  const CLUB = 'clubowls';
  const SQUAD = 'squadpals';
  const CAROL = 'carol';
  const STARTED = 1_790_000_000_000;

  type Db = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>;

  const seed = () =>
    env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'groups', CLUB), {
        name: 'Night Owls',
        kind: 'club',
        code: 'OWLS22',
        ownerUid: ALICE,
        memberIds: [ALICE, BOB],
      });
      await setDoc(doc(db, 'groups', SQUAD), {
        name: 'Pals',
        kind: 'squad',
        code: 'PALS22',
        ownerUid: ALICE,
        memberIds: [ALICE],
      });
    });

  const clubRun = (uid: string, overrides: Record<string, unknown> = {}) => ({
    uid,
    kind: 'run',
    distanceKm: 5,
    durationSec: 1800,
    day: '2026-10-01',
    createdAt: serverTimestamp(),
    ...overrides,
  });

  const cityRun = (overrides: Record<string, unknown> = {}) => ({
    clubId: CLUB,
    clubName: 'Night Owls',
    cells: ['18530:61540', '18531:61540'],
    region: '89:292',
    runMs: STARTED,
    createdAt: serverTimestamp(),
    ...overrides,
  });

  /** The club run and the city run, in one batch, as the app writes them. */
  const post = (
    db: Db,
    uid: string,
    opts: {
      club?: string;
      city?: Record<string, unknown>;
      run?: Record<string, unknown>;
      id?: string;
      skipClubRun?: boolean;
    } = {},
  ) => {
    const club = opts.club ?? CLUB;
    const batch = writeBatch(db);
    if (!opts.skipClubRun) {
      batch.set(doc(db, 'groups', club, 'runs', `${uid}_${STARTED}`), clubRun(uid, opts.run));
    }
    batch.set(
      doc(db, 'cityRuns', opts.id ?? cityRunId(uid, STARTED, club)),
      cityRun({ clubId: club, ...opts.city }),
    );
    return batch.commit();
  };

  it('lets a club member light blocks with a real run', async () => {
    await seed();
    await assertSucceeds(post(asAlice(), ALICE));
  });

  it('stores nothing that says who ran: no uid in the document or its id', async () => {
    await seed();
    await post(asAlice(), ALICE);
    const id = cityRunId(ALICE, STARTED, CLUB);
    expect(id).not.toContain(ALICE);
    const snap = await getDoc(doc(env.authenticatedContext(CAROL).firestore(), 'cityRuns', id));
    expect(Object.keys(snap.data() ?? {}).sort()).toEqual(
      ['cells', 'clubId', 'clubName', 'createdAt', 'region', 'runMs'],
    );
  });

  it("refuses a city run that carries the runner's uid", async () => {
    await seed();
    await assertFails(post(asAlice(), ALICE, { city: { uid: ALICE } }));
  });

  it('lets anyone signed in see the map, and nobody signed out', async () => {
    await seed();
    await post(asAlice(), ALICE);
    const id = cityRunId(ALICE, STARTED, CLUB);
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertSucceeds(getDoc(doc(carol, 'cityRuns', id)));
    await assertFails(getDoc(doc(asAnon(), 'cityRuns', id)));
  });

  it('refuses blocks with no club run behind them', async () => {
    await seed();
    await assertFails(post(asAlice(), ALICE, { skipClubRun: true }));
  });

  it('refuses blocks lit by a run the club board would refuse', async () => {
    await seed();
    // 10 km in 15 minutes: a car.
    await assertFails(post(asAlice(), ALICE, { run: { distanceKm: 10, durationSec: 900 } }));
  });

  it('refuses lighting the city twice with one run', async () => {
    await seed();
    await assertSucceeds(post(asAlice(), ALICE));
    // Same run, same id: a second write is an update, and those are refused.
    await assertFails(
      setDoc(doc(asAlice(), 'cityRuns', cityRunId(ALICE, STARTED, CLUB)), cityRun()),
    );
  });

  it('refuses an id that is not the hash of this runner, run and club', async () => {
    await seed();
    await assertFails(post(asAlice(), ALICE, { id: 'made-up-id' }));
    // The hash of somebody else's run: an attempt to post as Bob.
    await assertFails(post(asAlice(), ALICE, { id: cityRunId(BOB, STARTED, CLUB) }));
  });

  it("refuses borrowing a clubmate's run", async () => {
    await seed();
    // Alice's run exists; Bob points his city run at its time.
    await post(asAlice(), ALICE);
    await assertFails(post(asBob(), BOB, { skipClubRun: true }));
  });

  it('refuses lighting blocks for a club you are not in', async () => {
    await seed();
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertFails(post(carol, CAROL));
  });

  it('refuses lighting blocks for a squad', async () => {
    await seed();
    await assertFails(post(asAlice(), ALICE, { club: SQUAD, city: { clubName: 'Pals' } }));
  });

  it('refuses a made-up club name on the map', async () => {
    await seed();
    await assertFails(post(asAlice(), ALICE, { city: { clubName: 'Owls are slow' } }));
  });

  it('refuses extra fields, like a route', async () => {
    await seed();
    await assertFails(post(asAlice(), ALICE, { city: { route: [22.3, 73.1, 22.31, 73.1] } }));
  });

  it('refuses an empty run and an oversized one', async () => {
    await seed();
    await assertFails(post(asAlice(), ALICE, { city: { cells: [] } }));
    const huge = Array.from({ length: 401 }, (_, i) => `1:${i}`);
    await assertFails(post(asAlice(), ALICE, { city: { cells: huge } }));
  });

  it('never lets a city run be edited or deleted', async () => {
    await seed();
    await post(asAlice(), ALICE);
    const id = cityRunId(ALICE, STARTED, CLUB);
    await assertFails(updateDoc(doc(asAlice(), 'cityRuns', id), { cells: ['1:1'] }));
    await assertFails(deleteDoc(doc(asAlice(), 'cityRuns', id)));
  });
});

describe('feedback', () => {
  const report = (uid: string, overrides: Record<string, unknown> = {}) => ({
    uid,
    message: 'The map did not load on my Redmi.',
    kind: 'bug',
    screen: 'City',
    appVersion: '0.1.0 (1)',
    device: 'Xiaomi Redmi Note 12 · Android 14',
    createdAt: serverTimestamp(),
    ...overrides,
  });

  it('lets a signed-in tester send a report', async () => {
    await assertSucceeds(setDoc(doc(asAlice(), 'feedback', 'f1'), report(ALICE)));
  });

  it('never lets anyone read reports back, the author included', async () => {
    await setDoc(doc(asAlice(), 'feedback', 'f1'), report(ALICE));
    await assertFails(getDoc(doc(asAlice(), 'feedback', 'f1')));
    await assertFails(getDoc(doc(asBob(), 'feedback', 'f1')));
  });

  it('refuses reports signed as somebody else, empty or oversized', async () => {
    await assertFails(setDoc(doc(asBob(), 'feedback', 'f2'), report(ALICE)));
    await assertFails(setDoc(doc(asAlice(), 'feedback', 'f3'), report(ALICE, { message: '' })));
    await assertFails(
      setDoc(doc(asAlice(), 'feedback', 'f4'), report(ALICE, { message: 'x'.repeat(2001) })),
    );
    await assertFails(setDoc(doc(asAnon(), 'feedback', 'f5'), report(ALICE)));
  });

  it('refuses extra fields', async () => {
    await assertFails(
      setDoc(doc(asAlice(), 'feedback', 'f6'), report(ALICE, { email: 'a@b.c' })),
    );
  });
});
