import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, Target, Users, Video } from 'lucide-react-native';

import {
  AvatarGroup,
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  OptionCard,
  Screen,
  SectionHeader,
  SegmentedControl,
  Text,
} from '../../components';
import {
  DAILY_MEMBER_CAP,
  GROUPS,
  POINTS,
  REQUIRED_APPROVALS,
  groupById,
  memberById,
} from '../../services';
import type { ChallengeType } from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

const DURATIONS = [3, 5, 7] as const;

/** Challenge creation: an individual target, or a Team War against another group. */
export function CreateChallengeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'CreateChallenge'>>();
  const myGroup = groupById(route.params?.groupId ?? 'g1');

  const [type, setType] = useState<ChallengeType>('individual');
  const [targetWorkouts, setTargetWorkouts] = useState('5');
  const [days, setDays] = useState<number>(7);
  const [opponentId, setOpponentId] = useState<string | null>(null);

  const opponents = GROUPS.filter(g => g.id !== myGroup.id);

  const canCreate =
    type === 'individual'
      ? Number(targetWorkouts) > 0
      : opponentId !== null;

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <IconButton
        accessibilityLabel="Go back"
        variant="muted"
        size="md"
        onPress={() => navigation.goBack()}>
        <ArrowLeft color={theme.colors.text} size={20} />
      </IconButton>

      <Text variant="displaySm" style={styles.title}>
        New challenge
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        For {myGroup.name}
      </Text>

      <SegmentedControl<ChallengeType>
        segments={[
          { value: 'individual', label: 'Individual' },
          { value: 'team_war', label: 'Team War' },
        ]}
        value={type}
        onChange={setType}
        style={styles.tabs}
      />

      {type === 'individual' ? (
        <View>
          <SectionHeader
            title="Set a target"
            subtitle="Everyone in the group races their own target."
            style={styles.section}
          />
          <Input
            label="Workouts to complete"
            placeholder="5"
            value={targetWorkouts}
            onChangeText={setTargetWorkouts}
            keyboardType="number-pad"
            containerStyle={styles.input}
          />

          <SectionHeader title="Over how long?" style={styles.section} />
          <View style={styles.chipRow}>
            {DURATIONS.map(d => (
              <Button
                key={d}
                label={`${d} days`}
                size="sm"
                variant={days === d ? 'primary' : 'outline'}
                onPress={() => setDays(d)}
              />
            ))}
          </View>

          <Card variant="light" padding="base" style={styles.explainer}>
            <View style={styles.explainerHead}>
              <Target color={theme.colors.accent} size={18} />
              <Text variant="bodyStrong">Auto-verified</Text>
            </View>
            <Text variant="bodySm" tone="muted" style={styles.explainerBody}>
              Individual logs verify automatically from GPS and timestamp. No video
              needed.
            </Text>
          </Card>
        </View>
      ) : (
        <View>
          <SectionHeader
            title="Pick your opponent"
            subtitle="Group vs group, decided daily."
            style={styles.section}
          />
          <View style={styles.list}>
            {opponents.map(g => (
              <OptionCard
                key={g.id}
                title={g.name}
                description={`${g.memberIds.length} members`}
                selected={opponentId === g.id}
                onPress={() => setOpponentId(g.id)}
                icon={
                  <Users
                    color={
                      opponentId === g.id ? theme.colors.onAccent : theme.colors.text
                    }
                    size={20}
                  />
                }
              />
            ))}
          </View>

          <SectionHeader title="War length" style={styles.section} />
          <View style={styles.chipRow}>
            {DURATIONS.map(d => (
              <Button
                key={d}
                label={`${d} days`}
                size="sm"
                variant={days === d ? 'primary' : 'outline'}
                onPress={() => setDays(d)}
              />
            ))}
          </View>

          {/* Rules are shown up front — scoring surprises kill trust. */}
          <Card variant="dark" padding="base" radius="xxl" style={styles.rules}>
            <Text variant="bodyStrong" tone="inverse">
              How scoring works
            </Text>
            <View style={styles.ruleList}>
              <Rule text={`1 workout = ${POINTS.perWorkout} pts`} />
              <Rule text={`1 km = ${POINTS.perKilometre} pts`} />
              <Rule text={`100 kcal = ${POINTS.per100Kcal} pts`} />
              <Rule text={`Each member counts up to ${DAILY_MEMBER_CAP} pts per day`} />
              <Rule text="Each day is a round — most days won takes the war" />
              <Rule
                text={`Proof needs ${REQUIRED_APPROVALS} approvals from the opposing group`}
              />
            </View>

            <View style={styles.versus}>
              <AvatarGroup
                names={myGroup.memberIds.map(id => memberById(id).name)}
                max={3}
                size="sm"
                borderColor={theme.colors.surfaceInverse}
              />
              <Chip label="VS" variant="accent" />
              {opponentId ? (
                <AvatarGroup
                  names={groupById(opponentId).memberIds.map(id => memberById(id).name)}
                  max={3}
                  size="sm"
                  borderColor={theme.colors.surfaceInverse}
                />
              ) : (
                <Text variant="caption" tone="inverseMuted">
                  Pick a group
                </Text>
              )}
            </View>
          </Card>

          <Card variant="light" padding="base" style={styles.explainer}>
            <View style={styles.explainerHead}>
              <Video color={theme.colors.accent} size={18} />
              <Text variant="bodyStrong">Video proof required</Text>
            </View>
            <Text variant="bodySm" tone="muted" style={styles.explainerBody}>
              Team War submissions need a short clip, verified by the other group.
            </Text>
          </Card>
        </View>
      )}

      <Button
        label={type === 'individual' ? 'Create challenge' : 'Declare war'}
        size="lg"
        fullWidth
        disabled={!canCreate}
        style={styles.submit}
        onPress={() => navigation.goBack()}
      />
    </Screen>
  );
}

function Rule({ text }: { text: string }) {
  return (
    <View style={styles.rule}>
      <Text variant="caption" tone="accent">
        •
      </Text>
      <Text variant="bodySm" tone="inverseMuted" style={styles.ruleText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 4 },
  tabs: { marginTop: 24 },
  section: { marginTop: 28 },
  input: { marginTop: 12 },
  chipRow: { flexDirection: 'row', columnGap: 10, marginTop: 12 },
  list: { marginTop: 12, rowGap: 10 },
  rules: { marginTop: 20 },
  ruleList: { marginTop: 12, rowGap: 6 },
  rule: { flexDirection: 'row', columnGap: 8 },
  ruleText: { flex: 1 },
  versus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  explainer: { marginTop: 16 },
  explainerHead: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  explainerBody: { marginTop: 6 },
  submit: { marginTop: 28 },
});
