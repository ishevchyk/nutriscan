import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { NewPortion, PortionPatch, MealPortion } from '../../store/mealStore';
import { SectionLabel, StatCard } from '../ui';
import {QuantityInput} from "./QuantityInput";
import {GRAM_ONLY_UNITS} from "../../constants/units";

type PortionListProps = {
  portions: MealPortion[];
  onAdd: (input: NewPortion) => void;
  onUpdate: (portionId: string, patch: PortionPatch) => void;
  onRemove: (portionId: string) => void;
};

export function PortionList({ portions, onAdd, onUpdate, onRemove }: PortionListProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <SectionLabel>Portions</SectionLabel>
      {portions.map((portion) => (
        <PortionRow key={portion.id} portion={portion} onUpdate={onUpdate} onRemove={onRemove} />
      ))}
      <AddPortionRow onAdd={onAdd} />
    </View>
  );
}

function PortionRow({
  portion,
  onUpdate,
  onRemove,
}: {
  portion: MealPortion;
  onUpdate: (portionId: string, patch: PortionPatch) => void;
  onRemove: (portionId: string) => void;
}) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState(portion.name);
  console.log(typeof portion.grams)
  const [grams, setGrams] = useState<number>(portion.grams);

  function commitName() {
    if (name.trim() && name.trim() !== portion.name) {
      onUpdate(portion.id, { name: name.trim() });
    }
  }

  function commitGrams() {
    if (grams != null && grams > 0 && grams !== portion.grams) {
      onUpdate(portion.id, { grams });
    }
  }

  return (
    <View style={styles.row}>
      <View style={styles.rowFields}>
        <TextInput style={styles.nameInput} value={name} onChangeText={setName} onBlur={commitName} />
        <QuantityInput amount={grams} unit="g" editable={true} allowedUnits={GRAM_ONLY_UNITS} />
        {/*<StatCard label="Grams" unit="g" value={grams} onChangeValue={setGrams} onBlur={commitGrams} size="sm" style={styles.gramsCard} />*/}
      </View>
      <View style={styles.rowActions}>
        <Pressable onPress={() => onUpdate(portion.id, { is_default: true })} disabled={portion.is_default}>
          <Text style={[styles.actionLink, portion.is_default && styles.actionLinkActive]}>
            {portion.is_default ? '★ Default' : 'Set default'}
          </Text>
        </Pressable>
        <Pressable onPress={() => onRemove(portion.id)}>
          <Text style={styles.actionLinkDanger}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AddPortionRow({ onAdd }: { onAdd: (input: NewPortion) => void }) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [grams, setGrams] = useState<number | null>(null);

  function handleAdd() {
    if (!name.trim() || !grams || grams <= 0) return;
    onAdd({ name: name.trim(), grams });
    setName('');
    setGrams(null);
  }

  return (
    <View style={styles.addRow}>
      <TextInput
        style={styles.nameInput}
        placeholder="New portion name..."
        placeholderTextColor={colors.placeholder}
        value={name}
        onChangeText={setName}
      />
      {/*<StatCard label="Grams" unit="g" value={grams} onChangeValue={setGrams} size="sm" style={styles.gramsCard} />*/}
      <QuantityInput amount={grams || 0} unit={"g"} editable={true} allowedUnits={GRAM_ONLY_UNITS} onAmountCommit={setGrams} />
      <Pressable
        style={[styles.addButton, (!name.trim() || !grams) && styles.addButtonDisabled]}
        onPress={handleAdd}
        disabled={!name.trim() || !grams}
      >
        <Text style={styles.addButtonText}>Add Portion</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { gap: Spacing.sm, marginTop: Spacing.lg },
    row: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    rowFields: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md },
    nameInput: {
      flex: 1,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      fontSize: Typography.fontSize.base,
      color: colors.text,
      paddingVertical: Spacing.xs,
    },
    gramsCard: { maxWidth: 120 },
    rowActions: { flexDirection: 'row', justifyContent: 'space-between' },
    actionLink: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
    actionLinkActive: { color: colors.textSecondary },
    actionLinkDanger: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.error,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    addButton: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      borderRadius: Radii.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    addButtonDisabled: { opacity: 0.5 },
    addButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.xs,
      fontWeight: Typography.fontWeight.semibold,
    },
  });
}
