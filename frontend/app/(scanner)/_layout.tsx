import { Tabs } from 'expo-router';
import { ScanLine, Clock } from 'lucide-react-native';
import SlidingTabBar from '../../components/SlidingTabBar';

export default function ScannerLayout() {
  return (
    <Tabs
      tabBar={(props) => <SlidingTabBar {...props} inset={60} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ color }) => <ScanLine size={18} color={color} strokeWidth={2.4} /> }} />
      <Tabs.Screen name="history" options={{ tabBarIcon: ({ color }) => <Clock size={18} color={color} strokeWidth={2.4} /> }} />
    </Tabs>
  );
}
