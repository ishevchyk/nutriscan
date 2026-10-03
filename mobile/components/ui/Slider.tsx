import { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';

import { Radii, ThemeColors } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';

type SliderProps = {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  accessibilityLabel?: string;
};

const THUMB = 22;
const TRACK = 4;

/**
 * Minimal single-thumb slider on RN's own PanResponder -- no extra native
 * dependency, and it works inside RN's <Modal> (BottomSheet) without a
 * second GestureHandlerRootView. Claims the gesture over the parent
 * ScrollView so dragging horizontally never scrolls the sheet.
 */
export function Slider({ min, max, step = 1, value, onChange, accessibilityLabel }: SliderProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [width, setWidth] = useState(0);
  const trackRef = useRef<View>(null);
  const trackPageX = useRef(0);
  // PanResponder is created once; read the latest props through refs.
  const latest = useRef({ min, max, step, width, onChange });
  latest.current = { min, max, step, width, onChange };

  const valueAt = (pageX: number) => {
    const { min: lo, max: hi, step: st, width: w } = latest.current;
    if (w <= 0) return lo;
    const ratio = Math.min(1, Math.max(0, (pageX - trackPageX.current) / w));
    const raw = lo + ratio * (hi - lo);
    return Math.min(hi, Math.max(lo, Math.round(raw / st) * st));
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          // Re-measure on every touch: the sheet slides in, so a position
          // captured at layout time can be stale.
          const pageX = e.nativeEvent.pageX;
          trackRef.current?.measure((_x, _y, _w, _h, px) => {
            trackPageX.current = px;
            latest.current.onChange(valueAt(pageX));
          });
        },
        onPanResponderMove: (e) => latest.current.onChange(valueAt(e.nativeEvent.pageX)),
      }),
    [],
  );

  const ratio = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;
  const fill = ratio * width;

  return (
    <View
      style={styles.hitArea}
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const delta = e.nativeEvent.actionName === 'increment' ? step : -step;
        onChange(Math.min(max, Math.max(min, value + delta)));
      }}
    >
      <View
        ref={trackRef}
        style={styles.track}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        <View style={[styles.fill, { width: fill }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: fill }]} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    // Horizontal padding = half a thumb, so the thumb's centre can reach both
    // track ends without being clipped.
    hitArea: { height: 36, justifyContent: 'center', paddingHorizontal: THUMB / 2 },
    track: { height: TRACK, borderRadius: Radii.full, backgroundColor: colors.border, overflow: 'hidden' },
    fill: { height: TRACK, backgroundColor: colors.primary },
    thumb: {
      position: 'absolute',
      top: (36 - THUMB) / 2,
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: colors.card,
    },
  });
}
