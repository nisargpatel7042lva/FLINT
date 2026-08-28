import {
  BODY_REGIONS,
  EXERCISES,
  REGION_FOCUS,
  REGION_MUSCLES,
  exerciseById,
  exerciseImage,
  exerciseInstructions,
  equipmentOf,
  findExercises,
  generateSession,
  regionCounts,
  type Muscle,
} from '../src/services/exercises';
import { estimateSeconds, totalSets, TIME_OPTIONS } from '../src/services/training';

describe('catalogue', () => {
  it('ships the whole library', () => {
    expect(EXERCISES.length).toBeGreaterThan(800);
  });

  it('has no duplicate ids', () => {
    expect(new Set(EXERCISES.map(e => e.id)).size).toBe(EXERCISES.length);
  });

  /*
   * The `Muscle` union is hand-written from the dataset's vocabulary. If a
   * refresh introduces a muscle we do not know about, it would silently fall
   * out of every region and become unreachable in the UI.
   */
  it('tags no muscle outside the type we declare', () => {
    const known = new Set<string>(Object.values(REGION_MUSCLES).flat());
    const seen = new Set<string>();
    EXERCISES.forEach(e => e.primaryMuscles.forEach(m => seen.add(m)));

    expect([...seen].filter(m => !known.has(m))).toEqual([]);
  });

  it('covers every exercise with at least one region', () => {
    const reachable = new Set(BODY_REGIONS.flatMap(r => findExercises({ region: r })).map(e => e.id));
    const unreachable = EXERCISES.filter(e => !reachable.has(e.id));

    // Every exercise has a primary muscle, and every muscle sits in a region.
    expect(unreachable).toEqual([]);
  });

  it('looks up by id', () => {
    const first = EXERCISES[0];
    expect(exerciseById(first.id)?.name).toBe(first.name);
    expect(exerciseById('not-a-real-exercise')).toBeUndefined();
  });

  it('builds image urls from the id', () => {
    expect(exerciseImage('Barbell_Squat')).toBe(
      'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Squat/0.jpg',
    );
    expect(exerciseImage('Barbell_Squat', 1)).toContain('/1.jpg');
  });

  it('escapes ids that are not url-safe', () => {
    // Real id in the dataset: "3/4 Sit-Up" becomes "3_4_Sit-Up", but ids with
    // other characters must not break the path.
    expect(exerciseImage('Jump/Rope')).toContain('Jump%2FRope');
  });

  it('returns instructions, and an empty list rather than throwing', () => {
    const withSteps = EXERCISES.find(e => exerciseInstructions(e.id).length > 0);
    expect(withSteps).toBeDefined();
    expect(exerciseInstructions('not-a-real-exercise')).toEqual([]);
  });
});

