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
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarActiveTintColor: colors.primary
        }
        }>
            <Tabs.Screen name="tracker" options={{
                title: 'Tracker',
                tabBarIcon: ({focused}) => (
                    <MaterialDesignIcons name={"alpha-t-circle-outline"} size={20} color={focused ? colors.primary : colors.surface}/>
                ),
            }}/>
            <Tabs.Screen name="products" options={{
                header: () => (
                    <ScreenHeader
                        headerTitle="Products"
                        rightAction={{label: '+ ADD', onPress: () => router.push('/add-product')}}
                    />
                ),
                tabBarIcon: ({focused}) => (
                    <MaterialDesignIcons name={"barley"} size={20} color={focused ? colors.primary : colors.surface}/>
                ),
            }}/>
            <Tabs.Screen name="recipes" options={{
                header: () => (
                    <ScreenHeader
                        headerTitle="Recipes"
                        rightAction={{label: '+ ADD', onPress: () => router.push('/add-recipe')}}
                    />
                ),
                tabBarIcon: ({focused}) => (
                    <MaterialDesignIcons name={"bowl-mix"} size={20} color={focused ? colors.primary : colors.surface}/>
                ),
            }}/>

            <Tabs.Screen name="settings" options={{
                title: 'Settings',
                tabBarIcon: ({focused}) => (
                    <MaterialDesignIcons name={"account-cog"} size={20} color={focused ? colors.primary : colors.surface}/>
                ),
            }}/>
        </Tabs>
    );
}
