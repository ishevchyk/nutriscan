import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { Spacing } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { Group } from '../../store/types';
import { GroupChip } from './GroupChip';

type GroupFilterChipsProps = {
  groups: Group[];
  loaded: boolean;
  activeGroupFilter: string | null;
  onSelect: (groupId: string | null) => void;
};

export function GroupFilterChips({ groups, loaded, activeGroupFilter, onSelect }: GroupFilterChipsProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(), []);

  if (!loaded) {
    return <ActivityIndicator size="small" color={colors.primary} style={styles.loading} />;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      <GroupChip label="All Products" selected={activeGroupFilter === null} onPress={() => onSelect(null)} />
      {groups.map((group) => (
        <GroupChip
          key={group.id}
          label={group.name}
          selected={activeGroupFilter === group.id}
          onPress={() => onSelect(group.id)}
        />
      ))}
    </ScrollView>
  );
}

function createStyles() {
  return StyleSheet.create({
    scroll: { flexGrow: 0 },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
    loading: { marginVertical: Spacing.md },
  });
}
