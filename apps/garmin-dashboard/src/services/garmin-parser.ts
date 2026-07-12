/**
 * Client-side parser for Garmin Connect data exports.
 * Handles ZIP extraction and parsing of JSON/FIT files into app domain types.
 *
 * Supports:
 * - Full Garmin Connect data export (ZIP with DI_CONNECT structure)
 * - Individual FIT file uploads
 * - Individual JSON file uploads
 */

import JSZip from 'jszip';
import FitParser from 'fit-file-parser';
import type { Activity, ActivityType, DailySummary, UserProfile } from '@/types/garmin';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeSeriesReading {
  time: string; // ISO timestamp
  value: number;
}

export interface DailyDetailData {
  heartRates: TimeSeriesReading[];
  stressReadings: TimeSeriesReading[];
  bodyBatteryReadings: TimeSeriesReading[];
}

export interface ParseResult {
  activities: Activity[];
  dailySummaries: DailySummary[];
  dailyDetails: Record<string, DailyDetailData>;
  userProfile: UserProfile | null;
  errors: ParseError[];
}

export interface ParseError {
  file: string;
  message: string;
}

export interface ParseProgress {
  phase: 'extracting' | 'parsing' | 'complete' | 'error';
  current: number;
  total: number;
  currentFile?: string;
}

type ProgressCallback = (progress: ParseProgress) => void;

// ─── Main Parse Functions ─────────────────────────────────────────────────────

/**
 * Parses a Garmin data export ZIP file.
 * Extracts and processes JSON activity summaries, wellness data, and user profile.
 */
