# Flint MVP Testing Guide

## Overview

This guide covers testing the 1:1 challenge core loop implemented for the Flint MVP. The features include challenge creation, invite sharing, acceptance, activity logging, streak tracking, and rematch flow.

## Features Implemented

### 1. Extended Activity Types (33 activities)

The app now supports activities organized across 5 categories:

- **Cardio**: Run, Walk, Cycle, Swim, Rowing, Elliptical, Stairmaster, HIIT, Jump Rope
- **Strength**: Weights, Bodyweight, CrossFit, Powerlifting, Olympic Lifting
- **Mobility**: Yoga, Pilates, Stretching, Foam Rolling, Mobility Drills
- **Sports**: Basketball, Soccer, Tennis, Volleyball, Boxing, Martial Arts
- **Outdoor**: Climbing, Surfing, Skiing, Snowboarding, Hiking, Trail Running, Mountain Biking, Kayaking, Paddleboarding

**Default activity**: Run (as specified in requirements)

### 2. 1:1 Challenge Flow

#### Challenge Creation
- Navigate to `CreateOneOnOne` screen
- Select activity category (defaults to Cardio)
- Choose specific activity (defaults to Run)
- Set target days (7, 14, 21, 30, 60, 90, or custom)
- Generate unique invite token
- Share invite link via deep link

#### Challenge Invitation
- Deep links support:
  - `flint://invite/ABC123XY`
  - `https://flint.app/invite/ABC123XY`
- Opens `AcceptChallenge` screen with preview
- Shows creator info, activity type, target days
- Accept or decline options

#### Challenge Acceptance
- Creates a group for both participants
- Sets challenge status to 'active'
- Records start day (local YYYY-MM-DD)
- Computes end day based on target
- Navigates to `ChallengeDetail` screen

### 3. Challenge Detail Screen

The challenge detail screen is the hub, showing:

#### Hero Section - Streak Cards
- **Your streak**: Current consecutive days
- **Their streak**: Opponent's consecutive days
- Progress: X / Target days logged
- Visual prominence with dark card for user, light for opponent

#### Today's Logs (Hero)
- Prominent card showing who logged today
- Empty state when no logs yet
- Encourages daily logging

#### Log CTA (when not logged today)
- Large accent card
- "Log today's [Activity]" button
- Opens `ChallengeLog` screen

#### Tabs
- **Today**: Today's submissions from both users
- **Streak history**: Best streak, current streak, active days

### 4. Activity Logging

`ChallengeLog` screen provides simple manual entry:

- Distance (for distance-based activities like Run, Cycle, Swim)
- Duration (minutes)
- Calories (optional)
- Note (optional)
- Auto-verified (no video needed for 1:1)
- Success state with checkmark before returning

### 5. Streak Computation

#### Device-Local Rules
- Consecutive days in YYYY-MM-DD format (device timezone)
- Streak continues if today OR yesterday has activity (grace)
- **Miss a day = break the streak** (no second grace day)
- No separate personal show-up streak UI in this flow

#### Server-Side Validation
- Cloud Function `onSubmissionWritten` recomputes streaks
- Writes to `challengeStreaks` collection
- Clients read but cannot write streaks (prevents forgery)
- Computed fields: `currentStreak`, `bestStreak`, `totalActiveDays`, `lastActivityDay`

### 6. Challenge Completion & Rematch

#### Completion Triggers
- End day has passed, OR
- Either user reaches target days

#### Rematch CTA
- Dark card with celebration message
- Primary button: **"Push harder (same pair)"**
- Tone: "dare, not dunk" — rematch is the win
- Bumps target by 25% or +7 days (whichever is larger)
- Creates new challenge with same pair and activity
- Same activity type, harder goal

### 7. Group Home Updates

Updated `GroupDetailScreen` to make today's logs the hero:
- Dark card at top showing today's activity
- Lists recent logs (up to 3 members shown)
- Empty state: "Nothing logged yet today"
- Keeps members and challenges tabs
- Integrates naturally with existing Groups structure

## Testing Flow

### Complete User Journey

#### Device A (Creator)
1. Navigate to challenge creation (from home or groups)
2. Create 30-day Run challenge
3. Share invite link (copy token)

#### Device B (Acceptor)
1. Open deep link: `flint://invite/ABC123XY`
2. Review challenge details
3. Accept challenge
4. View challenge detail screen

#### Both Devices
1. Log activity for the day
2. Verify streak increments
3. Check opponent's activity appears
4. Miss a day → verify streak breaks
5. Continue logging until completion
6. Trigger rematch → new 37-day challenge created

### Manual Testing Checklist

- [ ] Create challenge with various activities (Run, Weights, Yoga, etc.)
- [ ] Create challenge with different target days (7, 30, 60)
- [ ] Accept challenge via deep link
- [ ] Decline challenge
- [ ] Log distance-based activity (Run with km)
- [ ] Log time-based activity (Yoga with duration)
- [ ] Log with optional note
- [ ] View today's logs from both users
- [ ] Check streak increments on consecutive days
- [ ] Verify streak breaks when day is missed
- [ ] Complete challenge and trigger rematch
- [ ] Share invite link via native share sheet
- [ ] Navigate between challenge screens

### Automated Testing

Key test scenarios:

