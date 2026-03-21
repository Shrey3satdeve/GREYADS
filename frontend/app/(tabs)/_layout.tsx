import { Tabs } from 'expo-router';
import { Compass, Ticket, Bell, User } from 'lucide-react-native';
import SlidingTabBar from '../../components/SlidingTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <SlidingTabBar {...props} inset={20} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color }) => <Compass size={22} color={color} strokeWidth={2.1} />,
          tabBarAccessibilityLabel: 'Discover',
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          tabBarIcon: ({ color }) => <Ticket size={22} color={color} strokeWidth={2.1} />,
          tabBarAccessibilityLabel: 'My Tickets',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ color }) => <Bell size={22} color={color} strokeWidth={2.1} />,
          tabBarAccessibilityLabel: 'Notifications',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => <User size={22} color={color} strokeWidth={2.1} />,
          tabBarAccessibilityLabel: 'Profile',
        }}
      />
    </Tabs>
  );
}
