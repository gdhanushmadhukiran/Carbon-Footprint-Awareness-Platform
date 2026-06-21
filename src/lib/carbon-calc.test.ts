// ============================================================================
// EcoTrack AI — Carbon Calculation Unit Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateTransportEmission,
  calculateFoodEmission,
  calculateEnergyEmission,
  calculateShoppingEmission,
  calculateWasteEmission,
  calculateBaselineFootprint,
  calculateCarbonRiskScore,
  getSustainabilityRating,
  getCategoryBreakdown,
  projectAnnualEmissions,
  calculateEcoBaseline,
  getSustainabilityProfile,
} from './carbon-calc';
import type { ActivityLog } from '../types';

describe('Transport Emissions', () => {
  it('calculates gasoline car emissions correctly', () => {
    const result = calculateTransportEmission('car_gasoline', 10);
    expect(result).toBe(2.1); // 0.21 * 10
  });

  it('calculates zero emissions for bicycle', () => {
    expect(calculateTransportEmission('bicycle', 50)).toBe(0);
  });

  it('calculates zero emissions for walking', () => {
    expect(calculateTransportEmission('walking', 5)).toBe(0);
  });

  it('divides car emissions among passengers', () => {
    const solo = calculateTransportEmission('car_gasoline', 10, 1);
    const shared = calculateTransportEmission('car_gasoline', 10, 2);
    expect(shared).toBe(solo / 2);
  });

  it('handles diesel car correctly', () => {
    const result = calculateTransportEmission('car_diesel', 100);
    expect(result).toBe(27); // 0.27 * 100
  });

  it('handles electric car correctly', () => {
    const result = calculateTransportEmission('car_electric', 100);
    expect(result).toBe(5); // 0.05 * 100
  });

  it('handles domestic flight', () => {
    const result = calculateTransportEmission('flight_domestic', 500);
    expect(result).toBe(127.5); // 0.255 * 500
  });
});

describe('Food Emissions', () => {
  it('calculates omnivore meal correctly', () => {
    const result = calculateFoodEmission('omnivore', 'lunch');
    expect(result).toBe(2.5); // 2.5 * 1.0
  });

  it('applies meal multipliers', () => {
    const breakfast = calculateFoodEmission('omnivore', 'breakfast');
    const dinner = calculateFoodEmission('omnivore', 'dinner');
    expect(breakfast).toBeLessThan(dinner);
    expect(breakfast).toBe(1.5); // 2.5 * 0.6
    expect(dinner).toBe(3.25); // 2.5 * 1.3
  });

  it('vegan is lower than omnivore', () => {
    const vegan = calculateFoodEmission('vegan', 'lunch');
    const omni = calculateFoodEmission('omnivore', 'lunch');
    expect(vegan).toBeLessThan(omni);
  });

  it('organic food reduces emissions', () => {
    const regular = calculateFoodEmission('omnivore', 'lunch', false);
    const organic = calculateFoodEmission('omnivore', 'lunch', true);
    expect(organic).toBeLessThan(regular);
  });
});

describe('Energy Emissions', () => {
  it('calculates electricity emissions with default grid', () => {
    const result = calculateEnergyEmission('electricity', 100, 'grid_default', 'north_america', 1);
    expect(result).toBe(41.7); // 0.417 * 100
  });

  it('renewable energy has much lower emissions', () => {
    const grid = calculateEnergyEmission('electricity', 100, 'grid_default', 'north_america', 1);
    const renewable = calculateEnergyEmission('electricity', 100, 'renewable', 'north_america', 1);
    expect(renewable).toBeLessThan(grid);
    expect(renewable).toBe(2); // 0.02 * 100
  });

  it('divides by household size', () => {
    const single = calculateEnergyEmission('electricity', 100, 'grid_default', 'north_america', 1);
    const family = calculateEnergyEmission('electricity', 100, 'grid_default', 'north_america', 4);
    expect(family).toBeCloseTo(single / 4, 1);
  });

  it('calculates natural gas emissions', () => {
    const result = calculateEnergyEmission('natural_gas', 10, 'grid_default', 'north_america', 1);
    expect(result).toBe(20); // 2.0 * 10
  });
});

describe('Shopping Emissions', () => {
  it('calculates clothing emissions', () => {
    expect(calculateShoppingEmission('clothing', 1)).toBe(10);
  });

  it('calculates electronics emissions', () => {
    expect(calculateShoppingEmission('electronics', 1)).toBe(50);
  });

  it('secondhand reduces emissions by 80%', () => {
    const newItem = calculateShoppingEmission('clothing', 1, false);
    const secondhand = calculateShoppingEmission('clothing', 1, true);
    expect(secondhand).toBe(2); // 10 * 0.2
    expect(secondhand).toBe(newItem * 0.2);
  });

  it('scales with quantity', () => {
    const one = calculateShoppingEmission('clothing', 1);
    const three = calculateShoppingEmission('clothing', 3);
    expect(three).toBe(one * 3);
  });
});