export async function parseGarminZip(
  file: File,
  onProgress?: ProgressCallback
): Promise<ParseResult> {
  const result: ParseResult = {
    activities: [],
    dailySummaries: [],
    dailyDetails: {},
    userProfile: null,
    errors: [],
  };

  onProgress?.({ phase: 'extracting', current: 0, total: 1 });

  let zip: JSZip;
  try {
    const buffer = await file.arrayBuffer();
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return {
      ...result,
      errors: [{ file: file.name, message: 'Failed to extract ZIP file. Is it a valid ZIP?' }],
    };
  }

  const files = Object.keys(zip.files);
  const totalFiles = files.length;

  onProgress?.({ phase: 'parsing', current: 0, total: totalFiles });

  let processed = 0;

  // Parse fitness activity JSON files
  const fitnessFiles = files.filter(
    (f) => f.includes('DI-Connect-Fitness/') && f.endsWith('.json')
  );
  for (const path of fitnessFiles) {
    try {
      onProgress?.({ phase: 'parsing', current: ++processed, total: totalFiles, currentFile: path });
      const content = await zip.files[path]!.async('string');
      const parsed = JSON.parse(content);
      const activities = parseActivityJson(parsed, path);
      result.activities.push(...activities);
    } catch (error) {
      result.errors.push({
        file: path,
        message: error instanceof Error ? error.message : 'Failed to parse file',
      });
    }
  }

  // Parse wellness dailies JSON
  const wellnessFiles = files.filter(
    (f) => f.includes('DI-Connect-Wellness/') && f.includes('_dailies.json')
  );
  for (const path of wellnessFiles) {
    try {
      onProgress?.({ phase: 'parsing', current: ++processed, total: totalFiles, currentFile: path });
      const content = await zip.files[path]!.async('string');
      const parsed = JSON.parse(content);
      const summaries = parseDailiesJson(parsed);
      result.dailySummaries.push(...summaries);
    } catch (error) {
      result.errors.push({
        file: path,
        message: error instanceof Error ? error.message : 'Failed to parse file',
      });
    }
  }

  // Parse sleep data
  const sleepFiles = files.filter(
    (f) => f.includes('DI-Connect-Wellness/') && f.includes('_sleepData.json')
  );
  for (const path of sleepFiles) {
    try {
      onProgress?.({ phase: 'parsing', current: ++processed, total: totalFiles, currentFile: path });
      const content = await zip.files[path]!.async('string');
      const parsed = JSON.parse(content);
      mergeSleepData(result.dailySummaries, parsed);
    } catch (error) {
      result.errors.push({
        file: path,
        message: error instanceof Error ? error.message : 'Failed to parse sleep data',
      });
    }
  }

  // Parse user profile
  const profileFile = files.find(
    (f) => f.includes('DI-Connect-User/') && f.includes('user_profile.json')
  );
  if (profileFile) {
    try {
      onProgress?.({
        phase: 'parsing',
        current: ++processed,
        total: totalFiles,
        currentFile: profileFile,
      });
      const content = await zip.files[profileFile]!.async('string');
      const parsed = JSON.parse(content);
      result.userProfile = parseUserProfile(parsed);
    } catch (error) {
      result.errors.push({
        file: profileFile,
        message: error instanceof Error ? error.message : 'Failed to parse user profile',
      });
    }
  }

  // Parse FIT files from the export
  const fitFiles = files.filter((f) => f.toLowerCase().endsWith('.fit'));
  
  // Separate WELLNESS, SLEEP_DATA, and ACTIVITY fit files
  const wellnessFitFiles = fitFiles.filter(
    (f) => f.toUpperCase().includes('_WELLNESS') || f.toUpperCase().includes('WELLNESS')
  );
  const sleepDataFitFiles = fitFiles.filter(
    (f) => f.toUpperCase().includes('_SLEEP_DATA') || f.toUpperCase().includes('SLEEP_DATA')
  );
  const activityFitFiles = fitFiles.filter(
    (f) => !f.toUpperCase().includes('_WELLNESS') && 
           !f.toUpperCase().includes('_METRICS') &&
           !f.toUpperCase().includes('_NAP') &&
           !f.toUpperCase().includes('_SLEEP_DATA') &&
           !f.toUpperCase().includes('_SLEEP_DISRUPTIONS') &&
           !f.toUpperCase().includes('_HRV_STATUS') &&
           !f.toUpperCase().includes('WELLNESS') &&
           !f.toUpperCase().includes('METRICS') &&
           !f.toUpperCase().includes('SLEEP_DATA') &&
           !f.toUpperCase().includes('SLEEP_DISRUPTIONS') &&
           !f.toUpperCase().includes('HRV_STATUS')
  );
  const napFitFiles = fitFiles.filter(
    (f) => f.toUpperCase().includes('_NAP')
  );

  // Parse WELLNESS FIT files → daily summaries (steps, HR, stress, body battery)
  for (const path of wellnessFitFiles) {
    try {
      onProgress?.({ phase: 'parsing', current: ++processed, total: totalFiles, currentFile: path });
      const buffer = await zip.files[path]!.async('arraybuffer');
      const wellness = await parseWellnessFitFile(buffer);
      if (wellness) {
        // Merge wellness data into existing daily summary or create new one
        mergeWellnessIntoSummaries(result.dailySummaries, wellness);
        // Store detailed time-series readings
        mergeWellnessIntoDetails(result.dailyDetails, wellness);
      }
    } catch (error) {
      result.errors.push({
        file: path,
        message: error instanceof Error ? error.message : 'Failed to parse WELLNESS FIT file',
      });
    }
  }

  // Parse SLEEP_DATA FIT files → sleep duration from events
  for (const path of sleepDataFitFiles) {
    try {
      onProgress?.({ phase: 'parsing', current: ++processed, total: totalFiles, currentFile: path });
      const buffer = await zip.files[path]!.async('arraybuffer');
      const sleepData = await parseSleepDataFitFile(buffer);
      if (sleepData) {
        mergeSleepFitIntoSummaries(result.dailySummaries, sleepData);
      }
    } catch (error) {
      result.errors.push({
        file: path,
        message: error instanceof Error ? error.message : 'Failed to parse SLEEP_DATA FIT file',
      });
    }
  }

  // Parse NAP FIT files → add sleep data
  for (const path of napFitFiles) {
    try {
      onProgress?.({ phase: 'parsing', current: ++processed, total: totalFiles, currentFile: path });
      const buffer = await zip.files[path]!.async('arraybuffer');
      const napData = await parseNapFitFile(buffer);
      if (napData) {
        mergeNapIntoSummaries(result.dailySummaries, napData);
      }
    } catch (error) {
      result.errors.push({
        file: path,
        message: error instanceof Error ? error.message : 'Failed to parse NAP FIT file',
      });
    }
  }

  // Parse activity FIT files
  for (const path of activityFitFiles) {
    try {
      onProgress?.({ phase: 'parsing', current: ++processed, total: totalFiles, currentFile: path });
      const buffer = await zip.files[path]!.async('arraybuffer');
      const activity = await parseFitFile(buffer, path);
      if (activity) {
        // Only add if we don't already have this activity from JSON
        const exists = result.activities.some(
          (a) =>
            a.startTime === activity.startTime &&
            Math.abs(a.duration - activity.duration) < 60
        );
        if (!exists) {
          result.activities.push(activity);
        }
      }
    } catch (error) {
      result.errors.push({
        file: path,
        message: error instanceof Error ? error.message : 'Failed to parse FIT file',
      });
    }
  }

  // Sort activities by date (newest first)
  result.activities.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  // Sort daily summaries by date
  result.dailySummaries.sort((a, b) => b.date.localeCompare(a.date));

  onProgress?.({ phase: 'complete', current: totalFiles, total: totalFiles });

  return result;
}

