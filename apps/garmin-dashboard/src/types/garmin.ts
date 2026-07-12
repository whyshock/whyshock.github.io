/**
 * Core domain model interfaces for the Garmin Fitness Dashboard.
 * These types represent the data structures used throughout the application
 * for activities, daily summaries, training metrics, insights, and user state.
 */

// ─── User and Authentication ──────────────────────────────────────────────────

export interface UserProfile {
  userId: string;
  displayName: string;
  profileImageUrl?: string;
}

export interface AuthSession {
  userId: string;
  displayName: string;
  accessToken: string; // Encrypted
  tokenSecret: string; // Encrypted
  refreshToken: string; // Encrypted
  expiresAt: number; // Unix timestamp
}

// ─── Activity Types ───────────────────────────────────────────────────────────

export type ActivityType =
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'walking'
  | 'hiking'
  | 'strength_training'
  | 'yoga'
  | 'other';

export interface Activity {
  activityId: string;
  activityType: ActivityType;
  activityName: string;
  startTime: string; // ISO 8601
  duration: number; // seconds
  distance?: number; // meters
  calories?: number;
  averageHR?: number;
  maxHR?: number;
  elevationGain?: number;
  hasGPS: boolean;
}

export interface ActivityDetail extends Activity {
  heartRateZones?: HeartRateZone[];
  pace?: PaceData[];
  cadence?: CadenceData[];
  elevation?: ElevationData[];
  gpsRoute?: GPSPoint[];
  exercises?: ExerciseSet[];
}

export interface HeartRateZone {
  zone: number; // 1-5
  minHR: number;
  maxHR: number;
  timeInZone: number; // seconds
  percentageInZone: number;
}

export interface PaceData {
  distance: number; // meters (cumulative or per-split)
  pace: number; // seconds per km
  timestamp: string; // ISO 8601
  splitIndex: number;
}

export interface CadenceData {
  timestamp: string; // ISO 8601
  value: number; // steps per minute or RPM
  distance: number; // meters (cumulative)
}

export interface ElevationData {
  timestamp: string; // ISO 8601
  elevation: number; // meters
  distance: number; // meters (cumulative)
}

export interface GPSPoint {
  lat: number;
  lon: number;
  elevation?: number;
  timestamp: string;
  heartRate?: number;
  pace?: number;
}

export interface ExerciseSet {
  exerciseName: string;
  exerciseId?: string;
  sets: number;
  reps: number;
  weight?: number; // kg or lbs depending on user preference
  duration?: number; // seconds
}

// ─── Daily Summary ────────────────────────────────────────────────────────────

export interface DailySummary {
  date: string; // YYYY-MM-DD
  steps: number;
  restingHeartRate?: number;
  sleepDuration?: number; // minutes
  sleepStages?: SleepStages;
  stressLevel?: number; // 0-100
  bodyBattery?: number; // 0-100
  respirationRate?: number;
  vo2Max?: number;
  trainingLoad?: number;
  recoveryTime?: number; // hours
}

export interface SleepStages {
  deep: number; // minutes
  light: number; // minutes
  rem: number; // minutes
  awake: number; // minutes
}

// ─── Training & Performance ───────────────────────────────────────────────────

export interface PersonalRecord {
  recordType: string; // 'longest_run', 'fastest_5k', etc.
  value: number;
  unit: string;
  activityId: string;
  date: string;
}

export interface TrainingStatus {
  vo2Max: number;
  trainingLoad: number;
  trainingLoadBalance: TrainingLoadBalance;
  recoveryTimeHours: number;
}

export type TrainingLoadBalance = 'optimal' | 'overreaching' | 'detraining';

// ─── Enriched Insights ────────────────────────────────────────────────────────

export type InsightType =
  | 'training_intensity'
  | 'aerobic_efficiency'
  | 'recovery_readiness'
  | 'weekly_balance'
  | 'overtraining_risk';

export interface EnrichedInsight {
  type: InsightType;
  value: number; // 0-100 normalized or categorical
  label: string;
  description: string;
  contributingMetrics: ContributingMetric[];
  calculatedAt: string; // ISO 8601
  insufficientData: boolean;
  missingMetrics: string[];
}

export interface ContributingMetric {
  name: string;
  value: number;
  unit: string;
  weight: number; // Influence weight 0-1
}

export type OvertrainingRisk = 'low' | 'moderate' | 'high';

// ─── User Preferences ─────────────────────────────────────────────────────────

export type UnitSystem = 'metric' | 'imperial';
export type ThemeMode = 'light' | 'dark' | 'system';
export type DateRangeOption = 7 | 30 | 90;

export interface UserPreferences {
  unitSystem: UnitSystem;
  theme: ThemeMode;
  defaultDateRange: DateRangeOption;
}

// ─── Exercise Animation ───────────────────────────────────────────────────────

export interface ExerciseAnimationConfig {
  id: string;
  name: string;
  muscleGroups: string[];
  svgContent: string;
  animationDuration: number; // 2-6 seconds
  cssClass: string;
}

// ─── Insight Calculator Interface ─────────────────────────────────────────────

export interface InsightCalculator {
  calculateTrainingIntensity(activity: ActivityDetail): number;
  calculateAerobicEfficiency(activity: ActivityDetail): number;
  calculateRecoveryReadiness(data: {
    restingHRTrend: number[];
    sleepQuality: number;
    bodyBattery: number;
  }): number;
  calculateWeeklyBalance(weekActivities: Activity[]): number;
  classifyOvertrainingRisk(data: {
    trainingLoadTrend: number[];
    recoveryTime: number;
    sleepQuality: number;
    hrv: number[];
  }): OvertrainingRisk;
}

// ─── Chart & Aggregation ──────────────────────────────────────────────────────

export type TimeGranularity = 'day' | 'week' | 'month';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

// ─── GPS Segmentation ─────────────────────────────────────────────────────────

export interface RouteSegment {
  segmentIndex: number;
  distance: number; // meters
  pace: number; // seconds per km
  elevationGain: number; // meters
  elevationLoss: number; // meters
  startPoint: GPSPoint;
  endPoint: GPSPoint;
}
