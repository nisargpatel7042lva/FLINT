import type { TourStep } from '../../components';

/**
 * The first-run walkthrough.
 *
 * Three steps, in the order the loop actually runs. Kept short deliberately:
 * this app's whole premise is that people have no time, and a nine-step tour
 * would contradict the product on the user's first screen.
 *
 * The copy is in Spark's voice — warm, specific, never instructional-manual.
 */
export const HOME_TOUR: TourStep[] = [
  {
    target: 'streak',
    title: 'Your spark, and your streak',
    body: 'Your spark stays lit while you keep training, and dims when you stop. The bars show the last seven days at a glance.',
  },
  {
    target: 'checkin',
    title: 'Start with the time you actually have',
    body: 'Set the slider to whatever is realistic today — five minutes counts. Everything below re-fits to that number.',
  },
  {
    target: 'session',
    title: 'Your session, already sized',
    body: 'Built to fit the budget you just set, rest included. Tap it and you are training.',
  },
];
