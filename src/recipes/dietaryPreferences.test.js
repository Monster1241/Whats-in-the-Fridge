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
    expect(normalizeDietaryPreference('no beef')).toBe('no_beef');
    expect(normalizeDietaryPreference('gluten-free')).toBe('gluten_free');
    expect(normalizeDietaryPreference('dairy free')).toBe('dairy_free');
    expect(normalizeDietaryPreference('nut free')).toBe('nut_free');
    expect(normalizeDietaryPreference('pescatarian')).toBe('pescatarian');
    expect(normalizeDietaryPreference('paleo')).toBe('none');
    expect(normalizeDietaryPreference(null)).toBe('none');
  });

  it('builds prompt instructions for active diets', () => {
    expect(buildDietaryPromptInstructions('none')).toBe('');
    expect(buildDietaryPromptInstructions('gluten_free')).toMatch(/GLUTEN FREE/i);
    expect(buildDietaryPromptInstructions('dairy_free')).toMatch(/DAIRY FREE/i);
    expect(buildDietaryPromptInstructions('nut_free')).toMatch(/NUT FREE/i);
    expect(buildDietaryPromptInstructions('no_beef')).toMatch(/NO BEEF/i);
    expect(buildDietaryPromptInstructions('pescatarian')).toMatch(/PESCATARIAN/i);
    expect(buildDietaryPromptInstructions('vegetarian')).toMatch(/VEGETARIAN/i);
    expect(buildDietaryPromptInstructions('vegan')).toMatch(/VEGAN/i);
  });

  it('labels active diet mode for UI', () => {
    expect(getDietaryPreferenceModeLabel('gluten_free')).toBe('Gluten free mode');
    expect(getDietaryPreferenceModeLabel('dairy_free')).toBe('Dairy free mode');
    expect(getDietaryPreferenceModeLabel('nut_free')).toBe('Nut free mode');
    expect(getDietaryPreferenceModeLabel('no_beef')).toBe('No beef mode');
    expect(getDietaryPreferenceModeLabel('pescatarian')).toBe('Pescatarian mode');
    expect(getDietaryPreferenceModeLabel('vegetarian')).toBe('Vegetarian mode');
    expect(getDietaryPreferenceModeLabel('vegan')).toBe('Vegan mode');
    expect(getDietaryPreferenceModeLabel('none')).toBe('');
  });

  it('adjusts higher-protein remix for plant-based diets', () => {
    expect(getRemixModeInstruction('higher_protein', 'vegan')).toMatch(/tofu/i);
    expect(getRemixModeInstruction('higher_protein', 'vegetarian')).toMatch(/Do not add meat/i);
    expect(getRemixModeInstruction('higher_protein', 'pescatarian')).toMatch(/fish/i);
    expect(getRemixModeInstruction('higher_protein', 'no_beef')).toMatch(/Do not use beef/i);
    expect(getRemixModeInstruction('higher_protein', 'gluten_free')).toMatch(/gluten free/i);
    expect(getRemixModeInstruction('higher_protein', 'none')).toMatch(/lean meat/i);
  });
});
