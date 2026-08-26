import { ReactNode, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: string;
  headerRight?: ReactNode;
  scrollable?: boolean;
  children: ReactNode;
};

export function BottomSheet({ visible, onClose, title, subtitle, headerRight, scrollable, children }: BottomSheetProps) {
  const colors = useThemeColor();
  const insets = useSafeAreaInsets();
  // Modal content renders full-screen behind the home indicator, so the
  // sheet's own padding has to clear it explicitly -- a fixed Spacing value
  // isn't enough on its own and clips whatever sits at the bottom of a
  // non-scrollable sheet (no scroll gesture to reveal it). RN's Modal
  // presents in a separate native root, where useSafeAreaInsets() has been
  // known to under-report (0 or a stale value) rather than the host
  // screen's real inset -- floor it at a realistic home-indicator height
  // (34pt covers every current iPhone) so the padding never collapses.
  const bottomInset = Math.max(insets.bottom, 34);
  const styles = useMemo(() => createStyles(colors, bottomInset), [colors, bottomInset]);

  const header =
    title != null || subtitle != null || headerRight !== null ? (
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {typeof title === 'string' ? <Text style={styles.title}>{title}</Text> : title}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {headerRight !== undefined ? (
          headerRight
        ) : (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        )}
      </View>
    ) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.avoider}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            {header}
            {scrollable ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={styles.content}>{children}</View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors, bottomInset: number) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    avoider: {
      maxHeight: '88%',
    },
    sheet: {
      flexShrink: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      paddingHorizontal: Spacing.xl,
      paddingBottom: bottomInset + Spacing.lg,
      maxHeight: '100%',
    },
    handle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      borderRadius: Radii.full,
      backgroundColor: colors.border,
      marginTop: Spacing.md,
      marginBottom: Spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
    },
    headerLeft: { flex: 1, gap: Spacing.xs },
    title: {
      fontSize: Typography.fontSize.lg,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text,
    },
    subtitle: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    closeText: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
      paddingTop: Spacing.xs,
    },
    scrollContent: { paddingBottom: bottomInset + Spacing.md },
    content: {},
  });
}
