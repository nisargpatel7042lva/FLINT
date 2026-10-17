import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { ArrowRight } from 'lucide-react-native';

import { Button, Logo, Screen, Text } from '../../components';
import { CLUB_COLOURS } from '../../services/city';
import { useTheme } from '../../theme';

const COLS = 7;
const ROWS = 9;
const GAP = 4;

/** Two clubs fighting over one neighbourhood: the whole game, in one picture. */
const CLUBS = [CLUB_COLOURS[0], CLUB_COLOURS[1]];

type Grid = Array<number | null>;

/** A starting position: a few blocks each, as if the week had just begun. */
function seedGrid(): Grid {
  const g: Grid = Array(COLS * ROWS).fill(null);
  [3, 9, 10, 16, 17, 23].forEach(i => (g[i] = 0));
  [40, 46, 47, 53, 54, 60].forEach(i => (g[i] = 1));
  return g;
}

/**
 * The first screen.
 *
 * It has to say what Flint is before anyone reads a word: a dark city, blocks
 * lighting up in two colours, one colour pushing into the other's ground.
 * One sentence underneath, then the button.
 */
export function SplashScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const reduced = useReducedMotion();
  const [grid, setGrid] = useState<Grid>(seedGrid);

  useEffect(() => {
    if (reduced) {
      return;
    }
    const t = setInterval(() => {
      setGrid(g => {
        const next = [...g];
        // A random lit block's club spreads into a neighbour — sometimes
        // dark ground, sometimes the other club's.
        const lit = next.flatMap((c, i) => (c === null ? [] : [i]));
        const from = lit[Math.floor(Math.random() * lit.length)];
        const r = Math.floor(from / COLS);
        const c = from % COLS;
        const options = [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ].filter(([y, x]) => y >= 0 && y < ROWS && x >= 0 && x < COLS);
        const [y, x] = options[Math.floor(Math.random() * options.length)];
        next[y * COLS + x] = next[from];
        // And somewhere, a block nobody ran burns out.
        if (Math.random() < 0.35) {
          const dim = lit[Math.floor(Math.random() * lit.length)];
          next[dim] = null;
        }
        return next;
      });
    }, 420);
    return () => clearInterval(t);
  }, [reduced]);

  const cell = 30;
  const w = COLS * cell + (COLS - 1) * GAP;
  const h = ROWS * cell + (ROWS - 1) * GAP;

  return (
    <Screen
      padding="lg"
      backgroundColor={NIGHT}
      statusBarStyle="light-content"
      contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <Logo size={30} />
        <Text variant="label" tone="accent" uppercase>
          Flint
        </Text>
      </View>

      <View style={styles.center}>
        <Svg width={w} height={h}>
          {grid.map((club, i) => {
            const x = (i % COLS) * (cell + GAP);
            const y = Math.floor(i / COLS) * (cell + GAP);
            return club === null ? (
              <Rect key={i} x={x} y={y} width={cell} height={cell} rx={4} fill="#1C1C1E" />
            ) : (
              <Rect
                key={i}
                x={x}
                y={y}
                width={cell}
                height={cell}
                rx={4}
                fill={CLUBS[club]}
                fillOpacity={0.75}
                stroke={CLUBS[club]}
                strokeWidth={1.5}
              />
            );
          })}
        </Svg>
        <Text variant="displayMd" tone="inverse" align="center" style={styles.headline}>
          Your runs light{'\n'}up the city.
        </Text>
        <Text variant="body" tone="inverseMuted" align="center" style={styles.body}>
          Run with your club and the blocks you run turn your colour. Stop
          running and another club takes them.
        </Text>
      </View>

      <View>
        <Button
          label="Get started"
          size="lg"
          fullWidth
          onPress={() => navigation.navigate('SignUp')}
          iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
        />
        <Button
          label="I already have an account"
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => navigation.navigate('SignIn')}
          style={styles.login}
        />
      </View>
    </Screen>
  );
}

const NIGHT = '#0B0B0C';

const styles = StyleSheet.create({
  content: { flex: 1, paddingBottom: 24 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    paddingTop: 12,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headline: { marginTop: 36 },
  body: { marginTop: 12, maxWidth: 310 },
  login: { marginTop: 6 },
});
