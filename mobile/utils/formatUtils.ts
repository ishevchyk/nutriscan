export function formatValue(value: number | null): string {
    return value == null ? '' : String(value);
}

export function formatMacro(value: number | null): string {
    return value == null ? '—' : value.toFixed(1);
}

export function daysUntilPurge(deletedAt: string, retentionDays: number): number {
    const deletedMs = new Date(deletedAt).getTime();
    const daysElapsed = Math.floor((Date.now() - deletedMs) / (24 * 60 * 60 * 1000));
    return Math.max(0, retentionDays - daysElapsed);
}
