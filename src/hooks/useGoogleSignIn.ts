import { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { authErrorMessage, signInWithGoogle } from '../services/auth';
import { getSocialRepository } from '../services/socialRepositoryProvider';
import type { RootStackParamList } from '../navigation/types';
import { useProfile } from './useProfile';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * "Continue with Google", from sign-up or log-in alike.
 *
 * Where it lands depends on who it turns out to be: somebody already on Flint
 * (they have a public profile) goes straight to the city; somebody new goes on
 * to pick a name and a club, like an email sign-up.
 */
export function useGoogleSignIn() {
  const navigation = useNavigation<Nav>();
  const { update } = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await signInWithGoogle();
      if (res.state === 'cancelled') {
        return;
      }
      const existing = await getSocialRepository()
        .getProfile(res.user.uid)
        .catch(() => null);
      if (existing) {
        update({ completed: true });
        navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'City' } }] });
      } else {
        navigation.navigate('ProfileName');
      }
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [navigation, update]);

  return { go, busy, error };
}
