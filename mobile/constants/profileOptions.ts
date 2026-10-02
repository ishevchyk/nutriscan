import { ActivityLevel, Sex } from '../store/profileStore';

export const SEX_OPTIONS: { key: Sex; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const ACTIVITY_OPTIONS: { key: ActivityLevel; label: string }[] = [
  { key: 'sedentary', label: 'Sedentary' },
  { key: 'light', label: 'Light' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'active', label: 'Active' },
  { key: 'very_active', label: 'Very active' },
];

export function sexLabel(sex: Sex | null): string {
  return SEX_OPTIONS.find((o) => o.key === sex)?.label ?? 'Not set';
}

export function activityLabel(level: ActivityLevel | null): string {
  return ACTIVITY_OPTIONS.find((o) => o.key === level)?.label ?? 'Not set';
}
