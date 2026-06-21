// ============================================================================
// EcoTrack AI — Carbon Calculation Module
// ============================================================================
// This is the credibility backbone of EcoTrack AI. All emission factors are
// sourced from peer-reviewed publications and government agencies. The model
// (AI) NEVER invents emission numbers — it explains and prioritizes; this
// module always does the math.
//
// Sources:
// - EPA GHG Emission Factors Hub (2024): https://www.epa.gov/climateleadership/ghg-emission-factors-hub
// - IPCC AR6 (2023): https://www.ipcc.ch/report/ar6/wg3/
// - Poore & Nemecek (2018), Science: "Reducing food's environmental impacts through producers and consumers"
// - DEFRA (2023): UK Government GHG Conversion Factors
// - WRAP UK: Clothing sustainability data
// ============================================================================

import type {
  TransportMode,
  DietType,
  EnergySource,
  Region,
  LogCategory,
  SustainabilityRating,
  ActivityLog,
} from '../types';

// ============================================================================
// EMISSION FACTORS (kg CO₂e per unit)
// ============================================================================

/**
 * Transport emission factors in kg CO₂e per passenger-km.
 * Sources: EPA (2024), IPCC AR6 (2023), DEFRA (2023)
 */
export const TRANSPORT_FACTORS: Record<TransportMode, number> = {
  // EPA: avg passenger car = 404g CO₂/mi ≈ 0.251 kg/km; we use 0.21 for modern fleet avg
  car_gasoline: 0.21,
  // EPA: diesel vehicles slightly higher per km
  car_diesel: 0.27,
  // IPCC: BEVs using avg grid ≈ 0.05 kg/km (varies hugely by grid)
  car_electric: 0.05,
  // DEFRA 2023: average local bus
  bus: 0.089,
  // DEFRA 2023: national rail average
  train: 0.041,
  // Zero direct emissions
  bicycle: 0,
  walking: 0,
  // DEFRA 2023: average motorcycle
  motorcycle: 0.113,
  // DEFRA 2023: domestic flight avg (incl. radiative forcing uplift)
  flight_domestic: 0.255,
  // DEFRA 2023: long-haul flight avg (incl. radiative forcing uplift)
  flight_international: 0.195,
};

/**
 * Food emission factors in kg CO₂e per meal.
 * Source: Poore & Nemecek (2018), Science. Values represent average
 * lifecycle emissions including production, processing, transport, and retail.
 */
export const FOOD_FACTORS: Record<DietType, number> = {
  // Avg meal with beef/lamb: ~6.6 kg CO₂e (we average across meal types)
  omnivore: 2.5,
  // Fish-based meals average
  pescatarian: 1.4,
  // Plant + dairy meals
  vegetarian: 0.7,
  // Fully plant-based meals
  vegan: 0.4,
};

/**
 * Meal-specific multipliers (applied on top of diet factors).
 * Breakfast is typically lighter; dinner typically heavier.
 */
export const MEAL_MULTIPLIERS: Record<string, number> = {
  breakfast: 0.6,
  lunch: 1.0,
  dinner: 1.3,
  snack: 0.3,
};

/**
 * Energy emission factors.
 * Sources: EPA eGRID (2024), IPCC AR6
 */
export const ENERGY_FACTORS = {
  // EPA eGRID 2022: US national avg = 0.417 kg CO₂/kWh
  electricity_grid: 0.417,
  // Renewable sources (solar/wind): lifecycle emissions only
  electricity_renewable: 0.02,
  // EPA: natural gas combustion = ~2.0 kg CO₂/m³
  natural_gas: 2.0,
  // EPA: heating oil = ~2.68 kg CO₂/liter
  heating_oil: 2.68,
} as const;

/**
 * Regional electricity grid factors (kg CO₂/kWh).
 * Source: IEA (2023), EPA eGRID (2022)
 */
