# Gate 1 Navigation Fix - Last Approval Blocker

## Issue
`GroupDetailScreen.handleLogToday()` was incorrectly navigating to `CreateOneOnOne`, which is not the correct flow for logging activity in an existing group.

## Fix
Updated `handleLogToday` to intelligently route based on group's challenge state:

### Navigation Logic (Priority Order)

1. **Active Challenge Exists** → Navigate to `ChallengeLog` for that challenge
   - If multiple active challenges, use the most recently accepted (sort by `acceptedAt` desc)
   - Example: User has logged before, challenge is in progress

2. **No Active, But Pending Invite Exists** → Navigate to `ChallengeDetail` for pending challenge
   - Shows preview of pending challenge
   - User can accept or view details

3. **No Challenges at All** → Show "No active challenge" empty state
   - Card displays: "No active challenge / Start one to begin logging."
   - Button is replaced with this empty state
   - **NEVER** navigate to `CreateOneOnOne`

### Implementation Details

**Added `getGroupChallenges()` function:**
```typescript
export async function getGroupChallenges(groupId: string): Promise<OneOnOneChallenge[]>
```
- Queries `challenges` collection by `groupId`
- Orders by `acceptedAt` desc (most recent first)
- Returns all challenges for that group

**Updated `GroupDetailScreen`:**
- Loads `groupChallenges` on mount alongside group and submissions
- `handleLogToday` checks challenge state and routes accordingly
- Conditionally renders:
  - "Log today" button if active/pending challenges exist
  - "No active challenge" empty state card if no challenges

**Code Changes:**
- `src/services/repository.challenges.ts`: Added `getGroupChallenges()`
- `src/screens/social/GroupDetailScreen.tsx`: Updated nav logic and conditional rendering

### Testing

**Test Case 1: Active Challenge**
- User has accepted a challenge
- Click "Log today" → navigates to `ChallengeLog` with correct `challengeId`

**Test Case 2: Multiple Active Challenges**
- User has 2+ active challenges in same group
- Click "Log today" → navigates to most recently accepted challenge

**Test Case 3: Pending Challenge Only**
- User received invite but hasn't accepted yet
- Click "Log today" → navigates to `ChallengeDetail` to review/accept

**Test Case 4: No Challenges**
- New group with no challenges created yet
- See empty state card: "No active challenge / Start one to begin logging."
- No button to click

---

## ✅ Gate 1 Nav FIXED

The blocking issue is now resolved. `GroupDetailScreen` correctly handles all challenge states and never navigates to `CreateOneOnOne` from the "Log today" action.

---

# P1 Security Enhancements (Bonus)

## Issue
1. Plaintext `inviteToken` was persisted on challenge documents, allowing enumeration via Firestore exports
2. `JOIN_CODE_PEPPER` had a hardcoded fallback, allowing bypass if env var not set

## Fix

### 1. Stop Persisting Plaintext Tokens

**Before:**
```typescript
{
  inviteToken: "ABC123DEF456",  // ❌ Plaintext stored
  inviteTokenHash: "sha256hash"  // ✅ Hash stored
}
```

**After:**
```typescript
{
  // inviteToken: NOT STORED        // ✅ Never persisted
  inviteTokenHash: "sha256hash"    // ✅ Only hash stored
}
```

**Flow:**
1. `createOneOnOneChallenge` callable generates token
2. Hashes token server-side (JOIN_CODE_PEPPER + SHA-256)
3. Stores ONLY hash in Firestore
4. Returns plaintext token ONCE to creator for immediate sharing
5. Token cannot be retrieved later (not stored)

**Impact:**
- Creator must share immediately (prompts share dialog on create)
- Cannot re-share later from `ChallengeDetailScreen` (token unavailable)
- If creator dismisses share dialog, token is lost (must create new challenge)

**UX Change:**
- `ChallengeDetailScreen`: "Share invite" button alerts if token unavailable
- `CreateOneOnOneScreen`: Immediately prompts share after creation
- Comments clarify: "Token returned once and NOT stored on challenge doc (security)"

### 2. Require JOIN_CODE_PEPPER (No Fallback)

**Before:**
```typescript
const JOIN_CODE_PEPPER = process.env.JOIN_CODE_PEPPER || 'flint-mvp-join-pepper-change-in-production';
// ❌ Fallback allowed production deploys without proper config
```

**After:**
```typescript
const JOIN_CODE_PEPPER = process.env.JOIN_CODE_PEPPER;
if (!JOIN_CODE_PEPPER) {
  throw new Error('JOIN_CODE_PEPPER environment variable is required');
}
// ✅ Fails fast if not configured, forces proper Secret Manager setup
```

**Impact:**
- Cloud Functions will not deploy/start without `JOIN_CODE_PEPPER` set
- Forces proper Secret Manager configuration
- No accidental production deploys with weak/hardcoded pepper

### 3. Repository Functions Handle Missing Token

**Updated functions to gracefully handle empty `inviteToken` field:**
- `getChallenge()`: Returns empty string if token not stored
- `getGroupChallenges()`: Returns empty string if token not stored
- Comment: "May be empty if not stored (security policy)"

**Code Changes:**
- `functions/src/index.ts`: Removed token storage, added pepper requirement
- `src/screens/social/ChallengeDetailScreen.tsx`: Handle missing token in share
- `src/screens/social/CreateOneOnOneScreen.tsx`: Immediate share + security comment
- `src/services/repository.challenges.ts`: Handle missing token gracefully

---

## Security Benefits

### 1. No Token Enumeration
- Plaintext tokens not in Firestore = cannot be extracted via:
  - Firestore exports/backups
  - Security rule bypasses
  - Read access to challenge documents

### 2. Reduced Exposure Window
- Token only exists in-memory during creation
- Must be used immediately (share-once policy)
- Cannot be retrieved later = limits replay attack window

### 3. Forced Proper Configuration
- `JOIN_CODE_PEPPER` required = no weak defaults in production
- Fails fast at startup if misconfigured
- Encourages Secret Manager best practices

---

## ✅ P1 Security COMPLETE

All P1 security enhancements implemented. System is now more secure against token enumeration and ensures proper configuration.
