// components/ScreenHeader.tsx
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import {Spacing} from "../../constants/Spacing";
import {Typography} from "../../constants/Typography";
import {useThemeColor} from "../../hooks/useThemeColor";
import {useMemo} from "react";
import {ThemeColors} from "../../constants/Colors";


type HeaderAction = {
    label: string;
    onPress: () => void;
};

type ScreenHeaderProps = {
    headerTitle: string;
    leftAction?: HeaderAction;
    rightAction?: HeaderAction;
};

export function ScreenHeader({headerTitle, leftAction, rightAction}: ScreenHeaderProps) {
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();

    const renderAction = (action?: HeaderAction) =>
        action ? (
            <Pressable onPress={action.onPress} hitSlop={8}>
                <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
        ) : (
            <View style={styles.actionPlaceholder} />
        );

    return (
        <View style={[styles.container, {paddingTop: insets.top + 8}]}>
                <View style={styles.header}>
                    {renderAction(leftAction)}
                    <Text style={styles.title}>{headerTitle}</Text>
                    {renderAction(rightAction)}
                </View>
        </View>
    );
}

export const backAction = (label: string): HeaderAction => ({
    label: `← ${label.toUpperCase()}`,
    onPress: () => router.back(),
});

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            backgroundColor: '#fff',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Spacing.xl,
            paddingBottom: Spacing.lg,
        },
        title: {
            flex: 1,
            fontSize: Typography.fontSize.xl,
            fontWeight: Typography.fontWeight.semibold,
            color: colors.text,
            textAlign: 'left',
        },
        actionLabel: {
            fontFamily: Typography.fontFamily.mono,
            fontSize: Typography.fontSize.base,
            fontWeight: Typography.fontWeight.bold,
            color: colors.primary,
            textTransform: 'uppercase',
            letterSpacing: Typography.letterSpacing.label,
        },
        actionPlaceholder: { width: 1 },
    })
}