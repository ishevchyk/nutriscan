import {Button, View} from 'react-native';
import {Tabs, useRouter} from 'expo-router';

import {useThemeColor} from '../../hooks/useThemeColor';

export default function TabsLayout() {
    const router = useRouter();
    const colors = useThemeColor();
  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textSecondary }}>
          <Tabs.Screen name="index" options={{
              title: 'Products' ,
              headerRight: () => <Button title="+" color={colors.primary} onPress={() => router.push('/add-product')} />
          }} />
      </Tabs>
    </View>
  );
}
