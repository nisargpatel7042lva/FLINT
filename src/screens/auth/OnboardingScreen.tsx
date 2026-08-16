import React, { useCallback, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, Flame, Footprints, Swords, Trophy } from 'lucide-react-native';

import {
  Avatar,
  AvatarGroup,
  Button,
  Card,
  Chip,
  MeterBar,
  PageDots,
  ProgressRing,
  Screen,
  StatPill,
  Text,
} from '../../components';
import { useTheme } from '../../theme';

/**
 * Onboarding carousel.
 *
 * Each slide's illustration is assembled from the real components the feature
 * will actually use, so the preview shows the product rather than generic
 * fitness imagery. No new visual patterns are introduced here.
 */

/** (a) Personal workout tracking. */
function TrackingArt() {
  const theme = useTheme();
  return (
    <Card variant="dark" padding="lg" radius="xxl" style={styles.art}>
      <View style={styles.artRow}>
        <ProgressRing value={68} max={100} size={116} strokeWidth={12} sweep={300}>
          <Text variant="statSm" tone="inverse">
            68%
          </Text>
          <Text variant="label" tone="inverseMuted" uppercase>
            Goal
          </Text>
        </ProgressRing>
        <View style={styles.artStack}>
          <StatPill
            value="6,160"
            label="Steps"
            variant="muted"
            size="sm"
            icon={<Footprints color={theme.colors.accent} size={14} />}
          />
          <StatPill
            value="638"
            label="Kcal"
            variant="muted"
            size="sm"
            icon={<Flame color={theme.colors.accent} size={14} />}
          />
        </View>
      </View>
      <MeterBar value={68} style={styles.artMeter} trackColor={theme.colors.surfaceInverseMuted} />
    </Card>
  );
}

/** (b) Challenging a friend head to head. */
function ChallengeArt() {
  const theme = useTheme();
  return (
    <Card variant="dark" padding="lg" radius="xxl" style={styles.art}>
      <View style={styles.versusRow}>
        <View style={styles.versusSide}>
          <Avatar name="You" size="lg" ring />
          <Text variant="caption" tone="inverse" style={styles.versusName}>
            You
          </Text>
        </View>

        <Chip
          label="VS"
          variant="accent"
          icon={<Swords color={theme.colors.onAccent} size={14} />}
        />

        <View style={styles.versusSide}>
          <Avatar name="Ben Ortiz" size="lg" />
          <Text variant="caption" tone="inverse" style={styles.versusName}>
            Ben
          </Text>
        </View>
      </View>

      <View style={styles.scoreBlock}>
        <View style={styles.scoreRow}>
          <Text variant="label" tone="inverseMuted" uppercase>
            You
          </Text>
          <Text variant="bodyStrong" tone="inverse">
            8,240
          </Text>
        </View>
        <MeterBar value={82} trackColor={theme.colors.surfaceInverseMuted} />

        <View style={[styles.scoreRow, styles.scoreRowSpaced]}>
          <Text variant="label" tone="inverseMuted" uppercase>
            Ben
          </Text>
          <Text variant="bodyStrong" tone="inverseMuted">
            6,915
          </Text>
        </View>
        <MeterBar
          value={69}
          color={theme.colors.textInverseMuted}
          trackColor={theme.colors.surfaceInverseMuted}
        />
      </View>
    </Card>
  );
}

/** (c) Team Wars — group versus group. */
function TeamWarArt() {
  const theme = useTheme();
  return (
    <Card variant="dark" padding="lg" radius="xxl" style={styles.art}>
      <View style={styles.versusRow}>
        <View style={styles.teamSide}>
          <AvatarGroup
            names={['Ava Cole', 'Ben Ortiz', 'Cara Diaz', 'Dan Reed', 'Eve Shah']}
            max={3}
            size="sm"
            borderColor={theme.colors.surfaceInverse}
          />
          <Text variant="caption" tone="inverse" style={styles.versusName}>
            Iron Wolves
          </Text>
        </View>

        <Chip
          label="WAR"
          variant="accent"
          icon={<Trophy color={theme.colors.onAccent} size={14} />}
        />

        <View style={styles.teamSide}>
          <AvatarGroup
            names={['Finn Wu', 'Gia Lopez', 'Hana Kim', 'Ivan Petro']}
            max={3}
            size="sm"
            borderColor={theme.colors.surfaceInverse}
          />
          <Text variant="caption" tone="inverse" style={styles.versusName}>
            Night Runners
          </Text>
        </View>
      </View>

      <View style={styles.scoreBlock}>
        <View style={styles.scoreRow}>
          <Text variant="statSm" tone="accent">
            42,180
          </Text>
          <Text variant="statSm" tone="inverseMuted">
            38,904
          </Text>
        </View>
        <MeterBar value={52} trackColor={theme.colors.textInverseMuted} />
        <Text variant="caption" tone="inverseMuted" align="center" style={styles.warNote}>
          Week 3 · 2 days left
        </Text>
      </View>
    </Card>
  );
}

const SLIDES = [
  {
    key: 'tracking',
    eyebrow: 'Track',
    title: 'Every rep,\ncounted',
    body: 'Log workouts, steps and calories. Kasrat turns your daily effort into progress you can actually see.',
    Art: TrackingArt,
  },
  {
    key: 'challenge',
    eyebrow: 'Compete',
    title: 'Challenge\nyour friends',
    body: 'Put a streak on the line. Head-to-head challenges keep you moving when motivation runs out.',
    Art: ChallengeArt,
  },
  {
    key: 'teamwars',
    eyebrow: 'Team Wars',
    title: 'Squad up,\ngo to war',
    body: 'Join a team and take on rival groups. Every member’s effort adds to the score.',
    Art: TeamWarArt,
  },
] as const;

export function OnboardingScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(next);
    },
    [width],
  );

  const isLast = index === SLIDES.length - 1;

  const goNext = useCallback(() => {
    if (isLast) {
      navigation.navigate('SignUp');
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  }, [isLast, index, width, navigation]);

  return (
    <Screen padding="none" contentContainerStyle={styles.screen}>
      <View style={styles.skipRow}>
        <Button
          label="Skip"
          variant="ghost"
          size="sm"
          onPress={() => navigation.navigate('SignUp')}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.flex}>
        {SLIDES.map(slide => {
          const { Art } = slide;
          return (
            <View key={slide.key} style={[styles.slide, { width }]}>
              <Art />
              <Text variant="label" tone="accent" uppercase style={styles.eyebrow}>
                {slide.eyebrow}
              </Text>
              <Text variant="displaySm" style={styles.slideTitle}>
                {slide.title}
              </Text>
              <Text variant="body" tone="muted" style={styles.slideBody}>
                {slide.body}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <PageDots count={SLIDES.length} index={index} onDark />
        <Button
          label={isLast ? 'Create account' : 'Next'}
          size="lg"
          onPress={goNext}
          iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 4 },
  slide: { paddingHorizontal: 24, justifyContent: 'center' },
  art: { width: '100%' },
  artRow: { flexDirection: 'row', alignItems: 'center', columnGap: 16 },
  artStack: { rowGap: 10, flex: 1 },
  artMeter: { marginTop: 16 },
  versusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  versusSide: { alignItems: 'center', rowGap: 6 },
  teamSide: { alignItems: 'center', rowGap: 6, flex: 1 },
  versusName: { marginTop: 2 },
  scoreBlock: { marginTop: 20 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scoreRowSpaced: { marginTop: 14 },
  warNote: { marginTop: 10 },
  eyebrow: { marginTop: 28 },
  slideTitle: { marginTop: 8 },
  slideBody: { marginTop: 10 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
  },
});
