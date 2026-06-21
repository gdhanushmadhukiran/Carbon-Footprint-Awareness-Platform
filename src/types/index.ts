// ============================================================================
// EcoTrack AI — Type Definitions
// ============================================================================

// --- User Profile ---
export type DietType = 'omnivore' | 'pescatarian' | 'vegetarian' | 'vegan';
export type TransportMode = 'car_gasoline' | 'car_diesel' | 'car_electric' | 'bus' | 'train' | 'bicycle' | 'walking' | 'motorcycle' | 'flight_domestic' | 'flight_international';
export type EnergySource = 'grid_default' | 'renewable' | 'natural_gas' | 'mixed';
export type Region = 'north_america' | 'europe' | 'asia' | 'oceania' | 'south_america' | 'africa' | 'middle_east';

export interface UserProfile {
  id: string;
  name: string;
  region: Region;
  diet: DietType;
  primaryTransport: TransportMode;
  householdSize: number;
  energySource: EnergySource;
  baselineFootprint: number;
  carbonRiskScore: number;
  sustainabilityProfile: string;
  createdAt: string;
  onboardingComplete: boolean;
}

export type LogCategory = 'transport' | 'food' | 'energy' | 'shopping' | 'waste';

export interface TransportLog {
  mode: TransportMode;
  distanceKm: number;
  passengers?: number;
}

export interface FoodLog {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  dietType: DietType;
  isOrganic?: boolean;
  isLocal?: boolean;
}

export interface EnergyLog {
  type: 'electricity' | 'natural_gas' | 'heating_oil';
  amount: number;
  source: EnergySource;
}

export interface ShoppingLog {
  itemType: 'clothing' | 'electronics' | 'furniture' | 'groceries' | 'other';
  quantity: number;
  isSecondhand?: boolean;
}

export interface WasteLog {
  type: 'general' | 'recycling' | 'compost' | 'electronic';
  weightKg: number;
}

export interface ActivityLog {
  id: string;
  category: LogCategory;
  timestamp: string;
  carbonKg: number;
  details: TransportLog | FoodLog | EnergyLog | ShoppingLog | WasteLog;
  equivalentComparison: string;
  sustainabilityRating: SustainabilityRating;
}

export type SustainabilityRating = 'A' | 'B' | 'C' | 'D' | 'F';

export interface CoachRecommendation {
  id: string;
  title: string;
  description: string;
  estimatedSavingsKg: number;
  confidence: 'high' | 'medium' | 'low';
  feasibility: 'easy' | 'moderate' | 'challenging';
  whyExplanation: string;
  category: LogCategory;
  isAIGenerated: boolean;
}

export interface CarbonTwinState {
  currentMe: number;
  futureMe: number;
  ecoMe: number;
  goalMe: number;
  currentMeMonthly: number[];
  futureMeMonthly: number[];
  ecoMeMonthly: number[];
  goalMeMonthly: number[];
}

export interface SimulatorScenario {
  id: string;
  label: string;
  category: LogCategory;
  currentValue: number;
  sliderMin: number;
  sliderMax: number;
  sliderStep: number;
  unit: string;
  carbonPerUnit: number;
}

export interface SimulatorResult {
  monthlySavingsKg: number;
  yearlySavingsKg: number;
  treesEquivalent: number;
  fuelLitersSaved: number;
  moneySaved: number;
}

export interface Goal {
  id: string;
  title: string;
  targetReductionPercent: number;
  currentReductionPercent: number;
  startDate: string;
  endDate: string;
  isCompleted: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  isUnlocked: boolean;
  requirement: string;
}

export interface Streak {
  currentDays: number;
  longestDays: number;
  lastLogDate: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  durationDays: number;
  targetAction: string;
  progress: number;
  isActive: boolean;
  isCompleted: boolean;
  weekNumber: number;
  estimatedSavingsKg: number;
  isAIGenerated: boolean;
}

export interface WeeklyReport {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  totalEmissionsKg: number;
  comparedToLastWeek: number;
  biggestWins: string[];
  biggestSources: Array<{ category: LogCategory; amountKg: number }>;
  goalProgress: number;
  projectedMonthlyKg: number;
  narrativeSummary: string;
  recommendedActions: string[];
  isAIGenerated: boolean;
  generatedAt: string;
}

export interface EducationFact {
  id: string;
  fact: string;
  source: string;
  relatedCategory: LogCategory;
  contextTrigger: string;
}

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  field: keyof Pick<UserProfile, 'name' | 'region' | 'diet' | 'primaryTransport' | 'householdSize' | 'energySource'>;
}

export interface AppState {
  userProfile: UserProfile | null;
  logs: ActivityLog[];
  goals: Goal[];
  achievements: Achievement[];
  streak: Streak;
  challenges: Challenge[];
  weeklyReports: WeeklyReport[];
  coachRecommendations: CoachRecommendation[];
  carbonTwin: CarbonTwinState | null;
  currentPage: PageName;
  isOnboarding: boolean;
  isLoading: boolean;
  showLogModal: boolean;
  activeLogCategory: LogCategory | null;
  setUserProfile: (profile: UserProfile) => void;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  addLog: (log: ActivityLog) => void;
  setLogs: (logs: ActivityLog[]) => void;
  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  unlockAchievement: (id: string) => void;
  updateStreak: () => void;
  addChallenge: (challenge: Challenge) => void;
  updateChallenge: (id: string, updates: Partial<Challenge>) => void;
  addWeeklyReport: (report: WeeklyReport) => void;
  setCoachRecommendations: (recs: CoachRecommendation[]) => void;
  setCarbonTwin: (twin: CarbonTwinState) => void;
  setCurrentPage: (page: PageName) => void;
  setIsOnboarding: (val: boolean) => void;
  setShowLogModal: (val: boolean) => void;
  setActiveLogCategory: (cat: LogCategory | null) => void;
  setIsLoading: (val: boolean) => void;
  resetStore: () => void;
}

export type PageName = 'dashboard' | 'log' | 'coach' | 'twin' | 'simulator' | 'goals' | 'challenges' | 'report' | 'settings';
