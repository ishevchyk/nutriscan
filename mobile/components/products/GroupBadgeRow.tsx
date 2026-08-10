import {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Radii, Spacing, ThemeColors, Typography} from '../../constants/theme';
import {useThemeColor} from '../../hooks/useThemeColor';
import {Group} from '../../store/types';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';

type GroupBadgeRowProps = {
    groups: Group[];
};

export function GroupBadgeRow({groups}: GroupBadgeRowProps) {
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [maxVisible, setMaxVisible] = useState(2);
    if (groups.length === 0) {
        return null;
    }

    const isExpanded = maxVisible > 2;
    const visible = groups.slice(0, maxVisible);
    let remaining = groups.length - visible.length;

    const expandGroups = () => {
        setMaxVisible(groups.length);
    };

    const collapseGroups = () => {
        setMaxVisible(2);
    };

    return (
        <View style={styles.row}>
            {visible.map((group) => (
                <View key={group.id} style={styles.badge}>
                    <Text style={styles.badgeText} numberOfLines={2}>
                        {group.name}
                    </Text>
                </View>
            ))}
            {remaining > 0 && (
                <Pressable style={styles.badge} onPress={expandGroups}>
                    <Text style={styles.badgeText}>+{remaining}</Text>
                </Pressable>
            )}
            {isExpanded && (
                <Pressable style={styles.badge} onPress={collapseGroups}>
                    <MaterialDesignIcons name={"collapse-all-outline"} size={16} color={colors.primary}/>
                </Pressable>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs},
        badge: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radii.full,
            paddingVertical: 2,
            paddingHorizontal: Spacing.sm,
        },
        badgeText: {
            fontFamily: Typography.fontFamily.mono,
            fontSize: Typography.fontSize.xxs,
            color: colors.primary,
            textTransform: 'uppercase',
            letterSpacing: Typography.letterSpacing.label,
        },
    });
}