/**
 * Parses individual FIT files dropped by the user.
 * Handles both activity files and WELLNESS/SLEEP_DATA files.
 */
export async function parseFitFiles(
  files: File[],
  onProgress?: ProgressCallback
): Promise<ParseResult> {
  const result: ParseResult = {
    activities: [],
    dailySummaries: [],
    dailyDetails: {},
    userProfile: null,
    errors: [],
  };

  const total = files.length;
  onProgress?.({ phase: 'parsing', current: 0, total });

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    onProgress?.({ phase: 'parsing', current: i + 1, total, currentFile: file.name });

    try {
      const buffer = await file.arrayBuffer();
      const upperName = file.name.toUpperCase();

      if (upperName.includes('WELLNESS')) {
        // Parse as wellness file
        const wellness = await parseWellnessFitFile(buffer);
        if (wellness) {
          mergeWellnessIntoSummaries(result.dailySummaries, wellness);
          mergeWellnessIntoDetails(result.dailyDetails, wellness);
        }
      } else if (upperName.includes('SLEEP_DATA')) {
        // Parse as sleep data file
        const sleepData = await parseSleepDataFitFile(buffer);
        if (sleepData) {
          mergeSleepFitIntoSummaries(result.dailySummaries, sleepData);
        }
      } else if (upperName.includes('NAP')) {
        const napData = await parseNapFitFile(buffer);
        if (napData) {
          mergeNapIntoSummaries(result.dailySummaries, napData);
        }
      } else if (!upperName.includes('METRICS') && !upperName.includes('HRV_STATUS') && !upperName.includes('SLEEP_DISRUPTIONS')) {
        // Parse as activity file
        const activity = await parseFitFile(buffer, file.name);
        if (activity) {
          result.activities.push(activity);
        }
      }
    } catch (error) {
      result.errors.push({
        file: file.name,
        message: error instanceof Error ? error.message : 'Failed to parse FIT file',
      });
    }
  }

  result.activities.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  onProgress?.({ phase: 'complete', current: total, total });
  return result;
}

/**
 * Parses individual JSON files (from Garmin export structure).
 */
export async function parseJsonFiles(
  files: File[],
  onProgress?: ProgressCallback
): Promise<ParseResult> {
  const result: ParseResult = {
    activities: [],
    dailySummaries: [],
    dailyDetails: {},
    userProfile: null,
    errors: [],
  };

  const total = files.length;
  onProgress?.({ phase: 'parsing', current: 0, total });

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    onProgress?.({ phase: 'parsing', current: i + 1, total, currentFile: file.name });

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);

      if (file.name.includes('dailies')) {
        const summaries = parseDailiesJson(parsed);
        result.dailySummaries.push(...summaries);
      } else if (file.name.includes('user_profile')) {
        result.userProfile = parseUserProfile(parsed);
      } else if (file.name.includes('sleepData')) {
        mergeSleepData(result.dailySummaries, parsed);
      } else {
        // Assume activity data
        const activities = parseActivityJson(parsed, file.name);
        result.activities.push(...activities);
      }
    } catch (error) {
      result.errors.push({
        file: file.name,
        message: error instanceof Error ? error.message : 'Failed to parse JSON file',
      });
    }
  }

  result.activities.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
  result.dailySummaries.sort((a, b) => b.date.localeCompare(a.date));

  onProgress?.({ phase: 'complete', current: total, total });
  return result;
}

