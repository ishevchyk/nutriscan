export function formatValue(value: number | null): string {
    return value == null ? '' : String(value);
}

export function formatMacro(value: number | null): string {
    return value == null ? '—' : value.toFixed(1);
}