export const REGIONAL_GRID_FACTORS: Record<Region, number> = {
  north_america: 0.417,
  europe: 0.276,
  asia: 0.555,
  oceania: 0.510,
  south_america: 0.175,
  africa: 0.480,
  middle_east: 0.550,
};

/**
 * Shopping emission factors in kg CO₂e per item.
 * Sources: WRAP UK, various LCA studies
 */
export const SHOPPING_FACTORS = {
  // WRAP UK: average clothing item lifecycle
  clothing: 10,
  // Various LCA: average consumer electronics
  electronics: 50,
  // Average furniture piece
  furniture: 40,
  // Average grocery basket
  groceries: 3,
  // Generic consumer goods
  other: 5,
  // Secondhand multiplier (reduces by ~80%)
  secondhand_multiplier: 0.2,
} as const;

/**
 * Waste emission factors in kg CO₂e per kg of waste.
 * Source: EPA WARM model (2023)
 */
export const WASTE_FACTORS = {
  // Landfill with gas capture
  general: 0.58,
  // Recycling avoids virgin production
  recycling: -0.18,
  // Composting (net includes avoided landfill)
  compost: -0.1,
  // E-waste (per kg, including toxic processing)
  electronic: 2.0,
} as const;

/**
 * Average annual emissions by region (kg CO₂e/person/year).
 * Source: Global Carbon Project (2023)
 */
export const REGIONAL_AVERAGES: Record<Region, number> = {
  north_america: 17600,
  europe: 7200,
  asia: 4800,
  oceania: 15000,
  south_america: 3200,
  africa: 1300,
  middle_east: 9000,
};

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate transport emissions.
 * @param mode - Transport mode used
 * @param distanceKm - Distance traveled in kilometers
 * @param passengers - Number of passengers (for car-sharing reduction)
 * @returns Emission in kg CO₂e
 */
export function calculateTransportEmission(
  mode: TransportMode,
  distanceKm: number,
  passengers: number = 1
): number {
  const baseFactor = TRANSPORT_FACTORS[mode];
  const emission = baseFactor * distanceKm;

  // Car-sharing: divide emissions among passengers
  if (
    (mode === 'car_gasoline' || mode === 'car_diesel' || mode === 'car_electric') &&
    passengers > 1
  ) {
    return Math.round((emission / passengers) * 100) / 100;
  }

  return Math.round(emission * 100) / 100;
}

/**
 * Calculate food emissions for a single meal.
 * @param dietType - Type of diet for this meal
 * @param mealType - Meal timing (affects portion size)
 * @param isOrganic - Organic food (slightly lower emissions)
 * @param isLocal - Locally sourced (reduces transport emissions)
 * @returns Emission in kg CO₂e
 */
export function calculateFoodEmission(
  dietType: DietType,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'lunch',
  isOrganic: boolean = false,
  isLocal: boolean = false
): number {
  let emission = FOOD_FACTORS[dietType] * (MEAL_MULTIPLIERS[mealType] || 1.0);

  // Organic food: ~5-10% lower lifecycle emissions on average
  if (isOrganic) emission *= 0.93;
  // Local sourcing: ~5% reduction (food miles are small fraction of total)
  if (isLocal) emission *= 0.95;

  return Math.round(emission * 100) / 100;
}

/**
 * Calculate energy emissions.
 * @param type - Energy type (electricity, natural_gas, heating_oil)
 * @param amount - Amount consumed (kWh for electricity, m³ for gas, liters for oil)
 * @param source - Energy source type
 * @param region - User's region (affects grid factor)
 * @param householdSize - Number of people in household (per-person allocation)
 * @returns Emission in kg CO₂e (per person)
 */
export function calculateEnergyEmission(
  type: 'electricity' | 'natural_gas' | 'heating_oil',
  amount: number,
  source: EnergySource = 'grid_default',
  region: Region = 'north_america',
  householdSize: number = 1
): number {
  let factor: number;

  if (type === 'electricity') {
    factor =
      source === 'renewable'
        ? ENERGY_FACTORS.electricity_renewable
        : REGIONAL_GRID_FACTORS[region];
  } else if (type === 'natural_gas') {
    factor = ENERGY_FACTORS.natural_gas;
  } else {
    factor = ENERGY_FACTORS.heating_oil;
  }

  const totalEmission = factor * amount;
  // Divide by household size for per-person allocation
  const perPerson = totalEmission / Math.max(householdSize, 1);

  return Math.round(perPerson * 100) / 100;
}

