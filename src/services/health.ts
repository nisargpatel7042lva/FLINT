import { Platform } from 'react-native';

/**
 * Health data, behind one interface.
 *
 * Android reads Health Connect. iOS will read HealthKit — that implementation
 * is stubbed here rather than absent, so the iOS work is "fill in the methods"
 * and every caller is already written against the final shape. Nothing above
 * this file branches on Platform.
 */

export type HealthTotals = {
  steps: number;
  activeKcal: number;
  distanceKm: number;
};

export type HealthAvailability =
  | 'available'
  | 'not_installed'
  | 'unsupported_platform';

export type HealthSession = {
  startTime: Date;
  endTime: Date;
  title: string;
  kcal?: number;
};

export interface HealthProvider {
  readonly name: 'health_connect' | 'healthkit' | 'unavailable';
  isAvailable(): Promise<HealthAvailability>;
  requestPermissions(): Promise<boolean>;
  hasPermissions(): Promise<boolean>;
  /** Totals for one calendar day, local time. */
  readDailyTotals(day: Date): Promise<HealthTotals>;
  /** Writes a completed session back so other apps see it. */
  writeSession(session: HealthSession): Promise<void>;
}

const EMPTY: HealthTotals = { steps: 0, activeKcal: 0, distanceKm: 0 };

const dayBounds = (day: Date) => {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
};

/** Android — Health Connect. */
class HealthConnectProvider implements HealthProvider {
  readonly name = 'health_connect' as const;
  private initialised = false;

  private async hc() {
    // Imported lazily: the module touches native code on load, and the iOS
    // build must never pull it in.
    const mod = await import('react-native-health-connect');
    if (!this.initialised) {
      await mod.initialize();
      this.initialised = true;
    }
    return mod;
  }

  private get permissions() {
    return [
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'Distance' },
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'write', recordType: 'ExerciseSession' },
      { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
    ] as const;
  }

  async isAvailable(): Promise<HealthAvailability> {
    try {
      const mod = await import('react-native-health-connect');
      const status = await mod.getSdkStatus();
      // 3 === SDK_AVAILABLE in the Health Connect SDK.
      return status === 3 ? 'available' : 'not_installed';
    } catch {
      return 'not_installed';
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const mod = await this.hc();
      const granted = await mod.requestPermission(this.permissions as never);
      return granted.length > 0;
    } catch {
      return false;
    }
  }

  async hasPermissions(): Promise<boolean> {
    try {
      const mod = await this.hc();
      const granted = await mod.getGrantedPermissions();
      return granted.length > 0;
    } catch {
      return false;
    }
  }

  async readDailyTotals(day: Date): Promise<HealthTotals> {
    try {
      const mod = await this.hc();
      const { start, end } = dayBounds(day);
      const timeRangeFilter = { operator: 'between', startTime: start, endTime: end } as const;

      const [steps, kcal, distance] = await Promise.all([
        mod.aggregateRecord({ recordType: 'Steps', timeRangeFilter }),
        mod.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter }),
        mod.aggregateRecord({ recordType: 'Distance', timeRangeFilter }),
      ]);

      return {
        steps: Number((steps as { COUNT_TOTAL?: number }).COUNT_TOTAL ?? 0),
        activeKcal: Math.round(
          Number(
            (kcal as { ACTIVE_CALORIES_TOTAL?: { inKilocalories?: number } })
              .ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0,
          ),
        ),
        distanceKm:
          Math.round(
            Number(
              (distance as { DISTANCE?: { inMeters?: number } }).DISTANCE?.inMeters ?? 0,
            ) / 10,
          ) / 100,
      };
    } catch {
      return EMPTY;
    }
  }

  async writeSession(session: HealthSession): Promise<void> {
    const mod = await this.hc();
    await mod.insertRecords([
      {
        recordType: 'ExerciseSession',
        startTime: session.startTime.toISOString(),
        endTime: session.endTime.toISOString(),
        exerciseType: 79, // OTHER_WORKOUT
        title: session.title,
      },
    ] as never);
  }
}

/**
 * iOS — HealthKit. STUB.
 *
 * Deliberately shaped like the Android provider so the iOS work is filling in
 * these five methods (with `@kingstinct/react-native-healthkit` or similar)
 * and nothing above this file changes. It reports `unsupported_platform` today
 * rather than pretending to have data.
 */
class HealthKitProvider implements HealthProvider {
  readonly name = 'healthkit' as const;

  async isAvailable(): Promise<HealthAvailability> {
    return 'unsupported_platform';
  }
  async requestPermissions(): Promise<boolean> {
    return false;
  }
  async hasPermissions(): Promise<boolean> {
    return false;
  }
  async readDailyTotals(): Promise<HealthTotals> {
    return EMPTY;
  }
  async writeSession(): Promise<void> {
    // no-op until HealthKit is wired
  }
}

class UnavailableProvider implements HealthProvider {
  readonly name = 'unavailable' as const;
  async isAvailable(): Promise<HealthAvailability> {
    return 'unsupported_platform';
  }
  async requestPermissions() {
    return false;
  }
  async hasPermissions() {
    return false;
  }
  async readDailyTotals() {
    return EMPTY;
  }
  async writeSession() {}
}

let provider: HealthProvider | null = null;

export function getHealthProvider(): HealthProvider {
  if (!provider) {
    provider =
      Platform.OS === 'android'
        ? new HealthConnectProvider()
        : Platform.OS === 'ios'
        ? new HealthKitProvider()
        : new UnavailableProvider();
  }
  return provider;
}
