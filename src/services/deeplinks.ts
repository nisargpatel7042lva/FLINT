/**
 * Deep link handling for Flint challenge invites.
 * 
 * Handles URLs like:
 * - flint://invite/ABC123XY
 * - https://flint.app/invite/ABC123XY
 */

import { Linking } from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';

/**
 * Parse a challenge invite URL.
 */
export function parseInviteUrl(url: string): { token: string } | null {
  try {
    // Handle both app scheme and https URLs
    const regex = /(?:flint:\/\/|https?:\/\/(?:www\.)?flint\.app\/)invite\/([A-Z0-9]+)/i;
    const match = url.match(regex);
    
    if (match && match[1]) {
      return { token: match[1] };
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Initialize deep link handling.
 */
export function initDeepLinks(
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList>>,
) {
  // Handle initial URL (app opened via deep link)
  Linking.getInitialURL().then(url => {
    if (url) {
      handleDeepLink(url, navigationRef);
    }
  });

  // Handle URL when app is already open
  const subscription = Linking.addEventListener('url', ({ url }) => {
    handleDeepLink(url, navigationRef);
  });

  return () => {
    subscription.remove();
  };
}

/**
 * Handle a deep link URL.
 */
function handleDeepLink(
  url: string,
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList>>,
) {
  const invite = parseInviteUrl(url);
  
  if (invite && navigationRef.current?.isReady()) {
    // Navigate to accept challenge screen
    navigationRef.current.navigate('AcceptChallenge', { token: invite.token });
  }
}

/**
 * React Navigation linking configuration.
 */
export const linkingConfig = {
  prefixes: ['flint://', 'https://flint.app', 'https://www.flint.app'],
  config: {
    screens: {
      AcceptChallenge: 'invite/:token',
      ChallengeDetail: 'challenge/:challengeId',
      Tabs: {
        screens: {
          Home: '',
          Train: 'train',
          History: 'history',
          Profile: 'profile',
        },
      },
    },
  },
};
