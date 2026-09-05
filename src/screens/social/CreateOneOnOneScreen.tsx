import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Target, Users } from 'lucide-react-native';

import {
  Button,
  Card,
  IconButton,
  Input,
  OptionCard,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import {
  ACTIVITY_BY_CATEGORY,
  ACTIVITY_LABELS,
  type ActivityCategory,
  type ActivityKind,
} from '../../services/types';
import { generateInviteToken } from '../../services/challenges';
import { useTheme } from '../../theme';

const TARGET_OPTIONS = [7, 14, 21, 30, 60, 90] as const;

/**
 * Create a 1:1 challenge for the Flint MVP.
 * 
 * User picks activity type, target days, and gets a shareable invite link.
 */
export function CreateOneOnOneScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory>('Cardio');
  const [selectedActivity, setSelectedActivity] = useState<ActivityKind>('run');
  const [targetDays, setTargetDays] = useState(30);
  const [customDays, setCustomDays] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const activities = ACTIVITY_BY_CATEGORY[selectedCategory];

  const handleCreate = () => {
    const days = showCustom ? parseInt(customDays, 10) || targetDays : targetDays;
    
    // TODO: Call Firebase to create the challenge
    // For now, navigate to a detail screen (will be implemented)
    const token = generateInviteToken();
    console.log('Creating challenge:', {
      activityKind: selectedActivity,
      targetDays: days,
      inviteToken: token,
    });
    
    navigation.goBack();
  };

  const canCreate = selectedActivity && targetDays > 0;

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
        New 1:1 Challenge
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        Dare a friend. One activity, two people, pure streak.
      </Text>

      <SectionHeader title="Pick your activity" style={styles.section} />
      
      {/* Category Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}>
        {(Object.keys(ACTIVITY_BY_CATEGORY) as ActivityCategory[]).map(cat => (
          <Button
            key={cat}
            label={cat}
            size="sm"
            variant={selectedCategory === cat ? 'primary' : 'outline'}
            onPress={() => {
              setSelectedCategory(cat);
              setSelectedActivity(ACTIVITY_BY_CATEGORY[cat][0]);
            }}
          />
        ))}
      </ScrollView>

      {/* Activity Options */}
      <View style={styles.activityList}>
        {activities.map(activity => (
          <OptionCard
            key={activity}
            title={ACTIVITY_LABELS[activity]}
            selected={selectedActivity === activity}
            onPress={() => setSelectedActivity(activity)}
            icon={
              <Target
                color={
                  selectedActivity === activity
                    ? theme.colors.onAccent
                    : theme.colors.text
                }
                size={20}
              />
            }
          />
        ))}
      </View>

      <SectionHeader title="Target days in a row" style={styles.section} />
      <View style={styles.targetGrid}>
        {TARGET_OPTIONS.map(days => (
          <Button
            key={days}
            label={`${days} days`}
            size="md"
            variant={targetDays === days && !showCustom ? 'primary' : 'outline'}
            onPress={() => {
              setTargetDays(days);
              setShowCustom(false);
            }}
            style={styles.targetButton}
          />
        ))}
        <Button
          label="Custom"
          size="md"
          variant={showCustom ? 'primary' : 'outline'}
          onPress={() => setShowCustom(true)}
          style={styles.targetButton}
        />
      </View>

      {showCustom && (
        <Input
          label="Custom target (days)"
          placeholder="45"
          value={customDays}
          onChangeText={text => {
            setCustomDays(text);
            const num = parseInt(text, 10);
            if (!isNaN(num) && num > 0) {
              setTargetDays(num);
            }
          }}
          keyboardType="number-pad"
          containerStyle={styles.customInput}
        />
      )}

      <Card variant="light" padding="base" style={styles.explainer}>
        <View style={styles.explainerHead}>
          <Users color={theme.colors.accent} size={18} />
          <Text variant="bodyStrong">How it works</Text>
        </View>
        <Text variant="bodySm" tone="muted" style={styles.explainerBody}>
          Create the challenge and share the invite link. When they accept, the streak
          starts. Miss a day, break the streak. First to {targetDays} consecutive days
          wins, or push harder with a rematch.
        </Text>
      </Card>

      <Button
        label="Create challenge"
        size="lg"
        fullWidth
        disabled={!canCreate}
        style={styles.submit}
        onPress={handleCreate}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 4 },
  section: { marginTop: 28 },
  categoryScroll: { marginTop: 12 },
  categoryContent: { columnGap: 10 },
  activityList: { marginTop: 12, rowGap: 10 },
  targetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  targetButton: { minWidth: '30%' },
  customInput: { marginTop: 12 },
  explainer: { marginTop: 24 },
  explainerHead: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  explainerBody: { marginTop: 6 },
  submit: { marginTop: 28 },
});
