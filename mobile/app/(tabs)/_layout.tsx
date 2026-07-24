import {Button} from 'react-native';
import {Tabs, useRouter} from 'expo-router';

import {useThemeColor} from '../../hooks/useThemeColor';

export default function TabsLayout() {
    const router = useRouter();
    const colors = useThemeColor();
  return (
      <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textSecondary }}>
          <Tabs.Screen name="products"  options={{
              title: 'Products' ,
              headerRight: () => <Button title="+" color={colors.primary} onPress={() => router.push('/add-product')} />
          }} />
          <Tabs.Screen name="recipes" options={{
              title: 'Recipes',
          }} />
      </Tabs>
  );
}