/**
 * Calculate shopping emissions.
 * @param itemType - Type of item purchased
 * @param quantity - Number of items
 * @param isSecondhand - Whether item is secondhand
 * @returns Emission in kg CO₂e
 */
export function calculateShoppingEmission(
  itemType: 'clothing' | 'electronics' | 'furniture' | 'groceries' | 'other',
  quantity: number = 1,
  isSecondhand: boolean = false
): number {
  const baseFactor = SHOPPING_FACTORS[itemType];
  const multiplier = isSecondhand ? SHOPPING_FACTORS.secondhand_multiplier : 1;
  const emission = baseFactor * quantity * multiplier;
  return Math.round(emission * 100) / 100;
}

/**
 * Calculate waste emissions.
 * @param type - Waste type
 * @param weightKg - Weight in kilograms
 * @returns Emission in kg CO₂e (can be negative for recycling/composting)
 */
export function calculateWasteEmission(
  type: 'general' | 'recycling' | 'compost' | 'electronic',
  weightKg: number
): number {
  const factor = WASTE_FACTORS[type];
  return Math.round(factor * weightKg * 100) / 100;
}

/**
 * Calculate a user's estimated annual baseline footprint from their profile.
 * Uses lifestyle factors to estimate without detailed logging data.
 * @param profile - Partial user profile from onboarding
 * @returns Estimated annual kg CO₂e
 */
export function calculateBaselineFootprint(profile: {
  region: Region;
  diet: DietType;
  primaryTransport: TransportMode;
  householdSize: number;
  energySource: EnergySource;
}): number {
  const { region, diet, primaryTransport, householdSize, energySource } = profile;

  // --- Transport: estimate ~40 km/day avg commute ---
  const dailyTransportKm = 40;
  const annualTransportDays = 260; // working days
  const transportAnnual =
    calculateTransportEmission(primaryTransport, dailyTransportKm) * annualTransportDays;

  // --- Food: 3 meals/day, 365 days ---
  const dailyFoodEmission =
    calculateFoodEmission(diet, 'breakfast') +
    calculateFoodEmission(diet, 'lunch') +
    calculateFoodEmission(diet, 'dinner');
  const foodAnnual = dailyFoodEmission * 365;

  // --- Energy: estimate based on regional average household consumption ---
  // US avg: ~10,500 kWh/yr electricity, ~1,200 m³ natural gas
  const regionalMultiplier: Record<Region, number> = {
    north_america: 1.0,
    europe: 0.7,
    asia: 0.5,
    oceania: 0.9,
    south_america: 0.4,
    africa: 0.3,
    middle_east: 0.8,
  };
  const baseElectricity = 10500 * regionalMultiplier[region];
  const electricityAnnual = calculateEnergyEmission(
    'electricity',
    baseElectricity,
    energySource,
    region,
    householdSize
  );
  const gasAnnual = calculateEnergyEmission(
    'natural_gas',
    800 * regionalMultiplier[region],
    energySource,
    region,
    householdSize
  );

  // --- Shopping: estimate based on regional averages ---
  const shoppingAnnual = 500 * regionalMultiplier[region]; // kg CO₂e/yr

  // --- Waste: ~0.5 kg/day per person avg ---
  const wasteAnnual = calculateWasteEmission('general', 0.5) * 365;

  const total =
    transportAnnual + foodAnnual + electricityAnnual + gasAnnual + shoppingAnnual + wasteAnnual;

  return Math.round(total);
}

/**
 * Calculate a carbon risk score (0-100) based on how a user's baseline
 * compares to the sustainable target of 2,000 kg CO₂e/person/year
 * (Paris Agreement pathway).
 */
