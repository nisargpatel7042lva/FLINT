# Kasrat

Android-first fitness tracking app. React Native CLI (not Expo), TypeScript.

## Why these versions

| Piece | Version | Why |
| --- | --- | --- |
| React Native | **0.86.2** | Not latest. `react-native-reanimated@4.5.3` peers `react-native@0.83 - 0.86`, so RN 0.87 would force a nightly Reanimated. 0.86 also targets `compileSdk 36`, which matches the installed SDK — 0.87 wants SDK 37. |
| Reanimated | 4.5.3 | Babel transform now lives in `react-native-worklets`, wired in `babel.config.js`. |
| Worklets | ^0.11.4 | Must be a **direct** dependency — see below. |
| Gradle | 9.3.1 | Ships with the 0.86 template. |
| JDK | 21 | Android Studio's bundled JBR. |

Expo was ruled out deliberately: Health Connect integration needs full native
module access.

## Layout

```
src/
  assets/       Fonts and images (see assets/README.md)
  components/   Themed primitives — the only things screens should compose
  hooks/        Shared hooks
  navigation/   Root stack + bottom tabs, and route param types
  screens/      Placeholders only; real screens are a later phase
  services/     External boundaries — Health Connect, storage, HTTP
  theme/        Design tokens
```

## Design system

All visual values live in `src/theme` and are consumed through `useTheme()`.
Components never take raw colours or magic numbers — they take semantic props
(`variant`, `tone`, `size`).

- `colors.ts` — raw palette + the swappable accent sets
- `spacing.ts` — 4pt spacing scale and corner radii
- `typography.ts` — type scale (`display*`, `h1`–`h3`, `body*`, `label`, `stat*`)
- `shadows.ts` — elevation tokens
- `theme.ts` — semantic colour roles, `createTheme(mode, accent)`

Orange (`#FF6B1A`) is the primary accent; `lime` and `emerald` exist so
alternate layouts can drop in without a re-theme. Both a light (cream) and a
dark mode are defined, and the signature near-black card is available in **both**
— that is why `surfaceInverse` exists as a role separate from `surface`.

Primitives: `Text`, `Card`, `Button`, `IconButton`, `StatPill`, `ProgressRing`,
`SectionHeader`, `Input`, `Screen`.

> If a screen needs a one-off style, add a variant to the primitive instead of
> styling inline at the call site.

The `Home` tab currently renders `DesignSystemScreen`, a live gallery of every
primitive with mode and accent switchers. Delete it once real screens exist.

### Fonts

The reference design uses a bold condensed grotesque for hero type. Until a
licensed face is added, `typography.ts` falls back to the platform system font.
To swap it in: drop files in `src/assets/fonts`, run `npx react-native-asset`,
rebuild, then change `fontFamily` in `typography.ts`. Nothing else changes.

## Running

```bash
npm start
```

```bash
npm run android
```

## Build notes

`android/gradle.properties` sets `reactNativeArchitectures` to all four ABIs,
so every build compiles native code four times. For faster local iteration,
narrow it to what you actually run on (`x86_64` for emulators, `arm64-v8a` for
most physical devices).

Native config already applied:

- `index.js` imports `react-native-gesture-handler` first
- `App.tsx` nests `GestureHandlerRootView` → `SafeAreaProvider` → `ThemeProvider`
- `babel.config.js` has `react-native-worklets/plugin` last

### Gotcha: `react-native-worklets`

Reanimated 4 pulls `react-native-worklets` in transitively, but its Gradle
script resolves the package from **your** `package.json`, not from the hoisted
`node_modules` tree. If it is only a transitive dep the build fails at
configuration time with:

```
[Reanimated] `react-native-worklets` library not found.
```

It is therefore pinned as a direct dependency at `^0.11.4` (Reanimated 4.5.3
peers `0.10.x - 0.11.x`). Don't "clean up" that seemingly redundant entry.

## Team Wars scoring

All rules live in [`src/services/scoring.ts`](src/services/scoring.ts). Screens
render the standing; they never compute it.

| Rule | Behaviour |
| --- | --- |
| Currency | **Unified points.** 1 workout = 100, 1 km = 10, 100 kcal = 20. |
| Fairness | **Capped contribution.** Each member counts at most 400 pts per day. |
| Win condition | **Daily rounds.** Each calendar day is won separately; most days won takes the war. Cumulative points are the tiebreak only. |
| Verification | **Opponent approval.** A Team War submission needs 2 approvals from the opposing group before it scores. |

The conversion rates, the daily cap and the approval threshold are the balance
knobs — they are the only numbers that decide fairness, and they all live at the
top of that one file.

**Open question:** `groupDayScore` counts a member's effort toward *every* group
they belong to, so overlapping groups each show that effort. If a session should
count for only one group, that needs a rule.

## Char (the mascot)

`src/components/char/Char.tsx`. Char represents the user's **consistency**, not
a level or badge. Four states, driven by streak health:

| State | Meaning | Motion |
| --- | --- | --- |
| `dim` | No active streak | Barely-there breathe, no halo |
| `glowing` | Streak alive | Steady breathe, gentle bob, pulsing halo |
| `concerned` | Streak at risk today | Irregular flicker, shrinks, sits lower |
| `celebrating` | Milestone hit | Spring pop + expanding ring |

