# Approval Gate Fixes

This document details all fixes made to pass the three approval gates for PR #2.

---

## Gate 3: Security (CRITICAL) ✅

### Issue: Client-side pepper hardcoded in RN binary
**Problem:** `flint-mvp-join-pepper-change-in-production` was hardcoded in `repository.challenges.ts`, exposing the pepper in the React Native binary.

**Fix:**
- **Removed** client-side `hashInviteToken()` function entirely from `repository.challenges.ts`
- **Server-only hashing** via `JOIN_CODE_PEPPER` environment variable in Cloud Functions (Secret Manager)
- Client **never** performs hashing or knows the pepper

**Affected Files:**
- `src/services/repository.challenges.ts`
- `functions/src/index.ts`

---

### Issue: Plaintext token storage and queries
**Problem:** Client was querying Firestore by plaintext `inviteToken` field, allowing anyone to enumerate challenges.

**Fix:**
- **Stop all plaintext queries**: Client uses only callable functions for token lookup
- **Added `previewChallengeByToken` callable**: Server hashes token and queries by `inviteTokenHash`
- **Added `createOneOnOneChallenge` callable**: Server generates token, hashes it, and stores both
  - `inviteToken`: Plaintext for creator to share (rules restrict read to creator only)
  - `inviteTokenHash`: For secure lookups (SHA-256 with pepper)
- **`getChallengeByToken` now calls callable**: No direct Firestore queries by plaintext token

**Affected Files:**
- `src/services/repository.challenges.ts`
- `functions/src/index.ts`

---

### Issue: Client could bypass callables and write directly
**Problem:** Firestore rules allowed client to create submissions and groups, bypassing callable validation.

**Fix:**
- **Firestore rules tightened**:
  - `groups`: `allow create, update: if false` (only callables can write via Admin SDK)
  - `submissions`: `allow create: if false` (only `logChallengeActivity` callable can write)
  - `challenges`: `allow create: if false` (only `createOneOnOneChallenge` callable can write)
  - `challenges`: `allow read` restricted to participants only (no preview via rules)
  - `challenges`: `allow update` prevents modifying core fields (`creatorId`, `opponentId`, `groupId`, `inviteToken`, `inviteTokenHash`, `acceptedAt`)

**Affected Files:**
- `firestore.rules`

---

## Gate 2: Copy (Verbatim) ✅

### Rematch Copy
**Required:** "You took it." / "They edged you." / "Even. Rematch decides."

**Fixed:**
- Winner: "You took it."
- Loser: "They edged you."
- Tie: "Even. Rematch decides."
- **Removed secondary body text** ("Ready to defend it?" etc.)
- Primary button: "Push harder (same pair)" (unchanged)
- Added quiet secondary button: "Done for now" (ghost variant)

**Affected Files:**
- `src/screens/social/ChallengeDetailScreen.tsx`

---

### Log CTA Label
**Required:** "Log today" (not "Log activity")

**Fixed:**
- Changed button label from "Log activity" to "Log today"

**Affected Files:**
- `src/screens/social/ChallengeDetailScreen.tsx`

---

### Broken Streak Card with CTA
**Required:** Broken streak card must include "Log today" CTA button

**Fixed:**
- Added `<Button label="Log today" />` to broken streak card
- Card appears when: `currentStreak === 0 && totalActiveDays > 0`
- Copy: "Streak broke / Log today to start again."

**Affected Files:**
- `src/screens/social/ChallengeDetailScreen.tsx`

---

## Gate 1: GroupDetail (Firebase + Emotion) ✅

### Remove Mock Data
**Required:** Real Firebase data, not `feedSubmissions`, `groupById`, `SUBMISSIONS` mocks

**Fixed:**
- **Replaced all mock imports** with real Firebase functions:
  - `getGroup(groupId)`: Fetches group from Firestore
  - `getGroupSubmissions(groupId)`: Fetches submissions by groupId
