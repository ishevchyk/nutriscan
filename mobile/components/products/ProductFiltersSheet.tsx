import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { Product } from '../../store/productStore';
import { Group } from '../../store/types';
import { ProductFilterState } from '../../store/productFilterStore';
import {
  caloriesSliderMax,
  countActiveFilters,
  getBrandOptions,
  NUTRITION_PRESETS,
} from '../../utils/productFilters';
import { GroupChip } from '../groups/GroupChip';
import { Slider } from '../ui/Slider';
import { ProductSheetShell } from './ProductSheetShell';

type ProductFiltersSheetProps = {
  visible: boolean;
  filterState: ProductFilterState;
  onClose: () => void;
  /** The whole library -- brand options and the kcal range come from it, not from the filtered list. */
  products: Product[];
  /** Groups the user can see (hidden system groups already excluded). */
  groups: Group[];
  resultCount: number;
  onManageGroups: () => void;
};

const CALORIE_STEP = 10;

export function ProductFiltersSheet({
  visible,
  filterState,
  onClose,
  products,
  groups,
  resultCount,
  onManageGroups,
}: ProductFiltersSheetProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    filters,
    toggleGroup,
    toggleBrand,
    clearBrands,
    toggleNutrition,
    setMaxCalories,
    resetFilters,
  } = filterState;
  const [brandQuery, setBrandQuery] = useState('');

  const brandOptions = useMemo(() => getBrandOptions(products), [products]);
  const visibleBrands = useMemo(() => {
    const q = brandQuery.trim().toLocaleLowerCase();
    return q ? brandOptions.filter((b) => b.label.toLocaleLowerCase().includes(q)) : brandOptions;
  }, [brandOptions, brandQuery]);
  const sliderMax = useMemo(() => caloriesSliderMax(products), [products]);
  const sliderValue = filters.maxCalories ?? sliderMax;

  function handleReset() {
    resetFilters();
    setBrandQuery('');
  }

  return (
    <ProductSheetShell
      visible={visible}
      onClose={onClose}
      title="Filters"
      onReset={handleReset}
      resetDisabled={countActiveFilters(filters) === 0}
      resultCount={resultCount}
    >
      <View style={styles.section}>
        <SectionHeader
          label="Groups · match any"
          action={{ label: 'Manage', onPress: onManageGroups }}
          styles={styles}
        />
        {groups.length === 0 ? (
          <Text style={styles.empty}>No groups yet.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={styles.chipScroll}
          >
            {groups.map((g) => (
              <GroupChip
                key={g.id}
                label={g.name}
                selected={filters.groupIds.includes(g.id)}
                onPress={() => toggleGroup(g.id)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          label="Brand"
          action={
            filters.brands.length > 0
              ? { label: `Clear (${filters.brands.length})`, onPress: clearBrands }
              : { label: 'Any' }
          }
          styles={styles}
        />
        {brandOptions.length === 0 ? (
          <Text style={styles.empty}>No brands in your library yet.</Text>
        ) : (
          <>
            <TextInput
              placeholder="Search brands..."
              placeholderTextColor={colors.placeholder}
              style={styles.searchInput}
              value={brandQuery}
              onChangeText={setBrandQuery}
              autoCorrect={false}
            />
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.listCard}>
              {visibleBrands.length === 0 ? (
                <Text style={[styles.empty, styles.listEmpty]}>No brands match “{brandQuery.trim()}”.</Text>
              ) : (
                visibleBrands.map((brand, index) => {
                  const checked = filters.brands.includes(brand.key);
                  return (
                    <Pressable
                      key={brand.key}
                      style={[styles.brandRow, index > 0 && styles.brandRowDivider]}
                      onPress={() => toggleBrand(brand.key)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked && <MaterialDesignIcons name="check" size={14} color={colors.onPrimary} />}
                      </View>
                      <Text style={styles.brandLabel} numberOfLines={1}>
                        {brand.label}
                      </Text>
                      <Text style={styles.count}>{brand.count}</Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader label="Nutrition (per 100g)" styles={styles} />
        <View style={styles.tileGrid}>
          {NUTRITION_PRESETS.map((preset) => {
            const selected = filters.nutrition.includes(preset.key);
            return (
              <Pressable
                key={preset.key}
                style={[styles.tile, selected && styles.tileSelected]}
                onPress={() => toggleNutrition(preset.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Text style={[styles.tileTitle, selected && styles.tileTitleSelected]}>{preset.label}</Text>
                <Text style={styles.tileHint}>{preset.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sliderCard}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sectionLabel}>Max calories</Text>
            <Text style={styles.sliderValue}>
              {filters.maxCalories != null && `≤ ${filters.maxCalories} KCAL`}
            </Text>
          </View>
          <Slider
            min={0}
            max={sliderMax}
            step={CALORIE_STEP}
            value={sliderValue}
            onChange={(v) => setMaxCalories(v >= sliderMax ? null : v)}
            accessibilityLabel="Maximum calories per 100 grams"
          />
          <View style={styles.sliderScale}>
            <Text style={styles.count}>0</Text>
            <Text style={styles.count}>{sliderMax}</Text>
          </View>
        </View>
      </View>
    </ProductSheetShell>
  );
}

type Styles = ReturnType<typeof createStyles>;

function SectionHeader({
  label,
  action,
  styles,
}: {
  label: string;
  action?: { label: string; onPress?: () => void };
  styles: Styles;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {action ? (
        action.onPress ? (
          <Pressable onPress={action.onPress} hitSlop={8}>
            <Text style={styles.sectionAction}>{action.label}</Text>
          </Pressable>
        ) : (
          <Text style={styles.sectionAction}>{action.label}</Text>
        )
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  const label = {
    fontFamily: Typography.fontFamily.mono,
    fontSize: Typography.fontSize.xxs,
    textTransform: 'uppercase' as const,
    letterSpacing: Typography.letterSpacing.label,
  };
  return StyleSheet.create({
    section: { gap: Spacing.sm, marginTop: Spacing.lg },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionLabel: { ...label, color: colors.textSecondary },
    sectionAction: { ...label, color: colors.primary },
    empty: { color: colors.textSecondary, fontSize: Typography.fontSize.sm },
    chipScroll: { marginHorizontal: -Spacing.xl },
    chipRow: { gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xs },
    searchInput: {
      height: 40,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: Radii.md,
      paddingHorizontal: 10,
      backgroundColor: colors.surface,
      color: colors.text,
    },
    listCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      overflow: 'hidden',
      height: 40 * 8,
    },
    listEmpty: { padding: Spacing.lg },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      height: 40,
    },
    brandRowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    brandLabel: { flex: 1, fontSize: Typography.fontSize.base, color: colors.text },
    count: { ...label, color: colors.textTertiary },
    tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    tile: {
      flexBasis: '48%',
      flexGrow: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      gap: Spacing.xs,
    },
    tileSelected: { borderColor: colors.primary, backgroundColor: colors.surface },
    tileTitle: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.text,
    },
    tileTitleSelected: { color: colors.primary },
    tileHint: { fontFamily: Typography.fontFamily.mono, fontSize: Typography.fontSize.xxs, color: colors.textTertiary },
    sliderCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      marginTop: Spacing.xs,
      gap: Spacing.xs,
    },
    sliderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sliderValue: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: Typography.fontSize.base,
      color: colors.text,
    },
    sliderScale: { flexDirection: 'row', justifyContent: 'space-between' },
  });
}