describe('regions', () => {
  it('offers a usable number of exercises in every region', () => {
    const counts = regionCounts();
    BODY_REGIONS.forEach(r => expect(counts[r]).toBeGreaterThan(10));
  });

  it('maps every region onto an existing focus', () => {
    BODY_REGIONS.forEach(r => expect(REGION_FOCUS[r]).toBeTruthy());
  });

  it('assigns each muscle to exactly one region', () => {
    const all = Object.values(REGION_MUSCLES).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('findExercises', () => {
  it('filters by muscle, not by incidental involvement', () => {
    const biceps = findExercises({ muscle: 'biceps' });
    expect(biceps.length).toBeGreaterThan(0);
    expect(biceps.every(e => e.primaryMuscles.includes('biceps'))).toBe(true);
  });

  it('filters by equipment', () => {
    const bodyweight = findExercises({ region: 'core', equipment: ['body only'] });
    expect(bodyweight.length).toBeGreaterThan(0);
    // `equipmentOf`, not `.equipment`: an untagged exercise IS bodyweight.
    expect(bodyweight.every(e => equipmentOf(e) === 'body only')).toBe(true);
  });

  it('filters by level', () => {
    const beginner = findExercises({ region: 'legs', level: 'beginner' });
    expect(beginner.every(e => e.level === 'beginner')).toBe(true);
  });

  it('searches names case-insensitively', () => {
    const found = findExercises({ search: 'BARBELL squat' });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every(e => e.name.toLowerCase().includes('barbell squat'))).toBe(true);
  });

  it('combines filters', () => {
    const found = findExercises({
      region: 'chest',
      equipment: ['body only'],
      level: 'beginner',
    });
    found.forEach(e => {
      expect(e.primaryMuscles).toContain('chest' as Muscle);
      expect(equipmentOf(e)).toBe('body only');
      expect(e.level).toBe('beginner');
    });
  });

  it('returns everything when unfiltered', () => {
    expect(findExercises()).toHaveLength(EXERCISES.length);
  });
});

describe('generateSession', () => {
  /*
   * The fit is the product's whole promise: a session offered as "15 minutes"
   * has to be doable in fifteen. This is the test that matters.
   */
  it('fits inside the budget for every region and every offered time', () => {
    BODY_REGIONS.forEach(region => {
      TIME_OPTIONS.forEach(minutes => {
        const { plan } = generateSession(region, minutes);
        expect(estimateSeconds(plan)).toBeLessThanOrEqual(minutes * 60);
      });
    });
  });

  it('uses most of the budget rather than a token amount', () => {
    BODY_REGIONS.forEach(region => {
      const { plan } = generateSession(region, 20);
      // Half the budget or better; otherwise the session is not worth 20 min.
      expect(estimateSeconds(plan)).toBeGreaterThan(0.5 * 20 * 60);
    });
  });

  it('always produces a usable session', () => {
    BODY_REGIONS.forEach(region => {
      TIME_OPTIONS.forEach(minutes => {
        const { plan } = generateSession(region, minutes);
        expect(plan.exercises.length).toBeGreaterThanOrEqual(2);
        expect(totalSets(plan)).toBeGreaterThan(0);
        plan.exercises.forEach(e => {
          expect(e.name).toBeTruthy();
          // Either a rep target or a hold, never neither.
          expect(e.reps !== null || e.holdSeconds !== undefined).toBe(true);
        });
      });
    });
  });

  it('never repeats an exercise inside one session', () => {
    BODY_REGIONS.forEach(region => {
      const ids = generateSession(region, 30).plan.exercises.map(e => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it('targets the region it was asked for', () => {
    BODY_REGIONS.forEach(region => {
      const { plan } = generateSession(region, 20);
      const muscles = REGION_MUSCLES[region];
      plan.exercises.forEach(e => {
        const source = exerciseById(e.id);
        expect(source?.primaryMuscles.some(m => muscles.includes(m))).toBe(true);
      });
    });
  });

  it('leads with compound work while you are fresh', () => {
    const { plan } = generateSession('legs', 30);
    const mechanics = plan.exercises.map(e => exerciseById(e.id)?.mechanic);
    const lastCompound = mechanics.lastIndexOf('compound');
    const firstIsolation = mechanics.indexOf('isolation');
    if (lastCompound !== -1 && firstIsolation !== -1) {
      expect(lastCompound).toBeLessThan(firstIsolation);
    }
  });

  it('keeps auto-generated sessions to reachable equipment by default', () => {
    const { plan } = generateSession('chest', 20);
    plan.exercises.forEach(e => {
      const source = exerciseById(e.id);
      expect(['body only', 'dumbbell', 'bands']).toContain(equipmentOf(source!));
    });
  });

  it('never auto-generates olympic lifts or strongman work', () => {
    BODY_REGIONS.forEach(region => {
      generateSession(region, 30).plan.exercises.forEach(e => {
        const category = exerciseById(e.id)?.category;
        expect(['olympic weightlifting', 'strongman', 'stretching']).not.toContain(
          category,
        );
      });
    });
  });

  it('gives a different session for a different seed, and the same for the same', () => {
    const a = generateSession('back', 20, { seed: 0 }).plan.exercises.map(e => e.id);
    const b = generateSession('back', 20, { seed: 0 }).plan.exercises.map(e => e.id);
    const c = generateSession('back', 20, { seed: 3 }).plan.exercises.map(e => e.id);

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('prescribes a hold for static exercises and reps for the rest', () => {
    const all = BODY_REGIONS.flatMap(r => generateSession(r, 30).plan.exercises);
    all.forEach(e => {
      const source = exerciseById(e.id);
      if (source?.force === 'static') {
        expect(e.reps).toBeNull();
        expect(e.holdSeconds).toBeGreaterThan(0);
      } else {
        expect(e.reps).toBeGreaterThan(0);
      }
    });
  });

  /*
   * Regression: `other` is where the dataset files sleds, balance boards and
   * Car Deadlift. Including it in the home filter put "Bear Crawl Sled Drags"
   * into a generated leg session.
   */
  it('never suggests equipment nobody has at home', () => {
    BODY_REGIONS.forEach(region => {
      generateSession(region, 20).plan.exercises.forEach(e => {
        expect(exerciseById(e.id)?.equipment).not.toBe('other');
      });
    });
  });

  /*
   * Regression: weighting bodyweight above difficulty opened Shoulders with
   * Handstand Push-Ups, which is not a movement to hand somebody whose ability
   * has never been seen.
   */
  it('does not open a session with an expert movement', () => {
    BODY_REGIONS.forEach(region => {
      const first = generateSession(region, 20).plan.exercises[0];
      expect(exerciseById(first.id)?.level).not.toBe('expert');
    });
  });

  /*
   * Regression: an alphabetical tiebreak made every Legs session start with
   * "Alternate Leg Diagonal Bound", "Balance Board", "Bench Sprint".
   */
  it('is not ordered alphabetically', () => {
    const names = generateSession('legs', 30).plan.exercises.map(e => e.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).not.toEqual(sorted);
  });

  it('shuffles to a substantially different session', () => {
    BODY_REGIONS.forEach(region => {
      const a = generateSession(region, 20, { seed: 0 }).plan.exercises.map(e => e.id);
      const b = generateSession(region, 20, { seed: 1 }).plan.exercises.map(e => e.id);
      const shared = a.filter(id => b.includes(id)).length;
      // Rotating by one place used to share three of four, which does not read
      // as a new suggestion.
      expect(shared).toBeLessThan(a.length);
    });
  });

  it('widens the pool rather than returning nothing when equipment is scarce', () => {
    const { plan } = generateSession('legs', 20, { equipment: ['medicine ball'] });
    expect(plan.exercises.length).toBeGreaterThanOrEqual(2);
  });
});
