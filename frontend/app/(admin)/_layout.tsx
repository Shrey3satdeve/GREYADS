import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { LayoutDashboard, Calendar, TrendingUp, Users } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';

function AdminTabIcon({ icon: Icon, focused }: { icon: any; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconActive]}>
      <Icon size={20} color={focused ? '#000' : COLORS.textSecondary} strokeWidth={focused ? 2.5 : 1.8} />
    </View>
  );
}

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ focused }) => <AdminTabIcon icon={LayoutDashboard} focused={focused} /> }} />
      <Tabs.Screen name="events/index" options={{ tabBarIcon: ({ focused }) => <AdminTabIcon icon={Calendar} focused={focused} /> }} />
      <Tabs.Screen name="analytics" options={{ tabBarIcon: ({ focused }) => <AdminTabIcon icon={TrendingUp} focused={focused} /> }} />
      <Tabs.Screen name="users" options={{ tabBarIcon: ({ focused }) => <AdminTabIcon icon={Users} focused={focused} /> }} />
      <Tabs.Screen name="login" options={{ href: null }} />
      <Tabs.Screen name="events/create" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute', bottom: 28, left: 20, right: 20, height: 64,
    borderRadius: 32, backgroundColor: 'rgba(18,18,18,0.96)', borderTopWidth: 0,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', elevation: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16,
  },
  iconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  iconActive: { backgroundColor: '#FFFFFF' },
});
