// ============================================================================
// EcoTrack AI — AI Client Module
// ============================================================================
// Single shared module for all AI interactions. Calls Google Gemini API
// (gemini-2.0-flash) with structured prompts. Falls back to a local
// rules-based generator when no API key is available.
//
// IMPORTANT: The model NEVER invents emission numbers. It explains and
// prioritizes; the carbon-calc module always does the math.
// ============================================================================

import type {
  UserProfile,
  ActivityLog,
  CoachRecommendation,
  Challenge,
  WeeklyReport,
  LogCategory,
} from '../types';
import { getCategoryBreakdown, projectAnnualEmissions, REGIONAL_AVERAGES } from './carbon-calc';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GEMINI_MODEL = 'gemini-2.0-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const IS_AI_AVAILABLE = !!GEMINI_API_KEY;

// ============================================================================
// Gemini API Call
// ============================================================================

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ============================================================================
// Helper: Build context from user data
// ============================================================================

function buildUserContext(
  profile: UserProfile,
  logs: ActivityLog[],
  daysOfData?: number
): string {
  const breakdown = getCategoryBreakdown(logs);
  const actualDays = daysOfData ?? Math.max(1, Math.ceil(
    (Date.now() - new Date(logs[0]?.timestamp ?? Date.now()).getTime()) / 86400000
  ));
  const projected = projectAnnualEmissions(logs, actualDays);
  const recentLogs = logs.slice(-20);

  return `
USER PROFILE:
- Name: ${profile.name}
- Region: ${profile.region}
- Diet: ${profile.diet}
- Primary Transport: ${profile.primaryTransport}
- Household Size: ${profile.householdSize}
- Energy Source: ${profile.energySource}
- Baseline Annual Footprint: ${profile.baselineFootprint} kg CO₂e/year
- Carbon Risk Score: ${profile.carbonRiskScore}/100
- Sustainability Profile: ${profile.sustainabilityProfile}

EMISSION BREAKDOWN (last ${actualDays} days):
- Transport: ${breakdown.transport.toFixed(1)} kg CO₂e
- Food: ${breakdown.food.toFixed(1)} kg CO₂e
- Energy: ${breakdown.energy.toFixed(1)} kg CO₂e
- Shopping: ${breakdown.shopping.toFixed(1)} kg CO₂e
- Waste: ${breakdown.waste.toFixed(1)} kg CO₂e
- Total: ${Object.values(breakdown).reduce((a, b) => a + b, 0).toFixed(1)} kg CO₂e

PROJECTED ANNUAL: ${projected} kg CO₂e/year

RECENT ACTIVITY LOG (last 20 entries):
${recentLogs.map(l => `  - ${l.category}: ${l.carbonKg} kg CO₂e (${new Date(l.timestamp).toLocaleDateString()})`).join('\n')}
  `.trim();
}

// ============================================================================
// AI Functions
// ============================================================================

/**
 * Generate personalized onboarding insights from the user's profile.
 */
export async function generateOnboardingInsights(
  profile: UserProfile
): Promise<{ summary: string; recommendations: string[] }> {
  if (IS_AI_AVAILABLE) {
    try {
      const prompt = `You are EcoTrack AI, a friendly and knowledgeable climate coach. Based on this user's profile, provide a personalized onboarding summary.

${buildUserContext(profile, [])}

Respond with JSON in this exact format:
{
  "summary": "A 2-3 sentence personalized analysis of their carbon footprint. Be specific about their biggest emission sources based on their profile. Reference their actual inputs (diet, transport, etc). Mention how they compare to their regional average.",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}

RULES:
- Be specific and personalized, never generic
- Reference their actual profile data
- All numbers must be grounded in the profile data provided
- Keep tone encouraging, not guilt-based
- Each recommendation should reference a specific aspect of their profile`;

      const result = await callGemini(prompt);
      return JSON.parse(result);
    } catch (error) {
      console.warn('[AI Client] Gemini call failed, using fallback:', error);
    }
  }

  // Local fallback
  return generateOnboardingInsightsFallback(profile);
}

/**
 * Generate AI Climate Coach recommendations.
 */