Char is a soft abstract ember, not a character with a face — deliberately, so
every state animates with `transform` and `opacity` only and runs on the UI
thread. `charStateForStreak()` maps streak data to a state so every screen tells
the same story.

## Micro-interaction guidelines

`src/theme/motion.ts` is the single source for timing and easing. Read its
header before adding any animation — it defines six rules (taps spring-pop,
completions overshoot, counters tween, entrances decelerate, ambient loops stay
subtle, progress bars use `duration.slow`) plus the performance constraint that
only `transform`/`opacity` get animated.

Helpers that implement those rules: `PressableScale` (rule 1),
`AnimatedCounter` (rule 3).

## Placeholder imagery

`src/assets/placeholders.ts` — every image without a real asset resolves here,
so swapping in production art is a one-file change. Sources are keyless and
free for dev: **pravatar** (avatars), **loremflickr** (topic photos),
**picsum** (neutral).

⚠ Before shipping: these are third-party network calls on every render, and the
Flickr-backed images carry individual CC terms that may require attribution.
`source.unsplash.com` is dead (503) and Pexels needs an API key, so neither is
used. Topic relevance from LoremFlickr is variable — `gym` is reliable,
`workout` returns a lot of unrelated material, and `fitness`/`yoga` 500 outright
(excluded from the type).

## Personal tracking loop

The individual experience, and the one the validation data says most users
actually want. Tabs are **personal only** — Feed / Team Wars / Groups are off
the tab bar so this loop can be judged on its own; they remain routable and are
one line each to restore in `TabNavigator`.

All logic lives in [`src/services/training.ts`](src/services/training.ts):

| Piece | Behaviour |
| --- | --- |
| Time fit | A plan's estimate must land INSIDE the budget. Each set costs work + rest, each exercise adds setup; exercise and set counts are chosen to fit. Covered by a test asserting no plan over-runs. |
| Naming | Sessions are named by their fit — "12-minute Legs Day", never a bare exercise list. |
| Streaks | Consecutive days ending today, or yesterday — a streak is not "broken" just because you have not trained yet this morning. |
| Char stages | Ember → Flame → Blaze → Wildfire → Forge, driven by the CURRENT streak so Char can fall back. |

**Logging is one tap per set.** The rep target is pre-filled, "Log set" commits
it, and the screen advances itself through sets, then exercises, then to the
summary. The stepper is for corrections only and is never on the critical path.
There is no text input anywhere in the flow.

Tuning knobs: `WORK_SECONDS`, `SETUP_SECONDS`, `restFor()`,
`WEEKLY_GOAL_SESSIONS`, `WEEKLY_GOAL_MINUTES`.

### Gotcha: date keys

Day keys are built from **local** date components, never `toISOString()`. That
call converts to UTC, so local midnight in any timezone ahead of UTC lands on
the previous day — which silently broke consecutive-day comparison (every
longest-streak read as 1) and shifted calendar marks by a day. There is a
regression test for it.

## Backend

Firebase: Auth, Firestore, Storage, Cloud Messaging, Cloud Functions.

**Setup requires one thing only I cannot do for you** — see
[docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md). Creating the project needs
your Google account, and `google-services.json` comes from it.

Until that file exists the app **still builds and runs** on local data. The
Gradle plugin is applied conditionally (`android/app/build.gradle`), because
the google-services plugin hard-fails a build when the file is missing.
`Profile → Data` shows which backend is live.

### The data boundary

Screens depend on `TrainingRepository`, never on Firestore or on fixtures:

```
src/services/repository.ts            the interface
src/services/repository.firestore.ts  Firestore implementation
src/services/repository.local.ts      in-memory fallback
src/hooks/useSessions.ts              the single read path
```

That interface is why Phase 5 could be built against mock data and switched to
a real backend without changing a screen's logic.

`currentStreak` is written **only** by Cloud Functions — the rules block
clients, because a streak a client can write is a streak it can fake.

### Native integrations

| Area | Android | iOS |
| --- | --- | --- |
| Health | Health Connect (`services/health.ts`) | HealthKit **stubbed** behind the same `HealthProvider` interface |
| Location | Fused Location, foreground only | same API, untested |

`minSdkVersion` is **26** — the floor for `react-native-health-connect`, and
Health Connect needs Android 8+ regardless.

### Char's notification voice

Copy lives in `src/services/notificationCopy.ts` (client) and
`functions/src/copy.ts` (server) — mirrored deliberately; change one, change
the other. The rules are in both file headers, and the first is: **never
shame**. No "you missed", no countdown pressure, no blame for time away. Char
dims; the user is not at fault.

## Building

See [docs/ANDROID_BUILD.md](docs/ANDROID_BUILD.md) for debug APKs, the release
keystore, and the Android Studio walkthrough.

## Not built yet

Completed sessions are not persisted — `WorkoutLogScreen` updates its own
state, but `SESSION_LOGS` is a static fixture, so the streak resets on reload.

Health Connect integration, iOS, and real persistence — all domain data comes
from `src/services/mockData.ts`. Auth is unwired. Video capture and upload in
`ProofSubmitScreen` are simulated; no camera module is installed yet.
