# Assets

Static assets bundled with the app.

- `fonts/` — custom font files (`.ttf`/`.otf`). After adding one, register the
  directory in `react-native.config.js`, run `npx react-native-asset`, then
  rebuild the native app and update `fontFamily` in `src/theme/typography.ts`.
- `images/` — raster and vector art.

The design reference for this project uses a bold condensed grotesque for hero
type; until a licensed face is dropped in here, `typography.ts` falls back to
the platform system font.
