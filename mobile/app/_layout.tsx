import {useEffect, useMemo} from 'react';
import {router, Stack} from 'expo-router';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
    useFonts,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import {backAction, ScreenHeader} from "../components/navigation/ScreenHeader";

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
                        title: 'Recently deleted'
                    }}
                />
                <Stack.Screen
                    name="groups"
                    options={{
                        title: 'Groups'
                    }}
                />
            </Stack>
        </SafeAreaProvider>
    );
}