```typescript
// Streak computation
describe('computeChallengeStreak', () => {
  it('computes consecutive days ending today', () => {
    const submissions = [
      { day: '2026-09-03' },
      { day: '2026-09-04' },
      { day: '2026-09-05' },
    ];
    const streak = computeChallengeStreak(submissions, 'ch1', 'u1', '2026-09-05');
    expect(streak.currentStreak).toBe(3);
  });

  it('breaks streak on missed day', () => {
    const submissions = [
      { day: '2026-09-01' },
      { day: '2026-09-02' },
      // missed 09-03
      { day: '2026-09-04' },
    ];
    const streak = computeChallengeStreak(submissions, 'ch1', 'u1', '2026-09-04');
    expect(streak.currentStreak).toBe(1); // only today
  });
});

// Rematch difficulty bump
describe('buildRematch', () => {
  it('bumps target by 25% or +7, whichever larger', () => {
    const original = { targetDays: 30, activityKind: 'run' };
    const rematch = buildRematch(original, 'u1', 'u2');
    expect(rematch.targetDays).toBe(37); // 30 * 1.25 = 37.5, rounded down
  });

  it('uses +7 minimum for small targets', () => {
    const original = { targetDays: 7, activityKind: 'run' };
    const rematch = buildRematch(original, 'u1', 'u2');
    expect(rematch.targetDays).toBe(14); // 7 + 7
  });
});
```

## Firestore Schema

### Collections

#### `challenges`
```typescript
{
  id: string,
  type: 'one_on_one',
  title: string,
  inviteToken: string,
  activityKind: ActivityKind,
  creatorId: string,
  opponentId?: string,
  groupId?: string,
  targetDays: number,
  sessionsPerDay: number,
  status: 'pending' | 'active' | 'completed',
  createdAt: Timestamp,
  acceptedAt?: Timestamp,
  startDay?: string,
  endDay?: string
}
```

#### `groups`
```typescript
{
  id: string,
  name: string,
  code: string,
  memberIds: string[],
  createdAt: Timestamp
}
```

#### `submissions`
```typescript
{
  id: string,
  memberId: string,
  groupId: string,
  day: string, // YYYY-MM-DD
  kind: ActivityKind,
  effort: {
    workouts: number,
    distanceKm: number,
    kcal: number
  },
  status: 'auto_verified',
  note?: string,
  createdAt: Timestamp
}
```

#### `challengeStreaks` (server-owned)
```typescript
{
  id: string, // {challengeId}_{userId}
  challengeId: string,
  userId: string,
  currentStreak: number,
  bestStreak: number,
  lastActivityDay?: string,
  totalActiveDays: number,
  updatedAt: Timestamp
}
```

## Security Rules

- Users can only create challenges as themselves
- Only challenge participants can update challenges
- Users can only log submissions for themselves
- Submissions are auto-verified (no video for 1:1)
- Challenge streaks are **read-only** for clients (Cloud Functions only)
- Group membership required to read submissions

## Cloud Functions

### `onSubmissionWritten`
- Triggers on any submission create/update
- Checks if submission belongs to a 1:1 challenge
- Computes streak from all user's submissions in challenge
- Writes to `challengeStreaks` collection
- Server-owned to prevent client forgery

## Known Limitations

- Mock data still used in screens (Firebase integration pending)
- No Firebase calls wired in Create/Accept/Log screens yet
- Deep links tested with URL scheme only (not web URLs)
- Challenge discovery UI not built (users need direct invite links)
- No challenge list screen (navigate via groups or direct link)
- Rematch creates challenge but doesn't auto-navigate yet

## Next Steps for Production

1. Wire Firebase calls in all screens (replace mock data)
2. Add challenge list screen for user's active challenges
3. Test deep links end-to-end on Android device
4. Add challenge discovery/browse (optional)
5. Add notifications for opponent activity
6. Add challenge history/archive
7. Performance testing with large submission counts
8. Deploy Cloud Functions and test server-side streak validation

## Design Philosophy

**Tone**: "Dare, not dunk"
- Broken streak is honest, not shaming
- Rematch is the win, not the completion
- Log is hero on challenge screen
- Consecutive days are the only metric that matters

**Reused Components**:
- Existing design system in `src/components`
- Theme tokens and colors
- Same navigation structure
- Group infrastructure

**Kept Internal**:
- Kasrat package name (no rename in this PR)
- Flint-facing copy in new UI screens only
- Internal branding unchanged

## Testing on Android

### Prerequisites
```bash
# Install dependencies
npm install

# Start Metro bundler
npm start

# In another terminal, run on Android
npm run android
```

### Testing Deep Links

#### ADB Command
```bash
adb shell am start -W -a android.intent.action.VIEW \
  -d "flint://invite/ABC123XY" \
  com.kasrat
```

#### Test Flow
1. Create a challenge (note the token)
2. Copy the invite token
3. Use ADB to open deep link on second device/emulator
4. Verify AcceptChallenge screen opens with correct challenge

### Debugging Tips

- Check Firebase Auth is configured (see docs/FIREBASE_SETUP.md)
- Verify Firestore rules deployed: `firebase deploy --only firestore:rules`
- Deploy Cloud Functions: `firebase deploy --only functions`
- Check Cloud Function logs: `firebase functions:log`
- Use Firestore emulator for local testing: `firebase emulators:start`

## Summary

The Flint MVP implements a complete 1:1 challenge loop with:
- ✅ 33 activity types across 5 categories
- ✅ Challenge creation with invite tokens
- ✅ Deep-link invite system
- ✅ Accept/decline flow
- ✅ Manual activity logging
- ✅ Device-local streak tracking (YYYY-MM-DD, miss = break)
- ✅ Server-side streak validation (Cloud Functions)
- ✅ Challenge completion with rematch CTA
- ✅ Today's logs as hero on challenge screen
- ✅ Reuses existing design system and Groups

**Out of scope** (as per requirements):
- ❌ Feed-led UX
- ❌ Team War focus
- ❌ Video proof
- ❌ Camps
- ❌ Payments
- ❌ AI features
- ❌ Expo migration
