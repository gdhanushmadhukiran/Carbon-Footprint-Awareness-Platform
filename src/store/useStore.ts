// ============================================================================
// EcoTrack AI — Zustand Store
// ============================================================================

import { create } from 'zustand';
import type {
  AppState,
  UserProfile,
  ActivityLog,
  Goal,
  Challenge,
  WeeklyReport,
  CoachRecommendation,
  CarbonTwinState,
  LogCategory,
  PageName,
  Achievement,
} from '../types';
import * as storage from '../lib/storage';

// ============================================================================
// Default Achievements
// ============================================================================

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: 'first-log', title: 'First Step', description: 'Log your first activity', icon: '🌱', isUnlocked: false, requirement: 'Log 1 activity' },
  { id: 'week-streak', title: 'Week Warrior', description: 'Log activities for 7 consecutive days', icon: '🔥', isUnlocked: false, requirement: '7-day streak' },
  { id: 'month-streak', title: 'Monthly Maven', description: 'Log activities for 30 consecutive days', icon: '⭐', isUnlocked: false, requirement: '30-day streak' },
  { id: 'eco-meal', title: 'Green Plate', description: 'Log 10 vegetarian or vegan meals', icon: '🥗', isUnlocked: false, requirement: '10 plant-based meals' },
  { id: 'bike-champion', title: 'Pedal Power', description: 'Log 50km of cycling', icon: '🚴', isUnlocked: false, requirement: '50km cycled' },
  { id: 'carbon-saver', title: 'Carbon Saver', description: 'Save 100kg CO₂e through better choices', icon: '💚', isUnlocked: false, requirement: '100kg CO₂e saved' },
  { id: 'challenge-complete', title: 'Challenge Accepted', description: 'Complete your first weekly challenge', icon: '🏆', isUnlocked: false, requirement: 'Complete 1 challenge' },
  { id: 'goal-setter', title: 'Goal Getter', description: 'Set your first reduction goal', icon: '🎯', isUnlocked: false, requirement: 'Set 1 goal' },
  { id: 'coach-listener', title: 'Coachable', description: 'View AI Climate Coach recommendations', icon: '🤖', isUnlocked: false, requirement: 'View coach advice' },
  { id: 'simulator-explorer', title: 'What If Wizard', description: 'Use the What-If Simulator', icon: '🔮', isUnlocked: false, requirement: 'Use simulator' },
  { id: 'twin-viewer', title: 'Future Gazer', description: 'View your Carbon Twin', icon: '👥', isUnlocked: false, requirement: 'View Carbon Twin' },
  { id: 'reducer-10', title: 'Impact Maker', description: 'Reduce weekly emissions by 10%', icon: '📉', isUnlocked: false, requirement: '10% weekly reduction' },
];

// ============================================================================
// Store
// ============================================================================

