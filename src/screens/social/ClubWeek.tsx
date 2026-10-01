import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Footprints, TrendingUp } from 'lucide-react-native';

import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ListRow,
  SectionHeader,
  Text,
} from '../../components';
import { formatPaceSec, paceOf, type BoardEntry, type ClubRun } from '../../services';
import { useClubRuns } from '../../hooks';
import { useTheme } from '../../theme';
import { relativeTime } from './relativeTime';

/** Rows on the board before the rest collapse. Your own row always shows. */
const BOARD_ROWS = 10;
const FEED_ROWS = 8;

const ordinal = (n: number): string => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

const km = (n: number) => `${n.toFixed(n >= 10 ? 0 : 1)} km`;

export type ClubWeekProps = {
  groupId: string;
  uid: string;
  nameFor: (uid: string) => string;
};

/**
 * A club's week: who passed you, the distance board, and this morning's runs.
 *
 * The order on the screen is the order of what matters on opening it. Being
 * overtaken is the news, so it leads; the board is the context for that news;
 * the feed is the club being a club — proof that other people turned up today.
 */
export function ClubWeek({ groupId, uid, nameFor }: ClubWeekProps) {
  const theme = useTheme();
  const navigation = useNavigation();
  const { runs, board, myRank, passers, acknowledge, loading } = useClubRuns(groupId, uid);

  const nameOf = (id: string) => (id === uid ? 'You' : nameFor(id));
  const mine = board.find(e => e.uid === uid);
  const ahead = myRank && myRank > 1 ? board[myRank - 2] : null;

  const goRun = () => navigation.navigate('Tracking', { kind: 'run' });

  const visible: BoardEntry[] = board.slice(0, BOARD_ROWS);
  const showMineBelow = myRank !== null && myRank > BOARD_ROWS && mine;

  return (
    <View>
      {/*
        The overtake. It names the person, says where that leaves you, and
        offers the one thing that answers it. "Got it" records the board as
        seen, so the same pass is never reported twice.
      */}
      {passers.length > 0 && myRank ? (
        <Card variant="dark" padding="base" radius="xxl" style={styles.passed}>
          <View style={styles.passedHead}>
            <TrendingUp color={theme.colors.accent} size={18} />
            <Text variant="label" tone="accent" uppercase>
              Overtaken
            </Text>
          </View>
          <Text variant="h2" tone="inverse" style={styles.passedTitle}>
            {passers.length === 1
              ? `${nameOf(passers[0].uid)} passed you.`
              : `${nameOf(passers[0].uid)} and ${passers.length - 1} more passed you.`}
          </Text>
          <Text variant="bodySm" tone="inverseMuted" style={styles.passedBody}>
            {ahead && mine
              ? `You're ${ordinal(myRank)}, ${km(ahead.km - mine.km)} behind ${nameOf(ahead.uid)}.`
              : `You're ${ordinal(myRank)} this week.`}
          </Text>
          <View style={styles.passedActions}>
            <Button
              label="Run now"
              size="sm"
              onPress={goRun}
              iconLeft={<Footprints color={theme.colors.onAccent} size={16} />}
            />
            <Button label="Got it" size="sm" variant="ghost" onPress={acknowledge} />
          </View>
        </Card>
      ) : null}

      <SectionHeader
        title="This week"
        subtitle={
          myRank
            ? `You're ${ordinal(myRank)} of ${board.length}`
            : board.length > 0
            ? `${board.length} ${board.length === 1 ? 'runner' : 'runners'} on the board`
            : 'Distance since Monday'
        }
        style={styles.section}
      />

      {!loading && board.length === 0 ? (
        <EmptyState
          title="Nobody has run yet this week"
          body="The first run of the week puts you at the top of the board. It is open."
          icon={<Footprints color={theme.colors.textMuted} size={26} />}
          action={<Button label="Track a run" onPress={goRun} />}
        />
      ) : (
        <Card variant="light" padding="base" radius="xl" style={styles.board}>
          {visible.map((e, i) => (
            <BoardRow key={e.uid} entry={e} rank={i + 1} name={nameOf(e.uid)} me={e.uid === uid} />
          ))}
          {showMineBelow && mine ? (
            <>
              <Text variant="caption" tone="muted" align="center" style={styles.gap}>
                ···
              </Text>
              <BoardRow entry={mine} rank={myRank} name="You" me />
            </>
          ) : null}
          {/*
            Somebody who has not run this week is not on the board at all — not
            at the bottom of it. Last place is where new members quit.
          */}
          {myRank === null ? (
            <Text variant="bodySm" tone="muted" style={styles.notOn}>
              You are not on the board yet this week. One run puts you on it.
            </Text>
          ) : null}
        </Card>
      )}

      {runs.length > 0 ? (
        <>
          <SectionHeader title="Latest runs" style={styles.section} />
          <View style={styles.feed}>
            {runs.slice(0, FEED_ROWS).map(r => (
              <FeedRow key={r.id} run={r} name={nameOf(r.uid)} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function BoardRow({
  entry,
  rank,
  name,
  me,
}: {
  entry: BoardEntry;
  rank: number;
  name: string;
  me: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        me && { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.md },
      ]}>
      <Text variant="statSm" tone={rank <= 3 ? 'accent' : 'muted'} style={styles.rank}>
        {rank}
      </Text>
      <Text variant={me ? 'bodyStrong' : 'body'} style={styles.flex} numberOfLines={1}>
        {name}
      </Text>
      <Text variant="caption" tone="muted" style={styles.runs}>
        {entry.runs} {entry.runs === 1 ? 'run' : 'runs'}
      </Text>
      <Text variant="bodyStrong">{km(entry.km)}</Text>
    </View>
  );
}

function FeedRow({ run, name }: { run: ClubRun; name: string }) {
  return (
    <ListRow
      title={name}
      subtitle={`${km(run.distanceKm)} ${run.kind} · ${formatPaceSec(paceOf(run))}/km`}
      leading={<Avatar name={name} size="md" />}
      trailing={
        <Text variant="caption" tone="muted">
          {relativeTime(run.createdAt)}
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  passed: { marginTop: 20 },
  passedHead: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  passedTitle: { marginTop: 10 },
  passedBody: { marginTop: 4 },
  passedActions: { flexDirection: 'row', alignItems: 'center', columnGap: 8, marginTop: 14 },
  section: { marginTop: 24 },
  board: { marginTop: 8, rowGap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  rank: { width: 24, textAlign: 'center' },
  flex: { flex: 1 },
  runs: { marginRight: 4 },
  gap: { marginVertical: 2 },
  notOn: { marginTop: 8, paddingHorizontal: 8 },
  feed: { marginTop: 4 },
});
