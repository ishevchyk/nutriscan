import { Children, ReactNode, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Spacing } from '../../constants/theme';

type StatGridProps = {
  columns: 2 | 3;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function StatGrid({ columns, children, style }: StatGridProps) {
  const styles = useMemo(() => createStyles(), []);
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }

  return (
    <View style={[styles.grid, style]}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((item, itemIndex) => (
            <View key={itemIndex} style={styles.cell}>
              {item}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    grid: {
      gap: Spacing.md,
    },
    row: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    cell: {
      flex: 1,
    },
  });
}
