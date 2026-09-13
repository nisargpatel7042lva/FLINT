# Emotion UX P0 Fixes

This document details the emotion/UX P0 fixes implemented to align with the "dare, not dunk" tone.

## P0#1: Align Copy to Dare-Not-Dunk Pack

### Accept Challenge Screen
**Before:** "Someone has challenged you"  
**After:** "You've been challenged"  
**Rationale:** More direct, makes it personal - you're in the spotlight.

**Affected File:** `src/screens/social/AcceptChallengeScreen.tsx`

### Log Success
**Before:** "Logged! / Your streak continues"  
**After:** "Streak's alive. Day N."  
**Rationale:** Short, direct, shows progress. Uses actual current streak day.

**Affected File:** `src/screens/social/ChallengeLogScreen.tsx`

### Empty States
**Before:** "Nothing logged yet today" / "Nothing logged yet"  
**After:** "No logs yet / Waiting on you both" / "Waiting on the first log" / "No activity yet / Logs show up here once someone moves"  
**Rationale:** More direct challenge language, less passive.

**Affected Files:**
- `src/screens/social/ChallengeDetailScreen.tsx`
- `src/screens/social/GroupDetailScreen.tsx`

### Rematch Primary Button
**Status:** Already correct - "Push harder (same pair)"  
**No change needed.**

**Affected File:** `src/screens/social/ChallengeDetailScreen.tsx`

---

## P0#2: Add Broken-Streak Surface

**Implementation:** Added a dedicated "Streak broke" card that appears when:
- Challenge is still active (not complete)
- User had previously logged (totalActiveDays > 0)
- Current streak is 0 (streak broke)

**Copy:** "Streak broke / Log today to start again."  
**Rationale:** Honest, no soft restart language, no scolding. Tells user exactly what to do.

**Affected File:** `src/screens/social/ChallengeDetailScreen.tsx`

---

## P0#3: Cut Kasrat Leftovers

### Removed "Failed" Language
**Before:** "Failed to accept challenge" / "Failed to log activity" / "Failed to create rematch" / "Failed to create challenge"  
**After:** "Could not accept challenge" / "Could not log activity" / "Could not create rematch" / "Could not create challenge"  
**Rationale:** Less negative, more neutral error messaging.

**Affected Files:**
- `src/screens/social/AcceptChallengeScreen.tsx`
- `src/screens/social/ChallengeLogScreen.tsx`
- `src/screens/social/ChallengeDetailScreen.tsx`
- `src/screens/social/CreateOneOnOneScreen.tsx`

### No Grace Language
**Status:** Already removed in previous commits.  
**Confirmation:** No "grace period" or "get back on track" language exists in challenge screens.

---

## Additional Ensures

### Log CTA Copy
**Before:** "Keep your streak alive"  
**After:** "Keep it going"  
**Rationale:** Shorter, less repetitive with the streak display above.

**Affected File:** `src/screens/social/ChallengeDetailScreen.tsx`

### Done for Now State
**Added:** New card that appears when user has already logged today:
- **Title:** "Done for now"
- **Body:** "You've logged today. See you tomorrow."

**Rationale:** Acknowledges completion without being overly congratulatory.

**Affected File:** `src/screens/social/ChallengeDetailScreen.tsx`

### Winner/Loser/Tie Copy
**Added:** Contextual rematch messaging based on completion status:
- **Won:** "You won! / Ready to defend it?"
- **Lost:** "They got you / Want another shot?"
- **Tie:** "You both showed up / Ready to push harder?"

**Rationale:** Personalized, daring language that respects the outcome.

**Affected File:** `src/screens/social/ChallengeDetailScreen.tsx`

### GroupDetail Hero Section
**Status:** "Today's logs" remains the hero section (top dark card).  
**Copy:** "Waiting on the first log" for empty state.

**Affected File:** `src/screens/social/GroupDetailScreen.tsx`

---

## Testing Notes

1. **Broken Streak Display**
   - Create a 1:1 challenge
   - Accept and log Day 1
   - Skip Day 2 (let local midnight pass without logging)
   - On Day 3, open ChallengeDetail
   - Should see "Streak broke / Log today to start again." card

2. **Log Success Toast**
   - Log activity for a challenge
   - Success screen should show "Streak's alive. Day 1." (or Day 2, Day 3, etc. based on current streak)

3. **Winner/Loser/Tie Rematch**
   - Complete a challenge where both participants hit the target → see "You both showed up"
   - Complete a challenge where you reach target first → see "You won!"
   - Complete a challenge where opponent reaches target first → see "They got you"

4. **Done for Now**
   - Log activity today
   - Return to ChallengeDetail
   - Should see "Done for now / You've logged today. See you tomorrow." instead of log CTA

---

## Summary

All emotion UX P0s have been addressed:
- ✅ Copy aligned to dare-not-dunk tone
- ✅ Broken-streak surface added with honest copy
- ✅ Kasrat leftovers removed ("failed", grace language)
- ✅ Log success toast is short and shows actual streak day
- ✅ Empty/Day 0/broken/rematch winner-loser-tie + "Done for now" all covered
- ✅ GroupDetail keeps "Log today" as hero section

PR #1 is now ready for approval with both Firebase P0s and Emotion UX P0s complete.