// ─── Internal Parsing Helpers ─────────────────────────────────────────────────

/**
 * Parses activity JSON data from Garmin Connect export.
 * Garmin exports activities as individual JSON files or arrays.
 */
function parseActivityJson(data: unknown, filename: string): Activity[] {
  const activities: Activity[] = [];

  // Handle both array and single-object formats
  const items = Array.isArray(data) ? data : [data];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    const raw = item as Record<string, unknown>;

    // Try to extract activity data from various Garmin export formats
    const activityId =
      String(raw.activityId ?? raw.activityid ?? raw.id ?? `${filename}-${activities.length}`);
    const activityType = mapActivityType(raw.activityType ?? raw.sportType ?? raw.activityTypeName);
    const activityName = String(
      raw.activityName ?? raw.name ?? raw.activityTypeName ?? activityType
    );
    const startTime = extractStartTime(raw);
    const duration = extractDuration(raw);
    const distance = extractNumber(raw.distance ?? raw.distanceInMeters);
    const calories = extractNumber(raw.calories ?? raw.activeKilocalories ?? raw.bmrKilocalories);
    const averageHR = extractNumber(raw.averageHR ?? raw.averageHeartRateInBeatsPerMinute);
    const maxHR = extractNumber(raw.maxHR ?? raw.maxHeartRateInBeatsPerMinute);
    const elevationGain = extractNumber(raw.elevationGain ?? raw.totalElevationGainInMeters);
    const hasGPS = Boolean(raw.hasPolyline ?? raw.startLatitude ?? false);

    if (startTime && duration > 0) {
      activities.push({
        activityId,
        activityType,
        activityName,
        startTime,
        duration,
        distance: distance ?? undefined,
        calories: calories ?? undefined,
        averageHR: averageHR ?? undefined,
        maxHR: maxHR ?? undefined,
        elevationGain: elevationGain ?? undefined,
        hasGPS,
      });
    }
  }

  return activities;
}

/**
 * Parses daily wellness data from the Garmin export dailies JSON.
 */
function parseDailiesJson(data: unknown): DailySummary[] {
  const summaries: DailySummary[] = [];

  const items = Array.isArray(data) ? data : [data];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    const raw = item as Record<string, unknown>;

    const date = extractDate(raw);
    if (!date) continue;

    const steps = extractNumber(raw.totalSteps ?? raw.steps) ?? 0;
    const restingHeartRate = extractNumber(
      raw.restingHeartRateInBeatsPerMinute ?? raw.restingHeartRate ?? raw.minHeartRate
    );
    const stressLevel = extractNumber(raw.averageStressLevel ?? raw.stressLevel);
    const bodyBattery = extractNumber(
      raw.bodyBatteryHighestValue ?? raw.bodyBatteryMostRecentValue
    );
    const respirationRate = extractNumber(raw.averageSpo2 ?? raw.respirationRate);

    summaries.push({
      date,
      steps,
      restingHeartRate: restingHeartRate ?? undefined,
      stressLevel: stressLevel ?? undefined,
      bodyBattery: bodyBattery ?? undefined,
      respirationRate: respirationRate ?? undefined,
    });
  }

  return summaries;
}

/**
 * Merges sleep data into existing daily summaries.
 */
function mergeSleepData(summaries: DailySummary[], data: unknown): void {
  if (!Array.isArray(data)) return;

  for (const item of data) {
    if (!item || typeof item !== 'object') continue;

    const raw = item as Record<string, unknown>;
    const date = extractDate(raw);
    if (!date) continue;

    const existing = summaries.find((s) => s.date === date);
    const sleepDuration = extractNumber(raw.sleepTimeInSeconds ?? raw.durationInSeconds);

    if (existing && sleepDuration) {
      existing.sleepDuration = Math.round(sleepDuration / 60); // Convert seconds to minutes

      // Extract sleep stages if available
      const deepSleep = extractNumber(raw.deepSleepDurationInSeconds);
      const lightSleep = extractNumber(raw.lightSleepDurationInSeconds);
      const remSleep = extractNumber(raw.remSleepDurationInSeconds);
      const awakeSleep = extractNumber(raw.awakeDurationInSeconds);

      if (deepSleep !== null || lightSleep !== null || remSleep !== null) {
        existing.sleepStages = {
          deep: Math.round((deepSleep ?? 0) / 60),
          light: Math.round((lightSleep ?? 0) / 60),
          rem: Math.round((remSleep ?? 0) / 60),
          awake: Math.round((awakeSleep ?? 0) / 60),
        };
      }
    } else if (!existing && sleepDuration) {
      // Create a new daily summary with sleep data
      summaries.push({
        date,
        steps: 0,
        sleepDuration: Math.round(sleepDuration / 60),
      });
    }
  }
}

