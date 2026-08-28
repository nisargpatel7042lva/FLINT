import {
  DEFAULT_PROFILE,
  ageFrom,
  canEstimateCalories,
  categoriesFor,
  cmToFeetInches,
  equipmentFor,
  feetInchesToCm,
  formatHeight,
  formatWeight,
  kcalFor,
  kgToLb,
  lbToKg,
  levelsFor,
  loadProfile,
  saveProfile,
  type TrainingProfile,
} from '../src/services/profile';
import {
  BODY_REGIONS,
  equipmentOf,
  exerciseById,
  generateFocusSession,
  generateSession,
} from '../src/services/exercises';
import { estimateSeconds, TIME_OPTIONS } from '../src/services/training';
import type { Focus } from '../src/services/training';

const profileWith = (patch: Partial<TrainingProfile>): TrainingProfile => ({
  ...DEFAULT_PROFILE,
  ...patch,
});

describe('equipmentFor', () => {
  /*
   * This is the whole reason setup asks where you train. If it regresses,
   * somebody in a bedroom is offered a cable crossover.
   */
  it('keeps home training to what fits in a living room', () => {
    const kit = equipmentFor(profileWith({ place: 'home' }));
    expect(kit).toEqual(['body only', 'dumbbell', 'bands']);
    expect(kit).not.toContain('machine');
    expect(kit).not.toContain('barbell');
    expect(kit).not.toContain('cable');
  });

  it('opens up the gym floor for gym training', () => {
    const kit = equipmentFor(profileWith({ place: 'gym' }));
    expect(kit).toContain('machine');
    expect(kit).toContain('barbell');
    expect(kit).toContain('cable');
  });

  it('never includes `other`, which is where sleds and Car Deadlift live', () => {
    (['home', 'gym', 'both'] as const).forEach(place => {
      expect(equipmentFor(profileWith({ place }))).not.toContain('other');
    });
  });
});

describe('levelsFor', () => {
  it('gives a newcomer beginner work only', () => {
    expect(levelsFor(profileWith({ experience: 'new' }))).toEqual(['beginner']);
  });

  it('widens rather than switches, so good beginner movements stay', () => {
    // Hiding beginner work from an experienced lifter would leave a worse
    // session, not a harder one — plenty of the best exercises are tagged
    // beginner.
    expect(levelsFor(profileWith({ experience: 'some' }))).toContain('beginner');
    expect(levelsFor(profileWith({ experience: 'experienced' }))).toContain('beginner');
  });

  it('only unlocks expert movements for the experienced', () => {
    expect(levelsFor(profileWith({ experience: 'new' }))).not.toContain('expert');
    expect(levelsFor(profileWith({ experience: 'some' }))).not.toContain('expert');
    expect(levelsFor(profileWith({ experience: 'experienced' }))).toContain('expert');
  });
});

describe('categoriesFor', () => {
  it('always includes strength', () => {
    (['lose', 'build', 'endurance', 'healthy'] as const).forEach(goal => {
      expect(categoriesFor(profileWith({ goal }))).toContain('strength');
    });
  });

  it('adds conditioning for weight loss and endurance', () => {
    expect(categoriesFor(profileWith({ goal: 'lose' }))).toContain('cardio');
    expect(categoriesFor(profileWith({ goal: 'endurance' }))).toContain('plyometrics');
  });
});

describe('sessions honour the profile', () => {
  const home = profileWith({ place: 'home', experience: 'new' });
  const gym = profileWith({ place: 'gym', experience: 'experienced' });

  it('never puts gym equipment in a home session', () => {
    BODY_REGIONS.forEach(region => {
      const { plan } = generateSession(region, 20, {
        equipment: equipmentFor(home),
        levels: levelsFor(home),
        categories: categoriesFor(home),
      });
      plan.exercises.forEach(e => {
        expect(['body only', 'dumbbell', 'bands']).toContain(
          equipmentOf(exerciseById(e.id)!),
        );
      });
    });
  });

  it('does put gym equipment in a gym session', () => {
    // Across all regions at least some machine or barbell work should appear;
    // otherwise answering "gym" changed nothing and the question was pointless.
    const equipmentUsed = BODY_REGIONS.flatMap(region =>
      generateSession(region, 20, {
        equipment: equipmentFor(gym),
        levels: levelsFor(gym),
        categories: categoriesFor(gym),
      }).plan.exercises.map(e => equipmentOf(exerciseById(e.id)!)),
    );

    expect(
      equipmentUsed.some(e => e === 'machine' || e === 'barbell' || e === 'cable'),
    ).toBe(true);
  });

  it('gives a beginner no expert movements', () => {
    BODY_REGIONS.forEach(region => {
      generateSession(region, 20, {
        equipment: equipmentFor(home),
        levels: levelsFor(home),
      }).plan.exercises.forEach(e => {
        expect(exerciseById(e.id)?.level).toBe('beginner');
      });
    });
  });
});

