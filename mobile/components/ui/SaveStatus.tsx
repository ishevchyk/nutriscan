import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { Typography } from '../../constants/theme';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColor } from '../../hooks/useThemeColor';
import { SaveStatus as Status } from '../../hooks/useSaveQueue';

type Props = { status: Status; onRetry: () => void };

/** Header autosave indicator: Saving… -> ✓ Saved (fades out) / Couldn't save · Retry. */
export function SaveStatusLabel({ status, onRetry }: Props) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const opacity = useRef(new Animated.Value(0)).current;
  // Keep the last visible state while fading out after 'idle'.
  const [shown, setShown] = useState<Exclude<Status, 'idle'>>('saved');

  useEffect(() => {
    if (status !== 'idle') setShown(status);
    Animated.timing(opacity, {
      toValue: status === 'idle' ? 0 : 1,
      duration: status === 'idle' ? 300 : 120,
      useNativeDriver: true,
    }).start();
  }, [status]);

  if (shown === 'error') {
    return (
      <Animated.View style={{ opacity }} pointerEvents={status === 'error' ? 'auto' : 'none'}>
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={[styles.label, styles.error]}>{"Couldn't save · Retry"}</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.Text style={[styles.label, { opacity }]}>{shown === 'saving' ? 'Saving…' : '✓ Saved'}</Animated.Text>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    label: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xs,
      letterSpacing: Typography.letterSpacing.label,
      color: colors.textSecondary,
    },
    error: { color: colors.error },
  });
}