/**
 * Parses user profile from Garmin export.
 */
function parseUserProfile(data: unknown): UserProfile | null {
  if (!data || typeof data !== 'object') return null;

  const raw = data as Record<string, unknown>;

  const userId = String(raw.userId ?? raw.displayName ?? 'user');
  const displayName = String(
    raw.displayName ?? raw.userName ?? raw.firstName
      ? `${raw.firstName ?? ''} ${raw.lastName ?? ''}`.trim()
      : 'Garmin User'
  );
  const profileImageUrl = raw.profileImageUrl
    ? String(raw.profileImageUrl)
    : undefined;

  return { userId, displayName, profileImageUrl };
}

/**
 * Parses a FIT binary file into an Activity.
 */
async function parseFitFile(buffer: ArrayBuffer, filename: string): Promise<Activity | null> {
  return new Promise((resolve) => {
    try {
      const fitParser = new FitParser({
        force: true,
        speedUnit: 'm/s',
        lengthUnit: 'm',
        elapsedRecordField: true,
      });

      fitParser.parse(buffer, (error: unknown, data: FitData) => {
        if (error) {
          resolve(null);
          return;
        }

        if (!data || !data.activity || !data.activity.sessions || data.activity.sessions.length === 0) {
          resolve(null);
          return;
        }

        const session = data.activity.sessions[0]!;
        const sport = session.sport ?? 'generic';
        const startTime = session.start_time
          ? new Date(session.start_time).toISOString()
          : new Date().toISOString();
        const duration = session.total_elapsed_time ?? session.total_timer_time ?? 0;
        const distance = session.total_distance ?? undefined;
        const calories = session.total_calories ?? undefined;
        const averageHR = session.avg_heart_rate ?? undefined;
        const maxHR = session.max_heart_rate ?? undefined;
        const elevationGain = session.total_ascent ?? undefined;
        const hasGPS = Boolean(
          data.activity.sessions.some(
            (s: FitSession) => s.start_position_lat !== undefined
          )
        );

        resolve({
          activityId: `fit-${filename}-${Date.now()}`,
          activityType: mapFitSport(sport),
          activityName: session.sport
            ? `${String(session.sport).charAt(0).toUpperCase()}${String(session.sport).slice(1)}`
            : filename.replace('.fit', ''),
          startTime,
          duration,
          distance,
          calories,
          averageHR,
          maxHR,
          elevationGain,
          hasGPS,
        });
      });
    } catch {
      resolve(null);
    }
  });
}

// ─── Wellness FIT File Parser ─────────────────────────────────────────────────

interface WellnessData {
  date: string; // YYYY-MM-DD
  heartRates: number[];
  heartRateTimeSeries: TimeSeriesReading[];
  stressLevels: number[];
  stressTimeSeries: TimeSeriesReading[];
  bodyBatteryValues: number[];
  bodyBatteryTimeSeries: TimeSeriesReading[];
  steps: number;
  calories: number;
}

/**
 * Parses a WELLNESS.fit file into aggregated daily health data.
 * These files contain minute-by-minute monitoring data: HR, stress, body battery.
 */
