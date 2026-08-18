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

## Not built yet

Health Connect integration, iOS, and real persistence — all domain data comes
from `src/services/mockData.ts`. Auth is unwired. Video capture and upload in
`ProofSubmitScreen` are simulated; no camera module is installed yet.
