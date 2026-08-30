import type { SparkState } from '../components/spark/Spark';

/**
 * The opening flow.
 *
 * Six taps, no account, no form. The shape is: name the thing that stops you,
 * hear Spark answer that exact thing, say where you train and how long you
 * have, then finish one movement. The account offer comes last, once there is
 * something worth saving.
 *
 * Everything in this module is copy and structure — no generation, no storage.
 * The first session comes from the real exercise library via
 * `exercises.generateFocusSession`, filtered by the answers given here, and it
 * is logged through the same repository as every session after it.
 */
export type BarrierId = 'no_time' | 'lose_interest' | 'no_push' | 'no_plan';

/** Runtime list, so stored values can be validated without a second source. */
export const BARRIER_IDS: BarrierId[] = [
  'no_time',
  'lose_interest',
  'no_push',
  'no_plan',
];

export type Barrier = {
  id: BarrierId;
  title: string;
  /** Shown on the card. */
  blurb: string;
  /** Larger card for the dominant answer. */
  weight: 'primary' | 'standard';
  /** Spark's reaction — specific to this barrier, never a generic "got it". */
  response: {
    sparkState: SparkState;
    /** The headline Spark "says". Answers the barrier directly. */
    line: string;
    /** One supporting sentence. Concrete, no motivational filler. */
    detail: string;
  };
  /**
   * What Spark says the moment the first set is done.
   *
   * This is the point of asking. The opening asks somebody to admit the thing
   * that has beaten them before; if the app never refers to it again it has
   * taken an answer and given nothing back. `{minutes}` is substituted with
   * what the session actually cost, because the strongest possible reply to
   * "I have no time" is a true number.
   */
  payoff: string;
  /**
   * The same promise, in the present tense, for later in the app.
   *
   * Shown on the profile and used by the streak-at-risk copy, so the reason
   * somebody started is still visible on the day they nearly stop.
   */
  reminder: string;
};

export const BARRIERS: Barrier[] = [
  {
    id: 'no_time',
    title: 'No time',
    blurb: 'Between work, commute and everything else.',
    weight: 'primary',
    response: {
      sparkState: 'glowing',
      line: 'Then we never ask for an hour.',
      detail:
        'Tell me what you actually have today — even five minutes — and I will build around that number, not around a plan you have to fit into.',
    },
    payoff: 'You said you had no time. That cost you {minutes}.',
    reminder: 'Every session is built around the minutes you actually have.',
  },
  {
    id: 'lose_interest',
    title: 'I lose interest fast',
    blurb: 'Starts strong, gone by week three.',
    weight: 'standard',
    response: {
      sparkState: 'glowing',
      line: 'Then nothing here repeats itself.',
      detail:
        'Week three is where most apps lose you. Your sessions change, and your streak becomes the thing you do not want to break.',
    },
    payoff: 'Week three is the one to beat. This is day one of it.',
    reminder: 'Week three is the target. Your sessions change so it stays interesting.',
  },
  {
    id: 'no_push',
    title: 'No one to push me',
    blurb: 'Training alone gets old quickly.',
    weight: 'standard',
    response: {
      sparkState: 'glowing',
      line: 'Then you will not train alone.',
      detail:
        'You will be put against real people in Team Wars, where your effort adds to a group score and going missing is visible.',
    },
    payoff: 'Nobody pushed you into that one. Remember that when somebody does.',
    reminder: 'Friends can see your streak, and they can nudge you when it slips.',
  },
  {
    id: 'no_plan',
    title: "I don't know what to do",
    blurb: 'Too many exercises, no clear order.',
    weight: 'standard',
    response: {
      sparkState: 'glowing',
      line: 'Then you never have to choose.',
      detail:
        'I pick the session, the order and the timing. You just start it — beginning right now, with one.',
    },
    payoff: 'You did not have to pick a thing. That is how it stays.',
    reminder: 'The session is always already chosen. You only have to start it.',
  },
];

export const barrierById = (id: BarrierId): Barrier =>
  BARRIERS.find(b => b.id === id) ?? BARRIERS[0];

/**
 * Spark's reply to the barrier, once the first movement is done.
 *
 * The minutes are phrased rather than printed raw — "four minutes" reads as a
 * remark and "4" reads as a metric, and this is the one line in the flow that
 * is meant to sound like somebody talking.
 */
export function barrierPayoff(id: BarrierId, minutes: number): string {
  const spent = minutes <= 1 ? 'about a minute' : `${minutes} minutes`;
  return barrierById(id).payoff.replace('{minutes}', spent);
}

export const barrierReminder = (id: BarrierId): string =>
  barrierById(id).reminder;

// ── Flow shape ─────────────────────────────────────────────────────────────

/**
 * The steps that carry a progress indicator.
 *
 * Splash is excluded on purpose: it is the invitation, and putting "1 of 5"
 * under it turns a one-sentence opening into a form somebody is about to
 * start filling in. Counting begins once they have said yes.
 */
export const FLOW_STEPS = ['Barrier', 'Place', 'Time', 'Session'] as const;

export type FlowStep = (typeof FLOW_STEPS)[number];

export const FLOW_LENGTH = FLOW_STEPS.length;

export const flowIndex = (step: FlowStep): number => FLOW_STEPS.indexOf(step);