async function parseWellnessFitFile(buffer: ArrayBuffer): Promise<WellnessData | null> {
  return new Promise((resolve) => {
    try {
      const fitParser = new FitParser({
        force: true,
        speedUnit: 'm/s',
        lengthUnit: 'm',
        elapsedRecordField: true,
      });

      fitParser.parse(buffer, (error: unknown, data: FitWellnessData) => {
        if (error) {
          resolve(null);
          return;
        }

        if (!data) {
          resolve(null);
          return;
        }

        // Determine the date from the file_ids timestamp or first monitor entry
        let dateStr: string | null = null;
        if (data.file_ids && data.file_ids.length > 0 && data.file_ids[0].time_created) {
          const d = new Date(data.file_ids[0].time_created);
          dateStr = d.toISOString().slice(0, 10);
        } else if (data.monitors && data.monitors.length > 0 && data.monitors[0].timestamp) {
          const d = new Date(data.monitors[0].timestamp);
          dateStr = d.toISOString().slice(0, 10);
        }

        if (!dateStr) {
          resolve(null);
          return;
        }

        const heartRates: number[] = [];
        const heartRateTimeSeries: TimeSeriesReading[] = [];
        const stressLevels: number[] = [];
        const stressTimeSeries: TimeSeriesReading[] = [];
        const bodyBatteryValues: number[] = [];
        const bodyBatteryTimeSeries: TimeSeriesReading[] = [];
        const steps = 0;
        let calories = 0;

        // Extract heart rates from monitors
        if (data.monitors) {
          for (const m of data.monitors) {
            if (m.heart_rate && typeof m.heart_rate === 'number' && m.heart_rate > 30 && m.heart_rate < 220) {
              heartRates.push(m.heart_rate);
              if (m.timestamp) {
                heartRateTimeSeries.push({ time: m.timestamp, value: m.heart_rate });
              }
            }
            if (m.active_calories && typeof m.active_calories === 'number') {
              calories += m.active_calories;
            }
          }
        }

        // Extract stress and body battery from stress array
        if (data.stress) {
          for (const s of data.stress) {
            if (s.stress_level_value !== undefined && typeof s.stress_level_value === 'number' && s.stress_level_value >= 0 && s.stress_level_value <= 100) {
              stressLevels.push(s.stress_level_value);
              if (s.stress_level_time) {
                stressTimeSeries.push({ time: s.stress_level_time, value: s.stress_level_value });
              }
            }
            if (s.body_battery !== undefined && typeof s.body_battery === 'number' && s.body_battery >= 0 && s.body_battery <= 100) {
              bodyBatteryValues.push(s.body_battery);
              if (s.stress_level_time) {
                bodyBatteryTimeSeries.push({ time: s.stress_level_time, value: s.body_battery });
              }
            }
          }
        }

        resolve({
          date: dateStr,
          heartRates,
          heartRateTimeSeries,
          stressLevels,
          stressTimeSeries,
          bodyBatteryValues,
          bodyBatteryTimeSeries,
          steps,
          calories,
        });
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Merges wellness FIT data into the daily summaries array.
 */
function mergeWellnessIntoSummaries(summaries: DailySummary[], wellness: WellnessData): void {
  let existing = summaries.find((s) => s.date === wellness.date);

  if (!existing) {
    existing = { date: wellness.date, steps: 0 };
    summaries.push(existing);
  }

  // Aggregate steps (take the maximum across files for the same day)
  if (wellness.steps > 0) {
    existing.steps = Math.max(existing.steps, wellness.steps);
  }

  // Resting HR = minimum of recorded heart rates (approximation)
  if (wellness.heartRates.length > 0) {
    const sortedHR = [...wellness.heartRates].sort((a, b) => a - b);
    // Use the 5th percentile as resting HR estimate
    const percentile5Index = Math.floor(sortedHR.length * 0.05);
    const restingHR = sortedHR[percentile5Index] ?? sortedHR[0];
    if (restingHR && (!existing.restingHeartRate || restingHR < existing.restingHeartRate)) {
      existing.restingHeartRate = restingHR;
    }
  }

  // Average stress level
  if (wellness.stressLevels.length > 0) {
    const avgStress = Math.round(
      wellness.stressLevels.reduce((a, b) => a + b, 0) / wellness.stressLevels.length
    );
    existing.stressLevel = existing.stressLevel
      ? Math.round((existing.stressLevel + avgStress) / 2)
      : avgStress;
  }

  // Body battery — take the max value seen during the day
  if (wellness.bodyBatteryValues.length > 0) {
    const maxBB = Math.max(...wellness.bodyBatteryValues);
    existing.bodyBattery = existing.bodyBattery
      ? Math.max(existing.bodyBattery, maxBB)
      : maxBB;
  }
}

interface NapData {
  date: string;
  durationMinutes: number;
}

/**
 * Parses a NAP.fit file for sleep/nap duration.
 */
async function parseNapFitFile(buffer: ArrayBuffer): Promise<NapData | null> {
  return new Promise((resolve) => {
    try {
      const fitParser = new FitParser({
        force: true,
        speedUnit: 'm/s',
        lengthUnit: 'm',
      });

      fitParser.parse(buffer, (error: unknown, data: FitWellnessData) => {
        if (error || !data) {
          resolve(null);
          return;
        }

        let dateStr: string | null = null;
        if (data.file_ids && data.file_ids.length > 0 && data.file_ids[0].time_created) {
          const d = new Date(data.file_ids[0].time_created);
          dateStr = d.toISOString().slice(0, 10);
        }

        if (!dateStr) {
          resolve(null);
          return;
        }

        // Try to determine nap duration from sessions or monitors
        let durationMinutes = 0;
        if (data.sessions && data.sessions.length > 0) {
          const session = data.sessions[0] as FitSession;
          durationMinutes = Math.round((session.total_elapsed_time ?? 0) / 60);
        }

        resolve(durationMinutes > 0 ? { date: dateStr, durationMinutes } : null);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Merges nap data into daily summaries.
 */
function mergeNapIntoSummaries(summaries: DailySummary[], napData: NapData): void {
  let existing = summaries.find((s) => s.date === napData.date);
  if (!existing) {
    existing = { date: napData.date, steps: 0 };
    summaries.push(existing);
  }
  // Add nap duration to sleep duration
  existing.sleepDuration = (existing.sleepDuration ?? 0) + napData.durationMinutes;
}

/**
 * Merges detailed time-series wellness readings into dailyDetails.
 */
function mergeWellnessIntoDetails(
  details: Record<string, DailyDetailData>,
  wellness: WellnessData
): void {
  if (!details[wellness.date]) {
    details[wellness.date] = {
      heartRates: [],
      stressReadings: [],
      bodyBatteryReadings: [],
    };
  }

  const dayDetails = details[wellness.date]!;
  dayDetails.heartRates.push(...wellness.heartRateTimeSeries);
  dayDetails.stressReadings.push(...wellness.stressTimeSeries);
  dayDetails.bodyBatteryReadings.push(...wellness.bodyBatteryTimeSeries);

  // Sort by time after merging
  dayDetails.heartRates.sort((a, b) => a.time.localeCompare(b.time));
  dayDetails.stressReadings.sort((a, b) => a.time.localeCompare(b.time));
  dayDetails.bodyBatteryReadings.sort((a, b) => a.time.localeCompare(b.time));
}

interface SleepFitData {
  date: string; // YYYY-MM-DD (the morning/wake date)
  durationMinutes: number;
  startTime: string;
  endTime: string;
}

/**
 * Parses a SLEEP_DATA.fit file to extract sleep duration from start/stop events.
 */
async function parseSleepDataFitFile(buffer: ArrayBuffer): Promise<SleepFitData | null> {
  return new Promise((resolve) => {
    try {
      const fitParser = new FitParser({
        force: true,
        speedUnit: 'm/s',
        lengthUnit: 'm',
      });

      fitParser.parse(buffer, (error: unknown, data: FitSleepData) => {
        if (error || !data) {
          resolve(null);
          return;
        }

        // Look for events with event_type "start" and "stop"
        if (data.events && Array.isArray(data.events)) {
          let startTime: Date | null = null;
          let stopTime: Date | null = null;

          for (const event of data.events) {
            if (event.event_type === 'start' && event.timestamp) {
              startTime = new Date(event.timestamp);
            }
            if (event.event_type === 'stop' && event.timestamp) {
              stopTime = new Date(event.timestamp);
            }
          }

          if (startTime && stopTime && stopTime > startTime) {
            const durationMs = stopTime.getTime() - startTime.getTime();
            const durationMinutes = Math.round(durationMs / 60000);
            // Use the stop date as the "sleep date" (the morning you woke up)
            const dateStr = stopTime.toISOString().slice(0, 10);

            resolve({
              date: dateStr,
              durationMinutes,
              startTime: startTime.toISOString(),
              endTime: stopTime.toISOString(),
            });
            return;
          }
        }

        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Merges sleep FIT data into daily summaries.
 */
function mergeSleepFitIntoSummaries(summaries: DailySummary[], sleepData: SleepFitData): void {
  let existing = summaries.find((s) => s.date === sleepData.date);
  if (!existing) {
    existing = { date: sleepData.date, steps: 0 };
    summaries.push(existing);
  }
  // Only set if we don't already have a longer sleep duration (avoid overriding with nap data)
  if (!existing.sleepDuration || sleepData.durationMinutes > existing.sleepDuration) {
    existing.sleepDuration = sleepData.durationMinutes;
  }
}// ─── Mapping Helpers ──────────────────────────────────────────────────────────

function mapActivityType(raw: unknown): ActivityType {
  if (!raw) return 'other';
  const type = String(raw).toLowerCase();

  if (type.includes('run')) return 'running';
  if (type.includes('cycl') || type.includes('bik')) return 'cycling';
  if (type.includes('swim')) return 'swimming';
  if (type.includes('walk')) return 'walking';
  if (type.includes('hik')) return 'hiking';
  if (type.includes('strength') || type.includes('weight')) return 'strength_training';
  if (type.includes('yoga') || type.includes('pilates')) return 'yoga';
  return 'other';
}

function mapFitSport(sport: string): ActivityType {
  const s = sport.toLowerCase();
  if (s === 'running') return 'running';
  if (s === 'cycling') return 'cycling';
  if (s === 'swimming') return 'swimming';
  if (s === 'walking') return 'walking';
  if (s === 'hiking') return 'hiking';
  if (s === 'training' || s === 'fitness_equipment') return 'strength_training';
  return 'other';
}

function extractStartTime(raw: Record<string, unknown>): string | null {
  const candidates = [
    raw.startTimeLocal,
    raw.startTimeGMT,
    raw.beginTimestamp,
    raw.startTime,
    raw.calendarDate,
  ];

  for (const val of candidates) {
    if (!val) continue;
    if (typeof val === 'string') {
      const date = new Date(val);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    if (typeof val === 'number') {
      // Garmin sometimes uses millisecond timestamps
      const date = new Date(val > 1e12 ? val : val * 1000);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
  }

  return null;
}

function extractDuration(raw: Record<string, unknown>): number {
  const val = raw.duration ?? raw.elapsedDuration ?? raw.movingDuration ?? raw.durationInSeconds;
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  if (isNaN(num)) return 0;
  // Garmin sometimes returns duration in milliseconds
  return num > 86400000 ? num / 1000 : num;
}

function extractNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

function extractDate(raw: Record<string, unknown>): string | null {
  const candidates = [raw.calendarDate, raw.summaryDate, raw.date, raw.startTimeLocal];

  for (const val of candidates) {
    if (!val) continue;
    if (typeof val === 'string') {
      // Try YYYY-MM-DD format
      const match = val.match(/(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1]!;
    }
  }
  return null;
}

// ─── FIT Parser Type Definitions ──────────────────────────────────────────────

interface FitSession {
  sport?: string;
  start_time?: string | Date;
  total_elapsed_time?: number;
  total_timer_time?: number;
  total_distance?: number;
  total_calories?: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  total_ascent?: number;
  start_position_lat?: number;
}

interface FitData {
  activity?: {
    sessions: FitSession[];
  };
}

interface FitWellnessData {
  file_ids?: Array<{ time_created?: string | Date; type?: string }>;
  monitors?: Array<{
    timestamp?: string;
    heart_rate?: number;
    active_calories?: number;
    steps?: number;
    distance?: number;
    cycles?: number;
    duration_min?: number;
    activity_type?: string;
    timestamp16?: number;
  }>;
  stress?: Array<{
    stress_level_time?: string;
    stress_level_value?: number;
    body_battery?: number;
    field_two?: number;
    field_four?: number;
  }>;
  monitor_info?: Array<{
    timestamp?: string;
    resting_metabolic_rate?: number;
    activity_type?: string;
  }>;
  sessions?: unknown[];
}

interface FitSleepData {
  events?: Array<{
    timestamp?: string;
    event?: number;
    event_type?: string;
  }>;
  file_ids?: Array<{ time_created?: string | Date; type?: string }>;
}
