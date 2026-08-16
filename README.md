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

## Not built yet

Real screens, Health Connect integration, iOS.