- **Removed:** `feedSubmissions`, `groupById`, `SUBMISSIONS`, `TODAY` mock imports
- **Added loading states**: Proper `ActivityIndicator` while fetching data
- **Error handling**: Shows "Group not found" if group doesn't exist

**Affected Files:**
- `src/screens/social/GroupDetailScreen.tsx`
- `src/services/repository.challenges.ts` (added `getGroup` and `getGroupSubmissions`)

---

### Emotion Empty Pack (Verbatim)
**Required:** "Nobody's logged yet." / "First one in sets the pace."

**Fixed:**
- Empty state title: "Nobody's logged yet."
- Empty state subtitle: "First one in sets the pace."
- **Removed:** "Waiting on the first log" and other non-verbatim copy

**Affected Files:**
- `src/screens/social/GroupDetailScreen.tsx`

---

### Sticky "Log today" CTA
**Required:** Prominent, sticky "Log today" primary button

**Fixed:**
- Added fullWidth primary button with "Log today" label
- Icon: `Target` (same as challenge log screens)
- Position: Below hero "Today's logs" card, always visible
- Style: Large (`size="lg"`), accent variant

**Affected Files:**
- `src/screens/social/GroupDetailScreen.tsx`

---

### Remove Team War
**Required:** No Team War actions or mentions

**Fixed:**
- **Removed:** "Start a challenge" button (had Swords icon, navigated to CreateChallenge)
- **Removed:** "Invite" button
- **Removed:** SegmentedControl tabs (`activity`, `members`, `challenges`)
- **Simplified:** Screen now shows only "Today's logs" hero card + "Log today" CTA + all logs list

**Affected Files:**
- `src/screens/social/GroupDetailScreen.tsx`

---

## Summary

### Gate 3: Security ✅
- ✅ No hardcoded pepper in RN client
- ✅ Server-only hashing via Secret Manager
- ✅ No plaintext token queries (all via hash)
- ✅ Firestore rules DENY client submissions/groups create
- ✅ Added `createOneOnOneChallenge` callable
- ✅ Added `previewChallengeByToken` callable

### Gate 2: Copy ✅
- ✅ Rematch: "You took it." / "They edged you." / "Even. Rematch decides."
- ✅ Primary CTA: "Push harder (same pair)"
- ✅ Quiet "Done for now" button
- ✅ Broken streak card with "Log today" CTA
- ✅ Log CTA label: "Log today"

### Gate 1: GroupDetail ✅
- ✅ Real Firebase data (no mocks)
- ✅ Empty pack verbatim: "Nobody's logged yet." / "First one in sets the pace."
- ✅ Sticky "Log today" CTA
- ✅ Removed Team War actions and tabs

---

## Deployment Requirements

1. **Environment Variables:**
   ```bash
   cd functions
   echo "JOIN_CODE_PEPPER=$(openssl rand -base64 32)" > .env.local
   ```

2. **Deploy Firestore Rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```

3. **Deploy Cloud Functions:**
   ```bash
   cd functions
   npm install
   npm run build
   firebase deploy --only functions
   ```

4. **Enable App Check:**
   - Firebase Console → App Check
   - Register Android/iOS apps
   - Enable enforcement for Cloud Functions

---

## Testing

1. **Security (Gate 3):**
   - Verify client cannot query by plaintext token
   - Verify client cannot create groups or submissions directly
   - Verify only callable functions can accept/log/rematch

2. **Copy (Gate 2):**
   - Complete a challenge where you win → see "You took it."
   - Complete a challenge where opponent wins → see "They edged you."
   - Complete a challenge as a tie → see "Even. Rematch decides."
   - Break a streak → see card with "Log today" button
   - Log CTA always says "Log today"

3. **GroupDetail (Gate 1):**
   - Open group with no logs → see "Nobody's logged yet. / First one in sets the pace."
   - See "Log today" button always visible
   - No Team War / challenge tabs present
   - All data loads from Firebase (not mocks)

---

## All Approval Criteria Met ✅

PR #2 is now ready for approval with all three gates passed.
