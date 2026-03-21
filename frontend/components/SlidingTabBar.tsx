import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/theme';

type SlidingTabBarProps = BottomTabBarProps & {
  inset?: number;
};

export default function SlidingTabBar({
  state,
  descriptors,
  navigation,
  inset = 20,
}: SlidingTabBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const visibleRoutes = state.routes
    .map((route, index) => ({
      route,
      index,
      options: descriptors[route.key].options,
    }))
    .filter(({ options }) => (options as any).tabBarIcon !== undefined);

  const foundIndex = visibleRoutes.findIndex(({ index }) => index === state.index);
  const activeVisibleIndex = foundIndex !== -1 ? foundIndex : 0;
  const animatedIndex = useRef(new Animated.Value(activeVisibleIndex)).current;

  useEffect(() => {
    Animated.spring(animatedIndex, {
      toValue: activeVisibleIndex,
      tension: 180,
      friction: 18,
      useNativeDriver: true,
    }).start();
  }, [activeVisibleIndex, animatedIndex]);

  const segmentWidth = visibleRoutes.length > 0 && barWidth > 0 ? (barWidth - 12) / visibleRoutes.length : 0;

  return (
    <View
      style={[styles.shell, { left: inset, right: inset }]}
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
    >
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            styles.activeTrackContainer,
            {
              width: segmentWidth,
              transform: [{ translateX: Animated.multiply(animatedIndex, segmentWidth) }],
            },
          ]}
        >
          <View style={styles.activeTrackPill} />
        </Animated.View>
      )}

      {visibleRoutes.map(({ route, index, options }) => {
        const focused = state.index === index;
        const icon =
          typeof options.tabBarIcon === 'function'
            ? options.tabBarIcon({
                focused,
                color: focused ? '#000' : COLORS.textSecondary,
                size: 22,
              })
            : null;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            style={styles.tabButton}
            onPress={onPress}
            activeOpacity={0.85}
          >
            {icon}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    bottom: 28,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 32,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
    paddingHorizontal: 6,
  },
  activeTrackContainer: {
    position: 'absolute',
    left: 6,
    top: 6,
    bottom: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTrackPill: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF',
  },
  tabButton: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
