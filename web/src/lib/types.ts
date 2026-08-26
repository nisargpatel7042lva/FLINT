/** Domain types for the institutional dashboard. */

export type College = {
  id: string;
  name: string;
  coordinatorEmail: string;
};

export type Challenge = {
  id: string;
  collegeId: string;
  name: string;
  /** Inclusive ISO days, `YYYY-MM-DD`. */
  startDay: string;
  endDay: string;
  /** The code students enter during app onboarding to join. */
  joinCode: string;
};

export type Student = {
  id: string;
  /**
   * Display name. Kept deliberately coarse — a wellness coordinator has no
   * business seeing individual training detail, so the dashboard only ever
   * aggregates. See the note in analytics.ts.
   */
  name: string;
  enrolledDay: string;
};

/** One student's activity on one day. Absence of a row means "did not train". */
export type DailyLog = {
  studentId: string;
  day: string;
  minutes: number;
};
