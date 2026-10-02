import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { BottomSheet } from './BottomSheet';

export type PickerOption<K extends string> = { key: K; label: string };

type PickerSheetProps<K extends string> = {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption<K>[];
  selected: K | null;
  onSelect: (key: K) => void;
};

export function PickerSheet<K extends string>({
  visible,
  onClose,
  title,
  options,
  selected,
  onSelect,
}: PickerSheetProps<K>) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} scrollable>
      {options.map((option) => (
        <Pressable
          key={option.key}
          style={styles.row}
          onPress={() => {
            onSelect(option.key);
            onClose();
          }}
        >
          <Text style={styles.rowLabel}>{option.label}</Text>
          {option.key === selected && <MaterialDesignIcons name="check" size={20} color={colors.primary} />}
        </Pressable>
      ))}
    </BottomSheet>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLabel: {
      fontSize: Typography.fontSize.base,
      color: colors.text,
    },
  });
}
