// ============================================================================
// EcoTrack AI — Relatable Equivalents Module
// ============================================================================
// Converts raw kg CO₂ numbers into human-understandable comparisons.
// All equivalences sourced from EPA equivalency calculator:
// https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator
// ============================================================================

export interface Equivalent {
  label: string;
  value: number;
  unit: string;
  icon: string;
}

/**
 * Smartphone charges equivalent.
 * EPA: Charging a smartphone uses ~0.012 kWh; at US avg grid = ~0.005 kg CO₂.
 * But "smartphone charges" is a common proxy ≈ 0.008 kg CO₂ per charge.
 */
const KG_PER_SMARTPHONE_CHARGE = 0.008;

/**
 * Trees absorbing CO₂.
 * EPA: One mature tree absorbs ~22 kg CO₂ per year.
 */
const KG_PER_TREE_YEAR = 22;

/**
 * Driving equivalent.
 * EPA: Average passenger vehicle emits ~0.21 kg CO₂ per km.
 */
const KG_PER_KM_DRIVEN = 0.21;

/**
 * Streaming video.
 * IEA: ~0.036 kg CO₂ per hour of streaming.
 */
const KG_PER_STREAMING_HOUR = 0.036;

/**
 * LED lightbulb hours.
 * ~10W LED × US avg grid factor × 1hr = ~0.004 kg CO₂.
 */
const KG_PER_LED_HOUR = 0.004;

/**
 * Boiling a kettle.
 * ~0.1 kWh × 0.417 = ~0.042 kg CO₂.
 */
const KG_PER_KETTLE_BOIL = 0.042;

/**
 * Plastic bags.
 * ~0.033 kg CO₂ per bag (production + disposal).
 */
const KG_PER_PLASTIC_BAG = 0.033;

/**
 * Get the single best relatable comparison for a given CO₂ amount.
 */
export function getBestEquivalent(carbonKg: number): string {
  const abs = Math.abs(carbonKg);

  if (abs < 0.01) {
    return 'Negligible carbon impact';
  }

  if (abs < 0.1) {
    const charges = Math.round(abs / KG_PER_SMARTPHONE_CHARGE);
    return `= charging a smartphone ${charges} time${charges !== 1 ? 's' : ''}`;
  }

  if (abs < 1) {
    const hours = Math.round(abs / KG_PER_STREAMING_HOUR);
    return `= ${hours} hour${hours !== 1 ? 's' : ''} of video streaming`;
  }

  if (abs < 5) {
    const km = Math.round(abs / KG_PER_KM_DRIVEN);
    return `= driving ${km} km in a car`;
  }

  if (abs < 22) {
    const bags = Math.round(abs / KG_PER_PLASTIC_BAG);
    return `= producing ${bags} plastic bags`;
  }

  if (abs < 100) {
    const fraction = (abs / KG_PER_TREE_YEAR).toFixed(1);
    return `= what ${fraction} trees absorb in a year`;
  }

  const trees = Math.round(abs / KG_PER_TREE_YEAR);
  return `= what ${trees} trees absorb in a year`;
}

/**
 * Get a full set of equivalent comparisons for a given CO₂ amount.
 */
export function getAllEquivalents(carbonKg: number): Equivalent[] {
  const abs = Math.abs(carbonKg);

  return [
    {
      label: 'Smartphone charges',
      value: Math.round(abs / KG_PER_SMARTPHONE_CHARGE),
      unit: 'charges',
      icon: '📱',
    },
    {
      label: 'Trees needed per year',
      value: parseFloat((abs / KG_PER_TREE_YEAR).toFixed(1)),
      unit: 'trees',
      icon: '🌳',
    },
    {
      label: 'Driving distance',
      value: Math.round(abs / KG_PER_KM_DRIVEN),
      unit: 'km',
      icon: '🚗',
    },
    {
      label: 'Streaming video',
      value: Math.round(abs / KG_PER_STREAMING_HOUR),
      unit: 'hours',
      icon: '📺',
    },
    {
      label: 'LED bulb hours',
      value: Math.round(abs / KG_PER_LED_HOUR),
      unit: 'hours',
      icon: '💡',
    },
    {
      label: 'Kettles boiled',
      value: Math.round(abs / KG_PER_KETTLE_BOIL),
      unit: 'kettles',
      icon: '☕',
    },
  ];
}

/**
 * Money saved estimate (USD) based on carbon reduction.
 * Rough correlation: reducing 1 kg CO₂ ≈ $0.05–$0.15 saved
 * (fuel, electricity, food costs avoided).
 */
export function estimateMoneySaved(carbonKgSaved: number): number {
  return Math.round(carbonKgSaved * 0.1 * 100) / 100;
}

/**
 * Fuel liters saved estimate.
 * ~2.31 kg CO₂ per liter of gasoline.
 */
export function estimateFuelSaved(carbonKgSaved: number): number {
  return Math.round((carbonKgSaved / 2.31) * 100) / 100;
}