describe('Waste Emissions', () => {
  it('calculates general waste emissions', () => {
    expect(calculateWasteEmission('general', 1)).toBe(0.58);
  });

  it('recycling gives negative (saved) emissions', () => {
    const result = calculateWasteEmission('recycling', 1);
    expect(result).toBeLessThan(0);
    expect(result).toBe(-0.18);
  });

  it('composting gives negative emissions', () => {
    const result = calculateWasteEmission('compost', 1);
    expect(result).toBeLessThan(0);
  });

  it('electronic waste is higher impact', () => {
    const general = calculateWasteEmission('general', 1);
    const electronic = calculateWasteEmission('electronic', 1);
    expect(electronic).toBeGreaterThan(general);
  });
});

describe('Baseline Footprint', () => {
  it('calculates a positive baseline', () => {
    const result = calculateBaselineFootprint({
      region: 'north_america',
      diet: 'omnivore',
      primaryTransport: 'car_gasoline',
      householdSize: 2,
      energySource: 'grid_default',
    });
    expect(result).toBeGreaterThan(0);
  });

  it('vegetarian with bike has lower footprint than omnivore with car', () => {
    const high = calculateBaselineFootprint({
      region: 'north_america', diet: 'omnivore', primaryTransport: 'car_gasoline',
      householdSize: 1, energySource: 'grid_default',
    });
    const low = calculateBaselineFootprint({
      region: 'north_america', diet: 'vegan', primaryTransport: 'bicycle',
      householdSize: 1, energySource: 'renewable',
    });
    expect(low).toBeLessThan(high);
  });
});

describe('Carbon Risk Score', () => {
  it('returns 0 for sustainable level (2000 kg)', () => {
    expect(calculateCarbonRiskScore(2000)).toBe(0);
  });

  it('returns higher score for higher emissions', () => {
    const lowRisk = calculateCarbonRiskScore(5000);
    const highRisk = calculateCarbonRiskScore(20000);
    expect(highRisk).toBeGreaterThan(lowRisk);
  });

  it('caps at 100', () => {
    expect(calculateCarbonRiskScore(1000000)).toBe(100);
  });
});

describe('Sustainability Rating', () => {
  it('returns A for very low emissions', () => {
    expect(getSustainabilityRating(0.1, 'transport')).toBe('A');
  });

  it('returns F for very high emissions', () => {
    expect(getSustainabilityRating(100, 'transport')).toBe('F');
  });
});

describe('Category Breakdown', () => {
  it('returns correct totals', () => {
    const logs: ActivityLog[] = [
      { id: '1', category: 'transport', timestamp: '', carbonKg: 5, details: {} as any, equivalentComparison: '', sustainabilityRating: 'C' },
      { id: '2', category: 'transport', timestamp: '', carbonKg: 3, details: {} as any, equivalentComparison: '', sustainabilityRating: 'C' },
      { id: '3', category: 'food', timestamp: '', carbonKg: 2, details: {} as any, equivalentComparison: '', sustainabilityRating: 'B' },
    ];
    const breakdown = getCategoryBreakdown(logs);
    expect(breakdown.transport).toBe(8);
    expect(breakdown.food).toBe(2);
    expect(breakdown.energy).toBe(0);
  });
});

describe('Annual Projection', () => {
  it('extrapolates correctly from 7 days of data', () => {
    const logs: ActivityLog[] = [
      { id: '1', category: 'transport', timestamp: '', carbonKg: 10, details: {} as any, equivalentComparison: '', sustainabilityRating: 'C' },
    ];
    const result = projectAnnualEmissions(logs, 7);
    expect(result).toBe(Math.round((10 / 7) * 365)); // ~521
  });

  it('returns 0 for no data', () => {
    expect(projectAnnualEmissions([], 0)).toBe(0);
  });
});

describe('Eco Baseline', () => {
  it('is lower than average', () => {
    const eco = calculateEcoBaseline('north_america');
    expect(eco).toBeLessThan(17600); // NA average
    expect(eco).toBeGreaterThan(0);
  });
});

describe('Sustainability Profile', () => {
  it('returns Climate Champion for very low footprint', () => {
    expect(getSustainabilityProfile(1000, 'north_america')).toBe('Climate Champion');
  });

  it('returns High Impact for very high footprint', () => {
    expect(getSustainabilityProfile(30000, 'north_america')).toBe('High Impact');
  });
});
