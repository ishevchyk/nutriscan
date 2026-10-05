import { useState } from 'react';

import { ProductPortion } from '../store/productStore';
import { formatAmount } from '../utils/formatUtils';

export const BASIS_PER_100G = '100';
export const BASIS_NEW_PORTION = 'new';

export type NewPortionDraft = { name: string; grams: number };

export type NutritionBasis = {
    /** '100', a saved portion's id, or 'new' (typing a portion off the pack). */
    view: string;
    setView: (view: string) => void;
    draftName: string;
    setDraftName: (name: string) => void;
    draftGrams: number | null;
    setDraftGrams: (grams: number | null) => void;
    /** Grams the typed values refer to; null while a new portion has no weight yet. */
    grams: number | null;
    /** Multiplier from per-100g storage to what's shown/typed (grams / 100). */
    factor: number | null;
    /** Set when the user typed values for a not-yet-saved portion. */
    newPortion: NewPortionDraft | null;
};

/**
 * Which amount the product form's nutrition values are shown and typed in.
 * Storage is always per 100g -- in a portion view the form converts on the
 * way in and out (see ProductNutritionSections) so a pack's "per 1 ice cream
 * (65 g)" values can be entered as printed. Always starts on per-100g.
 */
export function useNutritionBasis(portions: ProductPortion[]): NutritionBasis {
    const [view, setView] = useState(BASIS_PER_100G);
    const [draftName, setDraftName] = useState('');
    const [draftGrams, setDraftGrams] = useState<number | null>(null);

    const saved = portions.find((p) => p.id === view);
    // A deleted portion's id falls back to per-100g.
    const effective = view === BASIS_NEW_PORTION || saved ? view : BASIS_PER_100G;
    const grams = effective === BASIS_NEW_PORTION ? draftGrams : (saved?.grams ?? 100);
    const valid = grams != null && grams > 0;

    const newPortion: NewPortionDraft | null =
        effective === BASIS_NEW_PORTION && valid
            ? { name: draftName.trim() || `${formatAmount(grams)}g`, grams }
            : null;

    return {
        view: effective,
        setView,
        draftName,
        setDraftName,
        draftGrams,
        setDraftGrams,
        grams: valid ? grams : null,
        factor: valid ? grams / 100 : null,
        newPortion,
    };
}

/** Round to 4 decimals so per-portion -> per-100g -> per-portion round-trips
 * back to what was typed (display rounds to 2, well inside the error). */
const round = (v: number, decimals: number) => {
    const m = 10 ** decimals;
    return Math.round(v * m) / m;
};

export const toDisplay = (stored: number | null, factor: number): number | null =>
    stored == null ? null : round(stored * factor, 2);

export const toStored = (typed: number | null, factor: number): number | null =>
    typed == null ? null : round(typed / factor, 4);
