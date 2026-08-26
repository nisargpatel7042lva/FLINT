import { isFirebaseConfigured } from './backend';
import { FirestoreSocialRepository } from './socialRepository.firestore';
import { LocalSocialRepository } from './socialRepository.local';
import type { SocialRepository } from './socialRepository';

/**
 * Chooses the live social repository once, at first use.
 *
 * Mirrors `getRepository()` for training data: screens never branch on "do we
 * have Firebase?", they use whichever implementation they are handed.
 */
let instance: SocialRepository | null = null;

export function getSocialRepository(): SocialRepository {
  if (!instance) {
    instance = isFirebaseConfigured()
      ? new FirestoreSocialRepository()
      : new LocalSocialRepository();
  }
  return instance;
}

/** For tests, and for forcing the local backend during development. */
export function __setSocialRepository(repo: SocialRepository | null) {
  instance = repo;
}
