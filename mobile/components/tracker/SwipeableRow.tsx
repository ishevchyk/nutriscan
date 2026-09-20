import { ReactNode, useMemo, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import Swipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ThemeColors } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';

type SwipeableRowProps = {
  children: ReactNode;
  onDelete: () => void;
  actionWidth?: number;
};

const DEFAULT_ACTION_WIDTH = 72;

export function SwipeableRow({ children, onDelete, actionWidth = DEFAULT_ACTION_WIDTH }: SwipeableRowProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const swipeableRef = useRef<SwipeableMethods>(null);

  function handleDeletePress() {
    onDelete();
    swipeableRef.current?.close();
  }

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={actionWidth / 2}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable style={[styles.actionButton, { width: actionWidth }]} onPress={handleDeletePress} hitSlop={8}>
          <MaterialDesignIcons name="trash-can-outline" size={20} color={colors.onPrimary} />
        </Pressable>
      )}
    >
      {children}
    </Swipeable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionButton: {
      backgroundColor: colors.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
