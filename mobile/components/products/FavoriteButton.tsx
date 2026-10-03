import { Pressable } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { useThemeColor } from '../../hooks/useThemeColor';

type FavoriteButtonProps = {
    favorite: boolean;
    onToggle: () => void;
    size?: number;
};

export function FavoriteButton({ favorite, onToggle, size = 22 }: FavoriteButtonProps) {
    const colors = useThemeColor();
    return (
        <Pressable
            onPress={onToggle}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityState={{ selected: favorite }}
            accessibilityLabel={favorite ? 'Remove from favourites' : 'Add to favourites'}
        >
            <MaterialDesignIcons
                name={favorite ? 'heart' : 'heart-outline'}
                size={size}
                color={favorite ? colors.primary : colors.textTertiary}
            />
        </Pressable>
    );
}
