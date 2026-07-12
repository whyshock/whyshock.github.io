/**
 * Zustand store for parsed Garmin data.
 * Holds activities, daily summaries, and user profile in memory,
 * and persists to IndexedDB for offline access across sessions.
 */

import { create } from 'zustand';
import type { Activity, DailySummary, UserProfile } from '@/types/garmin';
import type { DailyDetailData } from '@/services/garmin-parser';

// ─── IndexedDB Persistence ────────────────────────────────────────────────────

const DB_NAME = 'garmin-fitness-data';
const DB_VERSION = 1;
const STORES = {
  activities: 'activities',
  dailySummaries: 'dailySummaries',
  userProfile: 'userProfile',
} as const;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.activities)) {
        db.createObjectStore(STORES.activities, { keyPath: 'activityId' });
      }
      if (!db.objectStoreNames.contains(STORES.dailySummaries)) {
        db.createObjectStore(STORES.dailySummaries, { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains(STORES.userProfile)) {
        db.createObjectStore(STORES.userProfile);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function persistToIDB<T>(storeName: string, data: T[], keyPath?: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    for (const item of data) {
      if (keyPath) {
        store.put(item);
      } else {
        store.put(item, 'profile');
      }
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.warn('Failed to persist to IndexedDB:', error);
  }
}

async function loadFromIDB<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    const result = await new Promise<T[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  } catch {
    return [];
  }
}

async function loadProfileFromIDB(): Promise<UserProfile | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.userProfile, 'readonly');
    const store = tx.objectStore(STORES.userProfile);
    const request = store.get('profile');
    const result = await new Promise<UserProfile | null>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as UserProfile | null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

async function clearIDB(): Promise<void> {
  try {
    const db = await openDB();
    const storeNames = [STORES.activities, STORES.dailySummaries, STORES.userProfile];
    const tx = db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) {
      tx.objectStore(name).clear();
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.warn('Failed to clear IndexedDB:', error);
  }
}

// ─── Store Types ──────────────────────────────────────────────────────────────

interface DataState {
  activities: Activity[];
  dailySummaries: DailySummary[];
  dailyDetails: Record<string, DailyDetailData>;
  userProfile: UserProfile | null;
  isDataLoaded: boolean;
  isHydrating: boolean;
}

interface DataActions {
  setActivities: (activities: Activity[]) => void;
  setDailySummaries: (summaries: DailySummary[]) => void;
  setDailyDetails: (details: Record<string, DailyDetailData>) => void;
  setProfile: (profile: UserProfile) => void;
  clearData: () => Promise<void>;
  hydrate: () => Promise<void>;
}

type DataStore = DataState & DataActions;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDataStore = create<DataStore>((set) => ({
  // State
  activities: [],
  dailySummaries: [],
  dailyDetails: {},
  userProfile: null,
  isDataLoaded: false,
  isHydrating: true,

  // Actions
  setActivities: (activities: Activity[]) => {
    set({ activities, isDataLoaded: true });
    persistToIDB(STORES.activities, activities, 'activityId');
  },

  setDailySummaries: (summaries: DailySummary[]) => {
    set({ dailySummaries: summaries, isDataLoaded: true });
    persistToIDB(STORES.dailySummaries, summaries, 'date');
  },

  setDailyDetails: (details: Record<string, DailyDetailData>) => {
    set({ dailyDetails: details });
    // dailyDetails are kept in memory only (they can be large); re-parse from files if needed
  },

  setProfile: (profile: UserProfile) => {
    set({ userProfile: profile });
    persistToIDB(STORES.userProfile, [profile]);
  },

  clearData: async () => {
    await clearIDB();
    set({
      activities: [],
      dailySummaries: [],
      dailyDetails: {},
      userProfile: null,
      isDataLoaded: false,
    });
  },

  hydrate: async () => {
    set({ isHydrating: true });
    try {
      const [activities, dailySummaries, profile] = await Promise.all([
        loadFromIDB<Activity>(STORES.activities),
        loadFromIDB<DailySummary>(STORES.dailySummaries),
        loadProfileFromIDB(),
      ]);

      const hasData = activities.length > 0 || dailySummaries.length > 0;
      set({
        activities,
        dailySummaries,
        userProfile: profile,
        isDataLoaded: hasData,
        isHydrating: false,
      });
    } catch {
      set({ isHydrating: false });
    }
  },
}));
