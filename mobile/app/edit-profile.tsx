import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useProfileStore, ActivityLevel, Sex } from '../store/profileStore';
import { useSettingsStore } from '../store/settingsStore';
import { Avatar } from '../components/Avatar';
import { ACTIVITY_OPTIONS, SEX_OPTIONS, activityLabel, sexLabel } from '../constants/profileOptions';
import { PickerSheet, SectionLabel, SegmentedTabs, StatCard, StatGrid, UnderlineField } from '../components/ui';
import { cmToIn, inToCm, kgToLb, lbToKg, round1 } from '../utils/unitConversion';

function formatDate(iso: string | null): string {
  if (!iso) return 'Not set';
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

// Date-only strings must be parsed/formatted via local y/m/d components, not
// new Date(iso).toISOString() -- both round-trip through UTC and can shift
// the date by a day depending on the device's timezone offset.
function isoDateToLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function localDateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function EditProfileScreen() {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile, loaded, loadProfile, updateProfile } = useProfileStore();
  const { settings, updateSettings } = useSettingsStore();
  const units = settings?.units ?? 'metric';

  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [sex, setSex] = useState<Sex | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [heightText, setHeightText] = useState<number | null>(null);
  const [weightText, setWeightText] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSexPicker, setShowSexPicker] = useState(false);
  const [showActivityPicker, setShowActivityPicker] = useState(false);

  console.log('show', showDatePicker)

  useEffect(() => {
    if (!loaded) {
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setDateOfBirth(profile.date_of_birth);
      setSex(profile.sex);
      setActivityLevel(profile.activity_level);
      setHeightText(
        profile.height_cm != null ? (units === 'imperial' ? round1(cmToIn(profile.height_cm)) : profile.height_cm) : null
      );
      setWeightText(
        profile.weight_kg != null ? (units === 'imperial' ? round1(kgToLb(profile.weight_kg)) : profile.weight_kg) : null
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  function handleDateChange(_event: unknown, selectedDate?: Date) {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDateOfBirth(localDateToIso(selectedDate));
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const heightCm = heightText != null ? (units === 'imperial' ? inToCm(heightText) : heightText) : null;
      const weightKg = weightText != null ? (units === 'imperial' ? lbToKg(weightText) : weightText) : null;
      await updateProfile({
        display_name: displayName.trim() || null,
        date_of_birth: dateOfBirth,
        sex,
        activity_level: activityLevel,
        height_cm: heightCm,
        weight_kg: weightKg,
      });
      router.back();
    } catch {
      setSaveError('Failed to save profile. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.avatarRow}>
        <Avatar displayName={displayName} email={profile?.email} size={72} />
      </View>

      <SegmentedTabs
        tabs={[
          { key: 'metric', label: 'Metric' },
          { key: 'imperial', label: 'Imperial' },
        ]}
        active={units}
        onChange={(next) => updateSettings({ units: next })}
        style={styles.unitsToggle}
      />

      <SectionLabel style={styles.sectionLabel}>About you</SectionLabel>

      <UnderlineField label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Your name" />

      <Pressable onPress={() => setShowDatePicker(true)}>
        <UnderlineField label="Date of birth" value={formatDate(dateOfBirth)} editable={false} />
      </Pressable>
      {showDatePicker && (
        <DateTimePicker
          value={dateOfBirth ? isoDateToLocalDate(dateOfBirth) : new Date(1990, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      <Pressable onPress={() => setShowSexPicker(true)}>
        <UnderlineField label="Sex" value={sexLabel(sex)} editable={false} />
      </Pressable>
      <PickerSheet
        visible={showSexPicker}
        onClose={() => setShowSexPicker(false)}
        title="Sex"
        options={SEX_OPTIONS}
        selected={sex}
        onSelect={setSex}
      />

      <Pressable onPress={() => setShowActivityPicker(true)}>
        <UnderlineField label="Activity level" value={activityLabel(activityLevel)} editable={false} />
      </Pressable>
      <PickerSheet
        visible={showActivityPicker}
        onClose={() => setShowActivityPicker(false)}
        title="Activity level"
        options={ACTIVITY_OPTIONS}
        selected={activityLevel}
        onSelect={setActivityLevel}
      />

      <SectionLabel style={styles.sectionLabel}>Current measurements</SectionLabel>
      <StatGrid columns={2}>
        <StatCard
          label="Height"
          unit={units === 'imperial' ? 'in' : 'cm'}
          value={heightText}
          onChangeValue={setHeightText}
        />
        <StatCard
          label="Current weight"
          unit={units === 'imperial' ? 'lb' : 'kg'}
          value={weightText}
          onChangeValue={setWeightText}
        />
      </StatGrid>
      <Text style={styles.measurementHint}>Only your current weight is kept. All fields are optional.</Text>

      {saveError && <Text style={styles.errorText}>{saveError}</Text>}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.saveButtonText}>Save profile</Text>}
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: Spacing.xl },
    avatarRow: { alignItems: 'center', marginBottom: Spacing.xl },
    unitsToggle: { alignSelf: 'center', width: 200, marginBottom: Spacing.xl },
    sectionLabel: { marginTop: Spacing.lg, marginBottom: Spacing.md },
    measurementHint: {
      fontSize: Typography.fontSize.sm,
      color: colors.textSecondary,
      marginTop: Spacing.sm,
    },
    errorText: {
      color: colors.error,
      fontSize: Typography.fontSize.sm,
      marginTop: Spacing.lg,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      marginTop: Spacing.xl,
    },
    saveButtonDisabled: { opacity: 0.6 },
    saveButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
  });
}
