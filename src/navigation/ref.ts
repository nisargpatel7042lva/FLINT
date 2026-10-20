import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

/** For the few things outside a screen that still need to navigate (alerts). */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
