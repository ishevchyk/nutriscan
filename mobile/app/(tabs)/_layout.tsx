import {Button} from 'react-native';
import {Tabs, useRouter} from 'expo-router';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';

import {useThemeColor} from '../../hooks/useThemeColor';

export default function TabsLayout() {
    const router = useRouter();
    const colors = useThemeColor();
  return (
      <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textSecondary }}>
          <Tabs.Screen name="products"  options={{
              title: 'Products',
              headerRight: () => <Button title="+ ADD" color={colors.primary} onPress={() => router.push('/add-product')} />,
              tabBarIcon: ({focused}) => <MaterialDesignIcons name={"barley"} size={20} color={focused ? colors.primary : colors.surface} />,
          }} />
          <Tabs.Screen name="recipes" options={{
              title: 'Recipes',
              tabBarIcon: ({focused}) => <MaterialDesignIcons name={"bowl-mix"} size={20} color={focused ? colors.primary : colors.surface} />,
              tabBarActiveTintColor: colors.primary
          }} />
      </Tabs>
  );
}
