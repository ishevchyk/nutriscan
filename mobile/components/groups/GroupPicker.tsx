import { StyleSheet, View } from 'react-native';

import { Spacing } from '../../constants/theme';
import { Group } from '../../store/types';
import { GroupChip } from './GroupChip';

type GroupPickerProps = {
  groups: Group[];
  selectedIds: string[];
  onToggle: (groupId: string) => void;
};

export function GroupPicker({ groups, selectedIds, onToggle }: GroupPickerProps) {
  return (
    <View style={styles.wrap}>
      {groups.map((group) => (
        <GroupChip
          key={group.id}
          label={group.name}
          selected={selectedIds.includes(group.id)}
          onPress={() => onToggle(group.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
