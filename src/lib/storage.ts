// ============================================================================
// EcoTrack AI — Storage Abstraction Layer
// ============================================================================
// LocalStorage abstraction structured for easy backend swap in the future.
// All data is JSON-serialized and stored under namespaced keys.
// ============================================================================

import type {
  UserProfile,
  ActivityLog,
  Goal,
  Achievement,
  Streak,
  Challenge,
  WeeklyReport,
  CoachRecommendation,
} from '../types';

const STORAGE_PREFIX = 'ecotrack_';

const KEYS = {
  USER_PROFILE: `${STORAGE_PREFIX}user_profile`,
  LOGS: `${STORAGE_PREFIX}logs`,
  GOALS: `${STORAGE_PREFIX}goals`,
  ACHIEVEMENTS: `${STORAGE_PREFIX}achievements`,
  STREAK: `${STORAGE_PREFIX}streak`,
  CHALLENGES: `${STORAGE_PREFIX}challenges`,
  WEEKLY_REPORTS: `${STORAGE_PREFIX}weekly_reports`,
  COACH_RECOMMENDATIONS: `${STORAGE_PREFIX}coach_recommendations`,
} as const;

// ============================================================================
// Generic helpers
// ============================================================================

function getItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`[EcoTrack Storage] Failed to parse ${key}`);
    return null;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[EcoTrack Storage] Failed to save ${key}:`, error);
  }
}

function removeItem(key: string): void {
  localStorage.removeItem(key);
}

// ============================================================================
// User Profile
// ============================================================================

export function getUserProfile(): UserProfile | null {
  return getItem<UserProfile>(KEYS.USER_PROFILE);
}

export function saveUserProfile(profile: UserProfile): void {
  setItem(KEYS.USER_PROFILE, profile);
}

export function clearUserProfile(): void {
  removeItem(KEYS.USER_PROFILE);
}

// ============================================================================
// Activity Logs
// ============================================================================

export function getLogs(): ActivityLog[] {
  return getItem<ActivityLog[]>(KEYS.LOGS) ?? [];
}

export function saveLogs(logs: ActivityLog[]): void {
  setItem(KEYS.LOGS, logs);
}

export function addLog(log: ActivityLog): void {
  const logs = getLogs();
  logs.push(log);
  saveLogs(logs);
}

export function clearLogs(): void {
  removeItem(KEYS.LOGS);
}

// ============================================================================
// Goals
// ============================================================================

export function getGoals(): Goal[] {
  return getItem<Goal[]>(KEYS.GOALS) ?? [];
}

export function saveGoals(goals: Goal[]): void {
  setItem(KEYS.GOALS, goals);
}

// ============================================================================
// Achievements
// ============================================================================

export function getAchievements(): Achievement[] {
  return getItem<Achievement[]>(KEYS.ACHIEVEMENTS) ?? [];
}

export function saveAchievements(achievements: Achievement[]): void {
  setItem(KEYS.ACHIEVEMENTS, achievements);
}

// ============================================================================
// Streak
// ============================================================================

export function getStreak(): Streak {
  return (
    getItem<Streak>(KEYS.STREAK) ?? {
      currentDays: 0,
      longestDays: 0,
      lastLogDate: '',
    }
  );
}

export function saveStreak(streak: Streak): void {
  setItem(KEYS.STREAK, streak);
}

// ============================================================================
// Challenges
// ============================================================================

export function getChallenges(): Challenge[] {
  return getItem<Challenge[]>(KEYS.CHALLENGES) ?? [];
}

export function saveChallenges(challenges: Challenge[]): void {
  setItem(KEYS.CHALLENGES, challenges);
}

// ============================================================================
// Weekly Reports
// ============================================================================

export function getWeeklyReports(): WeeklyReport[] {
  return getItem<WeeklyReport[]>(KEYS.WEEKLY_REPORTS) ?? [];
}

export function saveWeeklyReports(reports: WeeklyReport[]): void {
  setItem(KEYS.WEEKLY_REPORTS, reports);
}

// ============================================================================
// Coach Recommendations
// ============================================================================

export function getCoachRecommendations(): CoachRecommendation[] {
  return getItem<CoachRecommendation[]>(KEYS.COACH_RECOMMENDATIONS) ?? [];
}

export function saveCoachRecommendations(recs: CoachRecommendation[]): void {
  setItem(KEYS.COACH_RECOMMENDATIONS, recs);
}

// ============================================================================
// Clear All Data
// ============================================================================

export function clearAllData(): void {
  Object.values(KEYS).forEach(removeItem);
}

// ============================================================================
// Export size info (useful for debugging)
// ============================================================================

export function getStorageSize(): { totalBytes: number; byKey: Record<string, number> } {
  const byKey: Record<string, number> = {};
  let totalBytes = 0;

  Object.entries(KEYS).forEach(([, key]) => {
    const raw = localStorage.getItem(key);
    const bytes = raw ? new Blob([raw]).size : 0;
    byKey[key] = bytes;
    totalBytes += bytes;
  });

  return { totalBytes, byKey };
}
