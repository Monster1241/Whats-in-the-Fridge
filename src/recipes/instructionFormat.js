/**
 * Ensure AI / imported instructions render as numbered steps in the UI.
 * @param {unknown[]} instructions
 * @returns {string[]}
 */
export function ensureNumberedInstructions(instructions) {
  if (!Array.isArray(instructions)) return [];

  return instructions
    .map((step) => String(step ?? '').trim())
    .filter(Boolean)
    .map((step, index) => {
      if (/^\d+[\).\s]/.test(step)) return step;
      return `${index + 1}. ${step}`;
    });
}
