export function formatValue(value: number | null): string {
    return value == null ? '' : String(value);
}

/**
 * Cleans free-typed numeric input for a decimal field. Some iOS keyboard
 * locales render "," as the decimal key instead of ".", so both are
 * accepted here and normalized to ".".
 */
export function sanitizeDecimalInput(raw: string): string {
    const cleaned = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const firstDot = cleaned.indexOf('.');
    if (firstDot === -1) return cleaned;
    return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}

export function formatMacro(value: number | null, fixed?: number): string {
    return value == null ? '-' : value.toFixed(fixed ?? 1);
}

/** Rounds to 1 decimal place, dropping the decimal when it's a whole number (e.g. 150 not 150.0). */
export function formatAmount(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function daysUntilPurge(deletedAt: string, retentionDays: number): number {
    const deletedMs = new Date(deletedAt).getTime();
    const daysElapsed = Math.floor((Date.now() - deletedMs) / (24 * 60 * 60 * 1000));
    return Math.max(0, retentionDays - daysElapsed);
}
