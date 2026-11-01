import { Tabs } from 'expo-router';
import { LayoutDashboard, Calendar, TrendingUp, Users } from 'lucide-react-native';
import SlidingTabBar from '../../components/SlidingTabBar';

export default function AdminLayout() {
  return (
    <Tabs
      tabBar={(props) => <SlidingTabBar {...props} inset={20} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ color }) => <LayoutDashboard size={20} color={color} strokeWidth={2.1} /> }} />
      <Tabs.Screen name="events/index" options={{ tabBarIcon: ({ color }) => <Calendar size={20} color={color} strokeWidth={2.1} /> }} />
      <Tabs.Screen name="analytics" options={{ tabBarIcon: ({ color }) => <TrendingUp size={20} color={color} strokeWidth={2.1} /> }} />
      <Tabs.Screen name="users" options={{ tabBarIcon: ({ color }) => <Users size={20} color={color} strokeWidth={2.1} /> }} />
      <Tabs.Screen name="events/create" options={{ href: null }} />
    </Tabs>
  );
}
