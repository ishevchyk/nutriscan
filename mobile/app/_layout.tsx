import {useEffect} from 'react';
import {Stack} from 'expo-router';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
    useFonts,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import {backAction, ScreenHeader} from "../components/navigation/ScreenHeader";
import {router} from "expo-router";
import {usePickerStore} from "../store/pickerStore";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        JetBrainsMono_400Regular,
        JetBrainsMono_500Medium,
        JetBrainsMono_700Bold,
    });

    useEffect(() => {
        if (fontsLoaded) {
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded]);

    if (!fontsLoaded) {
        return null;
    }

    return (
        <SafeAreaProvider>
            <Stack
                screenOptions={{
                    header: ({options}) => (
                        <ScreenHeader
                            headerTitle={options.title ?? ''}
                            rightAction={backAction('Products')}
                        />
                    ),
                }}>
                <Stack.Screen
                    name="(tabs)"
                    options={{
                        headerShown: false,
                        title: 'Products',
                    }}
                />
                <Stack.Screen
                    name="(auth)"
                    options={{
                        headerShown: false,
                    }}
                />
                <Stack.Screen
                    name="add-product"
                    options={{
                        title: 'Add Product',
                    }}
                />
                <Stack.Screen
                    name="product/[id]"
                    options={{
                        title: 'Product',
                    }}
                />
                <Stack.Screen
                    name="recently-deleted"
                    options={{
                        header: () => (
                            <ScreenHeader headerTitle="Recently deleted" rightAction={backAction('Back')}/>
                        ),
                    }}
                />
                <Stack.Screen
                    name="groups"
                    options={{
                        title: 'Groups'
                    }}
                />
                <Stack.Screen
                    name="add-meal"
                    options={{
                        header: () => (
                            <ScreenHeader headerTitle="Add Meal" rightAction={backAction('Meals')}/>
                        ),
                    }}
                />
                <Stack.Screen
                    name="meal/[id]"
                    options={{
                        header: () => (
                            <ScreenHeader headerTitle="Meal" rightAction={backAction('Meals')}/>
                        ),
                    }}
                />
                <Stack.Screen
                    name="product-picker"
                    options={{
                        presentation: 'modal',
                        header: () => (
                            <ScreenHeader
                                headerTitle="Select Product"
                                rightAction={{
                                    label: 'CANCEL',
                                    onPress: () => {
                                        usePickerStore.getState().resolve(null);
                                        router.back();
                                    },
                                }}
                            />
                        ),
                    }}
                />
            </Stack>
        </SafeAreaProvider>
    );
}