export const useStore = create<AppState>((set, get) => ({
  // --- Initial State ---
  userProfile: storage.getUserProfile(),
  logs: storage.getLogs(),
  goals: storage.getGoals(),
  achievements: storage.getAchievements().length > 0 ? storage.getAchievements() : DEFAULT_ACHIEVEMENTS,
  streak: storage.getStreak(),
  challenges: storage.getChallenges(),
  weeklyReports: storage.getWeeklyReports() as WeeklyReport[],
  coachRecommendations: storage.getCoachRecommendations(),
  carbonTwin: null,
  currentPage: (storage.getUserProfile()?.onboardingComplete ? 'dashboard' : 'dashboard') as PageName,
  isOnboarding: !storage.getUserProfile()?.onboardingComplete,
  isLoading: false,
  showLogModal: false,
  activeLogCategory: null,

  // --- Actions ---
  setUserProfile: (profile: UserProfile) => {
    storage.saveUserProfile(profile);
    set({ userProfile: profile });
  },

  updateUserProfile: (updates: Partial<UserProfile>) => {
    const current = get().userProfile;
    if (current) {
      const updated = { ...current, ...updates };
      storage.saveUserProfile(updated);
      set({ userProfile: updated });
    }
  },

  addLog: (log: ActivityLog) => {
    const logs = [...get().logs, log];
    storage.saveLogs(logs);
    set({ logs });

    // Check for first-log achievement
    const achievements = get().achievements;
    const firstLog = achievements.find(a => a.id === 'first-log');
    if (firstLog && !firstLog.isUnlocked) {
      get().unlockAchievement('first-log');
    }

    // Update streak
    get().updateStreak();
  },

  setLogs: (logs: ActivityLog[]) => {
    storage.saveLogs(logs);
    set({ logs });
  },

  addGoal: (goal: Goal) => {
    const goals = [...get().goals, goal];
    storage.saveGoals(goals);
    set({ goals });

    // Achievement check
    const achievements = get().achievements;
    const goalSetter = achievements.find(a => a.id === 'goal-setter');
    if (goalSetter && !goalSetter.isUnlocked) {
      get().unlockAchievement('goal-setter');
    }
  },

  updateGoal: (id: string, updates: Partial<Goal>) => {
    const goals = get().goals.map(g => (g.id === id ? { ...g, ...updates } : g));
    storage.saveGoals(goals);
    set({ goals });
  },

  unlockAchievement: (id: string) => {
    const achievements = get().achievements.map(a =>
      a.id === id ? { ...a, isUnlocked: true, unlockedAt: new Date().toISOString() } : a
    );
    storage.saveAchievements(achievements);
    set({ achievements });
  },

  updateStreak: () => {
    const today = new Date().toISOString().split('T')[0];
    const currentStreak = get().streak;

    if (currentStreak.lastLogDate === today) return; // Already logged today

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let newCurrent: number;

    if (currentStreak.lastLogDate === yesterday) {
      newCurrent = currentStreak.currentDays + 1;
    } else if (!currentStreak.lastLogDate) {
      newCurrent = 1;
    } else {
      newCurrent = 1; // streak broken
    }

    const newStreak = {
      currentDays: newCurrent,
      longestDays: Math.max(currentStreak.longestDays, newCurrent),
      lastLogDate: today,
    };

    storage.saveStreak(newStreak);
    set({ streak: newStreak });

    // Check streak achievements
    if (newCurrent >= 7) get().unlockAchievement('week-streak');
    if (newCurrent >= 30) get().unlockAchievement('month-streak');
  },

  addChallenge: (challenge: Challenge) => {
    const challenges = [...get().challenges, challenge];
    storage.saveChallenges(challenges);
    set({ challenges });
  },

  updateChallenge: (id: string, updates: Partial<Challenge>) => {
    const challenges = get().challenges.map(c =>
      c.id === id ? { ...c, ...updates } : c
    );
    storage.saveChallenges(challenges);
    set({ challenges });

    // Check completion achievement
    if (updates.isCompleted) {
      get().unlockAchievement('challenge-complete');
    }
  },

  addWeeklyReport: (report: WeeklyReport) => {
    const reports = [...get().weeklyReports, report];
    storage.saveWeeklyReports(reports);
    set({ weeklyReports: reports });
  },

  setCoachRecommendations: (recs: CoachRecommendation[]) => {
    storage.saveCoachRecommendations(recs);
    set({ coachRecommendations: recs });
    get().unlockAchievement('coach-listener');
  },

  setCarbonTwin: (twin: CarbonTwinState) => {
    set({ carbonTwin: twin });
    get().unlockAchievement('twin-viewer');
  },

  setCurrentPage: (page: PageName) => set({ currentPage: page }),
  setIsOnboarding: (val: boolean) => set({ isOnboarding: val }),
  setShowLogModal: (val: boolean) => set({ showLogModal: val }),
  setActiveLogCategory: (cat: LogCategory | null) => set({ activeLogCategory: cat }),
  setIsLoading: (val: boolean) => set({ isLoading: val }),

  resetStore: () => {
    storage.clearAllData();
    set({
      userProfile: null,
      logs: [],
      goals: [],
      achievements: DEFAULT_ACHIEVEMENTS,
      streak: { currentDays: 0, longestDays: 0, lastLogDate: '' },
      challenges: [],
      weeklyReports: [],
      coachRecommendations: [],
      carbonTwin: null,
      currentPage: 'dashboard',
      isOnboarding: true,
      isLoading: false,
      showLogModal: false,
      activeLogCategory: null,
    });
  },
}));
