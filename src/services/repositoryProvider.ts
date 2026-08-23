import { isFirebaseConfigured } from './backend';
import { FirestoreTrainingRepository } from './repository.firestore';
import { LocalTrainingRepository } from './repository.local';
import type { TrainingRepository } from './repository';

/**
 * Chooses the live repository once, at first use.
 *
 * Deciding here rather than at each call site means screens never branch on
 * "do we have Firebase?" — they just use the repository they are handed.
 */
let instance: TrainingRepository | null = null;

export function getRepository(): TrainingRepository {
  if (!instance) {
    instance = isFirebaseConfigured()
      ? new FirestoreTrainingRepository()
      : new LocalTrainingRepository();
  }
  return instance;
}

/** For tests, and for forcing the local backend during development. */
export function __setRepository(repo: TrainingRepository | null) {
  instance = repo;
}