export async function generateCoachAdvice(
  profile: UserProfile,
  logs: ActivityLog[]
): Promise<CoachRecommendation[]> {
  if (IS_AI_AVAILABLE && logs.length > 0) {
    try {
      const prompt = `You are EcoTrack AI's Climate Coach. Analyze this user's behavior and generate personalized, actionable recommendations.

${buildUserContext(profile, logs)}

Respond with JSON array. Each item:
{
  "title": "Short actionable title",
  "description": "Specific, personalized advice referencing their actual logged data patterns",
  "category": "transport|food|energy|shopping|waste",
  "confidence": "high|medium|low",
  "feasibility": "easy|moderate|challenging",
  "whyExplanation": "One-line explanation of why this matters for THEM specifically"
}

RULES:
- Generate 3-5 recommendations ranked by estimated impact
- NEVER give generic advice like "Use public transportation"
- ALWAYS reference specific patterns from their logs (e.g., "You completed X car trips under Y km")
- Be specific with numbers, but DON'T invent emission calculations — reference the breakdown data provided
- Keep tone encouraging, coach-like, not preachy
- Focus on their biggest emission categories first`;

      const result = await callGemini(prompt);
      const parsed = JSON.parse(result);
      const recs: CoachRecommendation[] = Array.isArray(parsed) ? parsed : parsed.recommendations ?? [];
      
      // Add computed savings from carbon-calc (AI doesn't invent numbers)
      const breakdown = getCategoryBreakdown(logs);
      return recs.map((rec: Partial<CoachRecommendation>, i: number) => ({
        id: `coach-${Date.now()}-${i}`,
        title: rec.title ?? 'Recommendation',
        description: rec.description ?? '',
        estimatedSavingsKg: Math.round((breakdown[rec.category as LogCategory] ?? 10) * 0.3 * 100) / 100,
        confidence: rec.confidence ?? 'medium',
        feasibility: rec.feasibility ?? 'moderate',
        whyExplanation: rec.whyExplanation ?? '',
        category: (rec.category as LogCategory) ?? 'transport',
        isAIGenerated: true,
      }));
    } catch (error) {
      console.warn('[AI Client] Coach advice failed, using fallback:', error);
    }
  }

  return generateCoachAdviceFallback(profile, logs);
}

/**
 * Generate AI Weekly Report.
 */
export async function generateWeeklyReport(
  profile: UserProfile,
  logs: ActivityLog[],
  goals: { targetReductionPercent: number; currentReductionPercent: number }[]
): Promise<Omit<WeeklyReport, 'id' | 'weekStartDate' | 'weekEndDate' | 'generatedAt'>> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const weekLogs = logs.filter(l => new Date(l.timestamp) >= weekAgo);
  const prevWeekLogs = logs.filter(l => {
    const d = new Date(l.timestamp);
    return d >= new Date(weekAgo.getTime() - 7 * 86400000) && d < weekAgo;
  });

  const totalEmissions = weekLogs.reduce((s, l) => s + l.carbonKg, 0);
  const prevTotal = prevWeekLogs.reduce((s, l) => s + l.carbonKg, 0);
  const breakdown = getCategoryBreakdown(weekLogs);
  const biggestSources = (Object.entries(breakdown) as [LogCategory, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([category, amountKg]) => ({ category, amountKg }));

  if (IS_AI_AVAILABLE && weekLogs.length > 0) {
    try {
      const prompt = `You are EcoTrack AI generating a weekly carbon footprint report. Write like a supportive personal coach, not a template.

${buildUserContext(profile, weekLogs, 7)}

PREVIOUS WEEK TOTAL: ${prevTotal.toFixed(1)} kg CO₂e
THIS WEEK TOTAL: ${totalEmissions.toFixed(1)} kg CO₂e
CHANGE: ${prevTotal > 0 ? (((totalEmissions - prevTotal) / prevTotal) * 100).toFixed(1) : '0'}%

GOALS: ${goals.map(g => `Target ${g.targetReductionPercent}% reduction, currently at ${g.currentReductionPercent}%`).join('; ') || 'No goals set'}

Respond with JSON:
{
  "narrativeSummary": "A 3-5 sentence natural-language weekly summary. Should read like a real coach wrote it, not a template. Reference specific activities and numbers from the data.",
  "biggestWins": ["win 1", "win 2"],
  "recommendedActions": ["action 1", "action 2", "action 3"]
}

RULES:
- Be specific and personal
- Reference actual logged activities
- Celebrate wins before addressing areas for improvement
- Never invent numbers — use only the data provided`;

      const result = await callGemini(prompt);
      const parsed = JSON.parse(result);

      return {
        totalEmissionsKg: Math.round(totalEmissions * 100) / 100,
        comparedToLastWeek: prevTotal > 0 ? Math.round(((totalEmissions - prevTotal) / prevTotal) * 10000) / 100 : 0,
        biggestWins: parsed.biggestWins ?? ['Logging consistently!'],
        biggestSources,
        goalProgress: goals[0]?.currentReductionPercent ?? 0,
        projectedMonthlyKg: Math.round(totalEmissions * 4.33),
        narrativeSummary: parsed.narrativeSummary ?? '',
        recommendedActions: parsed.recommendedActions ?? [],
        isAIGenerated: true,
      };
    } catch (error) {
      console.warn('[AI Client] Weekly report failed, using fallback:', error);
    }
  }

  return generateWeeklyReportFallback(totalEmissions, prevTotal, biggestSources, goals);
}