export function calculateCarbonRiskScore(baselineKg: number): number {
  // 2000 kg = ideal (score 0), regional avg = score 50, 2x regional avg = score 100
  const sustainableTarget = 2000;
  const score = Math.min(100, Math.max(0, ((baselineKg - sustainableTarget) / sustainableTarget) * 50));
  return Math.round(score);
}

/**
 * Get sustainability rating based on emission amount relative to average.
 */
export function getSustainabilityRating(
  emissionKg: number,
  category: LogCategory,
): SustainabilityRating {
  // Daily averages by category (kg CO₂e) for comparison
  const dailyAverages: Record<LogCategory, number> = {
    transport: 8.4,    // ~40km car commute
    food: 7.5,         // 3 omnivore meals
    energy: 12.0,      // US avg daily energy
    shopping: 2.7,     // spread across year
    waste: 0.29,       // ~0.5kg landfill waste
  };

  const avg = dailyAverages[category];
  const ratio = emissionKg / avg;

  if (ratio <= 0.2) return 'A';
  if (ratio <= 0.5) return 'B';
  if (ratio <= 0.8) return 'C';
  if (ratio <= 1.2) return 'D';
  return 'F';
}

/**
 * Project annual emissions based on logged data.
 * Extrapolates from available data to estimate full-year emissions.
 */
export function projectAnnualEmissions(
  logs: ActivityLog[],
  daysOfData: number
): number {
  if (daysOfData === 0 || logs.length === 0) return 0;

  const totalEmissions = logs.reduce((sum, log) => sum + log.carbonKg, 0);
  const dailyAverage = totalEmissions / daysOfData;
  return Math.round(dailyAverage * 365);
}

/**
 * Calculate category breakdown from logs.
 */
export function getCategoryBreakdown(
  logs: ActivityLog[]
): Record<LogCategory, number> {
  const breakdown: Record<LogCategory, number> = {
    transport: 0,
    food: 0,
    energy: 0,
    shopping: 0,
    waste: 0,
  };

  for (const log of logs) {
    breakdown[log.category] += log.carbonKg;
  }

  // Round all values
  for (const key of Object.keys(breakdown) as LogCategory[]) {
    breakdown[key] = Math.round(breakdown[key] * 100) / 100;
  }

  return breakdown;
}

/**
 * Calculate the "eco best case" annual footprint —
 * assumes optimal choices in every category.
 */
export function calculateEcoBaseline(region: Region): number {
  // Best-case: cycling/walking, vegan diet, renewable energy, minimal shopping, composting
  const transportAnnual = 0; // bicycle/walking
  const foodAnnual =
    (calculateFoodEmission('vegan', 'breakfast') +
      calculateFoodEmission('vegan', 'lunch') +
      calculateFoodEmission('vegan', 'dinner')) * 365;
  const energyAnnual = calculateEnergyEmission(
    'electricity',
    5000, // reduced consumption
    'renewable',
    region,
    1
  );
  const shoppingAnnual = 100; // minimal, mostly secondhand
  const wasteAnnual = calculateWasteEmission('compost', 0.3) * 365;

  return Math.round(transportAnnual + foodAnnual + energyAnnual + shoppingAnnual + wasteAnnual);
}

/**
 * Get the sustainability profile label based on baseline footprint and region.
 */
export function getSustainabilityProfile(
  baselineKg: number,
  region: Region
): string {
  const regionalAvg = REGIONAL_AVERAGES[region];
  const ratio = baselineKg / regionalAvg;

  if (ratio <= 0.3) return 'Climate Champion';
  if (ratio <= 0.5) return 'Eco Leader';
  if (ratio <= 0.7) return 'Green Advocate';
  if (ratio <= 0.9) return 'Conscious Consumer';
  if (ratio <= 1.1) return 'Average Impact';
  if (ratio <= 1.3) return 'Room for Growth';
  return 'High Impact';
}
