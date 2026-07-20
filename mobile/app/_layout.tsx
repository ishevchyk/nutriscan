import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
            name="add-product"
            options={{
              presentation: 'modal',
              title: 'Add Product',
            }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
