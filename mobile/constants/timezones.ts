export interface CommonTimezone {
  city: string;
  ianaId: string;
}

// A representative set of recognizable cities, not an exhaustive IANA list --
// GMT offsets are computed at render time (see timezone.tsx) rather than
// stored here, so they stay correct across DST changes.
export const COMMON_TIMEZONES: CommonTimezone[] = [
  { city: 'Kyiv', ianaId: 'Europe/Kyiv' },
  { city: 'London', ianaId: 'Europe/London' },
  { city: 'Berlin', ianaId: 'Europe/Berlin' },
  { city: 'Paris', ianaId: 'Europe/Paris' },
  { city: 'Madrid', ianaId: 'Europe/Madrid' },
  { city: 'Rome', ianaId: 'Europe/Rome' },
  { city: 'Istanbul', ianaId: 'Europe/Istanbul' },
  { city: 'Moscow', ianaId: 'Europe/Moscow' },
  { city: 'Warsaw', ianaId: 'Europe/Warsaw' },
  { city: 'Dubai', ianaId: 'Asia/Dubai' },
  { city: 'Delhi', ianaId: 'Asia/Kolkata' },
  { city: 'Bangkok', ianaId: 'Asia/Bangkok' },
  { city: 'Singapore', ianaId: 'Asia/Singapore' },
  { city: 'Hong Kong', ianaId: 'Asia/Hong_Kong' },
  { city: 'Shanghai', ianaId: 'Asia/Shanghai' },
  { city: 'Tokyo', ianaId: 'Asia/Tokyo' },
  { city: 'Seoul', ianaId: 'Asia/Seoul' },
  { city: 'Sydney', ianaId: 'Australia/Sydney' },
  { city: 'Auckland', ianaId: 'Pacific/Auckland' },
  { city: 'Cairo', ianaId: 'Africa/Cairo' },
  { city: 'Johannesburg', ianaId: 'Africa/Johannesburg' },
  { city: 'Lagos', ianaId: 'Africa/Lagos' },
  { city: 'São Paulo', ianaId: 'America/Sao_Paulo' },
  { city: 'Mexico City', ianaId: 'America/Mexico_City' },
  { city: 'New York', ianaId: 'America/New_York' },
  { city: 'Chicago', ianaId: 'America/Chicago' },
  { city: 'Denver', ianaId: 'America/Denver' },
  { city: 'Los Angeles', ianaId: 'America/Los_Angeles' },
  { city: 'Anchorage', ianaId: 'America/Anchorage' },
  { city: 'Honolulu', ianaId: 'Pacific/Honolulu' },
];

// Hermes's Intl implementation doesn't reliably support
// `timeZoneName: 'shortOffset'` (silently degrades to a bare "GMT" with no
// offset on-device, even though it works in Node), and round-tripping
// through `toLocaleString` + `new Date(string)` is a known trap -- Date's
// string parsing is implementation-defined for non-ISO formats and returns
// NaN on Hermes for locale-formatted strings. Instead, read the target
// zone's wall-clock components via `formatToParts` (just basic numeric
// date/time formatting, reliably supported) and diff that against the
// instant's real UTC timestamp using Date.UTC, never parsing a string.
export function formatGmtOffset(ianaId: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaId,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(at);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
    let hour = Number(get('hour'));
    if (hour === 24) hour = 0; // some locales format midnight as "24"

    const zoneAsUtcMs = Date.UTC(
      Number(get('year')),
      Number(get('month')) - 1,
      Number(get('day')),
      hour,
      Number(get('minute')),
      Number(get('second'))
    );
    const diffMinutes = Math.round((zoneAsUtcMs - at.getTime()) / 60000);

    const sign = diffMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(diffMinutes);
    const hours = Math.floor(abs / 60);
    const minutes = abs % 60;
    return `GMT${sign}${hours}${minutes ? ':' + String(minutes).padStart(2, '0') : ''}`;
  } catch {
    return '';
  }
}
