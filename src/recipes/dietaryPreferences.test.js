import { describe, expect, it } from 'vitest';
import {
  buildDietaryPromptInstructions,
  getDietaryPreferenceModeLabel,
  getRemixModeInstruction,
  normalizeDietaryPreference,
} from './dietaryPreferences.js';

describe('dietaryPreferences', () => {
  it('normalizes preference values', () => {
    expect(normalizeDietaryPreference('vegan')).toBe('vegan');
    expect(normalizeDietaryPreference(' Vegetarian ')).toBe('vegetarian');
    expect(normalizeDietaryPreference('paleo')).toBe('none');
    expect(normalizeDietaryPreference(null)).toBe('none');
  });

  it('builds prompt instructions for active diets', () => {
    expect(buildDietaryPromptInstructions('none')).toBe('');
    expect(buildDietaryPromptInstructions('vegetarian')).toMatch(/VEGETARIAN/i);
    expect(buildDietaryPromptInstructions('vegan')).toMatch(/VEGAN/i);
  });

  it('labels active diet mode for UI', () => {
    expect(getDietaryPreferenceModeLabel('vegetarian')).toBe('Vegetarian mode');
    expect(getDietaryPreferenceModeLabel('vegan')).toBe('Vegan mode');
    expect(getDietaryPreferenceModeLabel('none')).toBe('');
  });

  it('adjusts higher-protein remix for plant-based diets', () => {
    expect(getRemixModeInstruction('higher_protein', 'vegan')).toMatch(/tofu/i);
    expect(getRemixModeInstruction('higher_protein', 'vegetarian')).toMatch(/Do not add meat/i);
    expect(getRemixModeInstruction('higher_protein', 'none')).toMatch(/lean meat/i);
  });
});