describe('generateFocusSession', () => {
  const ALL: Focus[] = ['legs', 'upper', 'core', 'full', 'cardio'];

  it('fits the budget for every focus at every offered time', () => {
    ALL.forEach(focus => {
      TIME_OPTIONS.forEach(minutes => {
        const { plan } = generateFocusSession(focus, minutes);
        expect(estimateSeconds(plan)).toBeLessThanOrEqual(minutes * 60);
        expect(plan.exercises.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  it('keeps the focus it was asked for', () => {
    ALL.forEach(focus => {
      expect(generateFocusSession(focus, 20).plan.focus).toBe(focus);
    });
  });

  /*
   * Without the spread rule, "Full Body" is whatever ranks highest overall —
   * in practice four chest movements, which is technically correct and
   * obviously not full body.
   */
  it('spreads a full-body session across different muscles', () => {
    const { plan } = generateFocusSession('full', 30);
    const primary = plan.exercises.map(e => exerciseById(e.id)?.primaryMuscles[0]);
    expect(new Set(primary).size).toBe(primary.length);
  });

  it('draws cardio from conditioning work, not from strength', () => {
    generateFocusSession('cardio', 20).plan.exercises.forEach(e => {
      expect(['cardio', 'plyometrics']).toContain(exerciseById(e.id)?.category);
    });
  });

  it('changes what it offers when the profile changes', () => {
    const atHome = generateFocusSession('upper', 20, {
      equipment: equipmentFor(profileWith({ place: 'home' })),
    }).plan.exercises.map(e => e.id);
    const atGym = generateFocusSession('upper', 20, {
      equipment: equipmentFor(profileWith({ place: 'gym' })),
    }).plan.exercises.map(e => e.id);

    expect(atHome).not.toEqual(atGym);
  });
});

describe('calories', () => {
  it('scales with body mass', () => {
    const light = kcalFor(profileWith({ weightKg: 55 }), 30);
    const heavy = kcalFor(profileWith({ weightKg: 95 }), 30);
    expect(heavy).toBeGreaterThan(light);
  });

  it('costs more for running than for walking', () => {
    const p = profileWith({ weightKg: 70 });
    expect(kcalFor(p, 30, 'run')).toBeGreaterThan(kcalFor(p, 30, 'walk'));
  });

  it('falls back to a flat guess without a weight, and says so', () => {
    const p = profileWith({ weightKg: undefined });
    expect(canEstimateCalories(p)).toBe(false);
    expect(kcalFor(p, 30)).toBe(240);
  });

  it('produces a plausible number for a real person', () => {
    // 70kg, 30 minutes of strength work. Published tables put this near 180.
    expect(kcalFor(profileWith({ weightKg: 70 }), 30)).toBeGreaterThan(120);
    expect(kcalFor(profileWith({ weightKg: 70 }), 30)).toBeLessThan(250);
  });
});

describe('age', () => {
  /*
   * Birth year is stored, not age. Storing age means it is wrong from the next
   * birthday onward and nothing ever corrects it.
   */
  it('derives age from birth year, so it never goes stale', () => {
    const thisYear = new Date().getFullYear();
    expect(ageFrom(thisYear - 30)).toBe(30);
    expect(ageFrom(undefined)).toBeUndefined();
  });
});

describe('units', () => {
  it('round-trips height through feet and inches', () => {
    const { feet, inches } = cmToFeetInches(180);
    expect(feet).toBe(5);
    expect(inches).toBe(11);
    expect(Math.abs(feetInchesToCm(feet, inches) - 180)).toBeLessThanOrEqual(1);
  });

  it('round-trips weight through pounds', () => {
    expect(Math.abs(lbToKg(kgToLb(80)) - 80)).toBeLessThanOrEqual(1);
  });

  it('formats in the chosen unit, and shows a dash when unknown', () => {
    expect(formatHeight(180, 'metric')).toBe('180 cm');
    expect(formatHeight(180, 'imperial')).toBe('5\'11"');
    expect(formatWeight(80, 'metric')).toBe('80 kg');
    expect(formatWeight(undefined, 'metric')).toBe('—');
  });
});

describe('persistence', () => {
  it('round-trips a profile', async () => {
    const saved = profileWith({
      place: 'gym',
      experience: 'experienced',
      weightKg: 82,
      birthYear: 1998,
      completed: true,
    });
    await saveProfile(saved);
    const loaded = await loadProfile();

    expect(loaded.place).toBe('gym');
    expect(loaded.experience).toBe('experienced');
    expect(loaded.weightKg).toBe(82);
    expect(loaded.completed).toBe(true);
  });

  it('rejects stored values that are not physically plausible', async () => {
    await saveProfile({
      ...DEFAULT_PROFILE,
      weightKg: 5000,
      heightCm: 12,
      birthYear: 1200,
    } as TrainingProfile);
    const loaded = await loadProfile();

    // Dropped rather than clamped: a wrong number presented confidently is
    // worse than no number.
    expect(loaded.weightKg).toBeUndefined();
    expect(loaded.heightCm).toBeUndefined();
    expect(loaded.birthYear).toBeUndefined();
  });

  it('falls back to defaults rather than throwing on nonsense', async () => {
    await saveProfile({ place: 'moon' } as unknown as TrainingProfile);
    const loaded = await loadProfile();
    expect(loaded.place).toBe(DEFAULT_PROFILE.place);
  });
});
