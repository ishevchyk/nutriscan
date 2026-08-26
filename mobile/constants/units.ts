export const GRAM_UNIT = 'g';

export const HOUSEHOLD_UNITS = ['tbsp', 'tsp', 'cup', 'piece'] as const;

export const ALL_UNITS = [GRAM_UNIT, ...HOUSEHOLD_UNITS];

/** Unlinked ingredients have no product to key a saved conversion off of, so
 * the picker only ever offers grams for them (per backend design). */
export const GRAM_ONLY_UNITS = [GRAM_UNIT];
