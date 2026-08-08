import {StyleSheet, View} from 'react-native';
import { useRouter } from 'expo-router';
import { ThemeColors } from '../constants/theme';

export default function AddRecipe() {
    const router = useRouter();

    return (
        <View></View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
    });
}
