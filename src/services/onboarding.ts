import type { CharState } from '../components/char/Char';

/**
 * First-60-seconds onboarding content.
 *
 * The barriers mirror the real survey answers. `weight` drives visual
 * hierarchy, not ordering logic — "No time" is the dominant real-world answer
 * so it gets the larger card, but the other three stay fully visible rather
 * than being demoted behind a "more" affordance.
 */
export type BarrierId = 'no_time' | 'lose_interest' | 'no_push' | 'no_plan';

export type Barrier = {
  id: BarrierId;
  title: string;
  /** Shown on the card. */
  blurb: string;
  /** Larger card for the dominant answer. */
  weight: 'primary' | 'standard';
  /** Char's reaction — specific to this barrier, never a generic "got it". */
  response: {
    charState: CharState;
    /** The headline Char "says". Answers the barrier directly. */
    line: string;
    /** One supporting sentence. Concrete, no motivational filler. */
    detail: string;
  };
};

export const BARRIERS: Barrier[] = [
  {
    id: 'no_time',
    title: 'No time',
    blurb: 'Between work, commute and everything else.',
    weight: 'primary',
    response: {
      charState: 'glowing',
      line: 'Then we never ask for an hour.',
      detail:
        'Tell me what you actually have today — even five minutes — and I will build around that number, not around a plan you have to fit into.',
    },
  },
  {
    id: 'lose_interest',
    title: 'I lose interest fast',
    blurb: 'Starts strong, gone by week three.',
    weight: 'standard',
    response: {
      charState: 'glowing',
      line: 'Then nothing here repeats itself.',
      detail:
        'Week three is where most apps lose you. Your sessions change, and your streak becomes the thing you do not want to break.',
    },
  },
  {
    id: 'no_push',
    title: 'No one to push me',
    blurb: 'Training alone gets old quickly.',
    weight: 'standard',
    response: {
      charState: 'glowing',
      line: 'Then you will not train alone.',
      detail:
        'You will be put against real people in Team Wars, where your effort adds to a group score and going missing is visible.',
    },
  },
  {
    id: 'no_plan',
    title: "I don't know what to do",
    blurb: 'Too many exercises, no clear order.',
    weight: 'standard',
    response: {
      charState: 'glowing',
      line: 'Then you never have to choose.',
      detail:
        'I pick the session, the order and the timing. You just start it — beginning right now, with one.',
    },
  },
];

export const barrierById = (id: BarrierId): Barrier =>
  BARRIERS.find(b => b.id === id) ?? BARRIERS[0];

// ── Workout generation ─────────────────────────────────────────────────────

export type GeneratedExercise = {
  id: string;
  name: string;
  detail: string;
  seconds: number;
};

export type GeneratedWorkout = {
  title: string;
  minutes: number;
  exercises: GeneratedExercise[];
};

/**
 * TODO: replace with real workout generation.
 *
 * This is a deliberate stub. It fills the requested time budget from a fixed
 * pool at a fixed ratio and does not consider the user's goal, equipment,
 * fitness level, injury history, recovery state, or what they did yesterday —
 * all of which the real generator must.
 *
 * The signature is the contract worth keeping: minutes in, an ordered list of
 * timed exercises out, summing to the budget.
 */
export function generateWorkout(minutes: number): GeneratedWorkout {
  const POOL: Omit<GeneratedExercise, 'seconds' | 'id'>[] = [
    { name: 'Jumping jacks', detail: 'Warm up, steady pace' },
    { name: 'Bodyweight squats', detail: 'Chest up, full depth' },
    { name: 'Push-ups', detail: 'Knees down is fine' },
    { name: 'Reverse lunges', detail: 'Alternate legs' },
    { name: 'Plank', detail: 'Hold, hips level' },
    { name: 'Glute bridges', detail: 'Squeeze at the top' },
    { name: 'Mountain climbers', detail: 'Controlled, not frantic' },
    { name: 'Dead bug', detail: 'Slow, ribs down' },
  ];

  // One exercise per ~2.5 minutes, clamped so a 5-minute session is not a
  // single move and a 30-minute one is not an unreadable wall.
  const count = Math.min(Math.max(Math.round(minutes / 2.5), 2), 8);
  const perExercise = Math.round((minutes * 60) / count);

  return {
    title: `${minutes}-minute starter`,
    minutes,
    exercises: POOL.slice(0, count).map((e, i) => ({
      ...e,
      id: `ex${i + 1}`,
      seconds: perExercise,
    })),
  };
}
