import {Tabs, useRouter} from 'expo-router';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';

import {useThemeColor} from '../../hooks/useThemeColor';
import {ScreenHeader} from "../../components/navigation/ScreenHeader";

export default function TabsLayout() {
    const router = useRouter();
    const colors = useThemeColor();

    return (
        <Tabs screenOptions={{
            header: ({options}) => (
                <ScreenHeader headerTitle={options.title ?? ''}/>
            ),
            tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textSecondary
        }
        }>
            <Tabs.Screen name="products" options={{
                header: () => (
                    <ScreenHeader
                        headerTitle="Products"
                        rightAction={{ label: '+ ADD', onPress: () => router.push('/add-product') }}
                    />
                ),
                tabBarIcon: ({focused}) => <MaterialDesignIcons name={"barley"} size={20}
                                                                color={focused ? colors.primary : colors.surface}/>,
            }}/>
            <Tabs.Screen name="recipes" options={{
                header: () => (
                    <ScreenHeader
                        headerTitle="Recipes"
                        rightAction={{ label: '+ ADD', onPress: () => router.push('/add-recipe') }}
                    />
                ),
                tabBarIcon: ({focused}) => <MaterialDesignIcons name={"bowl-mix"} size={20}
                                                                color={focused ? colors.primary : colors.surface}/>,
                tabBarActiveTintColor: colors.primary
            }}/>
        </Tabs>
    );
}