/**
 * Generate adaptive weekly challenge.
 */
export async function generateChallenge(
  profile: UserProfile,
  logs: ActivityLog[],
  completedChallenges: Challenge[]
): Promise<Omit<Challenge, 'id' | 'isActive' | 'isCompleted' | 'progress'>> {
  const breakdown = getCategoryBreakdown(logs);
  const weakestCategory = (Object.entries(breakdown) as [LogCategory, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'transport';

  const weekNum = completedChallenges.length + 1;
  const difficulty = weekNum <= 2 ? 'easy' : weekNum <= 5 ? 'medium' : 'hard';

  if (IS_AI_AVAILABLE && logs.length > 0) {
    try {
      const prompt = `You are EcoTrack AI generating an adaptive weekly challenge. This is week ${weekNum} for the user.

${buildUserContext(profile, logs)}

COMPLETED CHALLENGES: ${completedChallenges.map(c => c.title).join(', ') || 'None yet'}
WEAKEST CATEGORY: ${weakestCategory}
DIFFICULTY LEVEL: ${difficulty}

Respond with JSON:
{
  "title": "Challenge title (action-oriented, specific)",
  "description": "Detailed description with specific targets based on their data",
  "targetAction": "Specific measurable action",
  "durationDays": 7,
  "difficulty": "${difficulty}"
}

RULES:
- Challenge must target their weakest category
- Must scale based on completed challenges (harder each week)
- Must be specific to their actual logged behavior
- Must be achievable but stretch their comfort zone`;

      const result = await callGemini(prompt);
      const parsed = JSON.parse(result);

      return {
        title: parsed.title ?? 'Weekly Challenge',
        description: parsed.description ?? '',
        difficulty,
        durationDays: 7,
        targetAction: parsed.targetAction ?? '',
        weekNumber: weekNum,
        estimatedSavingsKg: Math.round(breakdown[weakestCategory as LogCategory] * 0.2 * 100) / 100,
        isAIGenerated: true,
      };
    } catch (error) {
      console.warn('[AI Client] Challenge generation failed, using fallback:', error);
    }
  }

  return generateChallengeFallback(weakestCategory as LogCategory, weekNum, difficulty, breakdown);
}

// ============================================================================
// Local Fallback Generators
// ============================================================================
// These are clearly-labeled rule-based generators that run when no Gemini API
// key is available. They provide functional but less personalized output.

function generateOnboardingInsightsFallback(
  profile: UserProfile
): { summary: string; recommendations: string[] } {
  const { baselineFootprint, region, diet, primaryTransport, energySource } = profile;
  const regionalAvg = REGIONAL_AVERAGES[region] ?? 10000;
  const comparison = baselineFootprint < regionalAvg ? 'lower' : 'higher';
  const pct = Math.abs(Math.round(((baselineFootprint - regionalAvg) / regionalAvg) * 100));

  const transportPct = primaryTransport.includes('car') ? 'significant' : 'modest';
  const dietImpact = diet === 'omnivore' ? 'substantial' : diet === 'vegetarian' ? 'moderate' : 'minimal';

  const summary = `Your estimated annual footprint of ${baselineFootprint.toLocaleString()} kg CO₂e is ${pct}% ${comparison} than the ${region.replace('_', ' ')} average. Your ${primaryTransport.replace('_', ' ')} commute contributes a ${transportPct} share, while your ${diet} diet has a ${dietImpact} food impact.${energySource === 'renewable' ? ' Great choice on renewable energy — that significantly reduces your electricity emissions!' : ''}`;

  const recommendations: string[] = [];
  if (primaryTransport.includes('car')) {
    recommendations.push(`Consider cycling or public transit for trips under 5km — even replacing 2-3 short car trips per week could save ~200 kg CO₂e annually.`);
  }
  if (diet === 'omnivore') {
    recommendations.push(`Try incorporating 2 meat-free days per week. This alone could reduce your food emissions by ~15%.`);
  }
  if (energySource !== 'renewable') {
    recommendations.push(`Switching to a renewable energy provider could reduce your electricity emissions by up to 95%.`);
  }
  if (recommendations.length < 3) {
    recommendations.push(`Track your daily activities for a week to get personalized insights on where your biggest savings opportunities are.`);
  }

  return { summary, recommendations };
}

function generateCoachAdviceFallback(
  profile: UserProfile,
  logs: ActivityLog[]
): CoachRecommendation[] {
  const breakdown = getCategoryBreakdown(logs);
  const sorted = (Object.entries(breakdown) as [LogCategory, number][])
    .sort((a, b) => b[1] - a[1]);

  const recommendations: CoachRecommendation[] = [];

  // Analyze transport logs
  const transportLogs = logs.filter(l => l.category === 'transport');
  const carTrips = transportLogs.filter(l => {
    const d = l.details as { mode?: string; distanceKm?: number };
    return d.mode?.includes('car') && (d.distanceKm ?? 0) < 5;
  });

  if (carTrips.length > 0) {
    recommendations.push({
      id: `fallback-${Date.now()}-0`,
      title: 'Replace short car trips with cycling',
      description: `You logged ${carTrips.length} car trip${carTrips.length > 1 ? 's' : ''} under 5km recently. These short trips are ideal for cycling or walking, which would eliminate their emissions entirely.`,
      estimatedSavingsKg: Math.round(carTrips.reduce((s, l) => s + l.carbonKg, 0) * 100) / 100,
      confidence: 'high',
      feasibility: 'easy',
      whyExplanation: 'Short car trips have disproportionately high per-km emissions due to cold starts.',
      category: 'transport',
      isAIGenerated: false,
    });
  }

  // Analyze food
  if (breakdown.food > 0 && profile.diet === 'omnivore') {
    recommendations.push({
      id: `fallback-${Date.now()}-1`,
      title: 'Try meat-free meals twice a week',
      description: `Your omnivore diet contributes significantly to food emissions. Replacing just 2 meals per week with vegetarian options could save approximately ${Math.round(2 * 52 * 1.8)} kg CO₂e per year.`,
      estimatedSavingsKg: Math.round(2 * 52 * 1.8),
      confidence: 'high',
      feasibility: 'easy',
      whyExplanation: 'Meat production is the single largest source of food-related emissions.',
      category: 'food',
      isAIGenerated: false,
    });
  }

  // Generic top-category recommendation
  if (sorted[0] && recommendations.length < 3) {
    const [topCat, topAmount] = sorted[0];
    recommendations.push({
      id: `fallback-${Date.now()}-2`,
      title: `Focus on reducing ${topCat} emissions`,
      description: `${topCat.charAt(0).toUpperCase() + topCat.slice(1)} is your highest emission category at ${topAmount.toFixed(1)} kg CO₂e. A 20% reduction here would save approximately ${(topAmount * 0.2).toFixed(1)} kg CO₂e.`,
      estimatedSavingsKg: Math.round(topAmount * 0.2 * 100) / 100,
      confidence: 'medium',
      feasibility: 'moderate',
      whyExplanation: `Targeting your largest emission source gives the best return on effort.`,
      category: topCat,
      isAIGenerated: false,
    });
  }

  return recommendations;
}

function generateWeeklyReportFallback(
  totalEmissions: number,
  prevTotal: number,
  biggestSources: Array<{ category: LogCategory; amountKg: number }>,
  goals: { targetReductionPercent: number; currentReductionPercent: number }[]
): Omit<WeeklyReport, 'id' | 'weekStartDate' | 'weekEndDate' | 'generatedAt'> {
  const change = prevTotal > 0 ? ((totalEmissions - prevTotal) / prevTotal) * 100 : 0;
  const direction = change < 0 ? 'decreased' : change > 0 ? 'increased' : 'stayed the same';
  const topSource = biggestSources[0];

  return {
    totalEmissionsKg: Math.round(totalEmissions * 100) / 100,
    comparedToLastWeek: Math.round(change * 100) / 100,
    biggestWins: change < 0
      ? [`You reduced your emissions by ${Math.abs(change).toFixed(1)}% compared to last week!`]
      : ['Keep logging to track your progress!'],
    biggestSources,
    goalProgress: goals[0]?.currentReductionPercent ?? 0,
    projectedMonthlyKg: Math.round(totalEmissions * 4.33),
    narrativeSummary: `This week your carbon footprint ${direction} to ${totalEmissions.toFixed(1)} kg CO₂e${change !== 0 ? ` (${Math.abs(change).toFixed(1)}% ${change < 0 ? 'reduction' : 'increase'})` : ''}. ${topSource ? `Your biggest emission source was ${topSource.category} at ${topSource.amountKg.toFixed(1)} kg CO₂e.` : ''} ${change < 0 ? 'Great progress — keep up the momentum!' : 'Focus on your highest-impact categories for the biggest wins.'}`,
    recommendedActions: [
      'Log activities daily for more accurate tracking',
      topSource ? `Look for ways to reduce ${topSource.category} emissions` : 'Set a reduction goal to stay motivated',
    ],
    isAIGenerated: false,
  };
}

function generateChallengeFallback(
  weakestCategory: LogCategory,
  weekNumber: number,
  difficulty: 'easy' | 'medium' | 'hard',
  breakdown: Record<LogCategory, number>
): Omit<Challenge, 'id' | 'isActive' | 'isCompleted' | 'progress'> {
  const challenges: Record<LogCategory, Record<string, { title: string; description: string; targetAction: string }>> = {
    transport: {
      easy: { title: 'Walk or bike for 2 short trips', description: 'Replace 2 car trips under 3km with walking or cycling this week.', targetAction: 'Log 2 bicycle/walking trips' },
      medium: { title: 'Car-free commute 3 days', description: 'Use public transit, cycling, or walking for your commute 3 days this week.', targetAction: 'Log 3 non-car commutes' },
      hard: { title: 'Full car-free week', description: 'Go the entire week without using a personal car for any trip.', targetAction: 'No car trips for 7 days' },
    },
    food: {
      easy: { title: '2 vegetarian days', description: 'Have all-vegetarian meals on 2 days this week.', targetAction: 'Log 6 vegetarian meals across 2 days' },
      medium: { title: '4 plant-based days', description: 'Eat vegetarian or vegan for 4 full days this week.', targetAction: 'Log 12 plant-based meals across 4 days' },
      hard: { title: 'Full vegan week', description: 'Try going fully vegan for the entire week.', targetAction: 'Log 21 vegan meals' },
    },
    energy: {
      easy: { title: 'Reduce standby power', description: 'Unplug idle electronics and reduce phantom load this week.', targetAction: 'Reduce daily energy usage by 10%' },
      medium: { title: 'Cut energy use by 20%', description: 'Be mindful of heating, cooling, and electronics usage to achieve a 20% reduction.', targetAction: 'Reduce weekly energy emissions by 20%' },
      hard: { title: 'Minimal energy week', description: 'Challenge yourself to use only essential electricity and heating this week.', targetAction: 'Reduce weekly energy emissions by 40%' },
    },
    shopping: {
      easy: { title: 'No-buy day challenge', description: 'Have 3 days this week where you make no purchases of new items.', targetAction: '3 no-shopping days' },
      medium: { title: 'Secondhand only', description: 'If you need to buy anything this week, buy it secondhand.', targetAction: 'All purchases secondhand' },
      hard: { title: 'Zero new purchases week', description: 'Go the entire week without buying any new consumer goods.', targetAction: 'No new purchases for 7 days' },
    },
    waste: {
      easy: { title: 'Start composting', description: 'Compost food scraps instead of sending them to landfill for at least 3 days.', targetAction: 'Log 3 compost entries' },
      medium: { title: 'Zero landfill waste', description: 'Recycle or compost everything this week — nothing to landfill.', targetAction: 'No general waste entries' },
      hard: { title: 'Near-zero waste week', description: 'Minimize all waste generation through mindful consumption and full recycling.', targetAction: 'Total waste under 1kg' },
    },
  };

  const challenge = challenges[weakestCategory]?.[difficulty] ?? challenges.transport.easy;

  return {
    title: challenge.title,
    description: challenge.description,
    difficulty,
    durationDays: 7,
    targetAction: challenge.targetAction,
    weekNumber: weekNumber,
    estimatedSavingsKg: Math.round((breakdown[weakestCategory] ?? 5) * 0.2 * 100) / 100,
    isAIGenerated: false,
  };
}

/**
 * Check if AI is available (for UI indicators).
 */
export function isAIAvailable(): boolean {
  return IS_AI_AVAILABLE;
}
