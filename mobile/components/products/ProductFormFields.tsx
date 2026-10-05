import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Control, Controller, FieldErrors, FieldPath } from 'react-hook-form';

import { Spacing, Typography } from '../../constants/theme';
import { ProductFormInput, ProductFormValues } from '../../hooks/useProductForm';
import { SectionLabel, UnderlineField, RichEditorField } from '../ui';
import { GroupPicker } from '../groups/GroupPicker';
import { Group } from '../../store/types';
import { Product } from '../../store/productStore';
import { useNutrientStore } from '../../store/nutrientStore';
import { ProductNutritionSections } from './ProductNutritionSections';
import { NewPortionDraft, NutritionBasis } from '../../hooks/useNutritionBasis';
import { PortionsSection } from './PortionsSection';

type FormControl = Control<ProductFormInput, any, ProductFormValues>;
type TextFieldName = Extract<FieldPath<ProductFormInput>, 'name' | 'brand'>;
type ProductFormFieldsProps = {
    control: FormControl;
    errors: FieldErrors<ProductFormInput>;
    groups: Group[];
    selectedGroupIds: string[];
    onToggleGroup: (groupId: string) => void;
    // Set on the edit screen: enables portion switching and management
    // (portions are saved per-product, so a not-yet-created product has none).
    product?: Product;
    basis: NutritionBasis;
    onSavePortion?: (portion: NewPortionDraft) => Promise<void>;
    /** Called when an input is committed (blur); the edit screen autosaves on it. */
    onCommit?: () => void;
    /** Wraps portion writes so they show up in the autosave indicator. */
    onTrack?: <T>(task: () => Promise<T>) => Promise<T | undefined>;
};

function ControlledUnderlineField({
    control,
    name,
    label,
    error,
    onCommit,
}: {
    control: FormControl;
    name: TextFieldName;
    label: string;
    error?: string;
    onCommit?: () => void;
}) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field: { onChange, onBlur, value } }) => (
                <UnderlineField
                    label={label}
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={() => {
                        onBlur();
                        onCommit?.();
                    }}
                    error={error}
                />
            )}
        />
    );
}

export function ProductFormFields({ control, errors, groups, selectedGroupIds, onToggleGroup, product, basis, onSavePortion, onCommit, onTrack }: ProductFormFieldsProps) {
    const { nutrients, loaded, loadNutrients } = useNutrientStore();
    useEffect(() => {
        if (!loaded) loadNutrients();
    }, [loaded]);

    return (
        <>
            <SectionLabel>Identity</SectionLabel>
            <ControlledUnderlineField control={control} name="name" label="Name" error={errors.name?.message} onCommit={onCommit} />
            <ControlledUnderlineField control={control} name="brand" label="Brand" error={errors.brand?.message} onCommit={onCommit} />
            <Controller
                control={control}
                name="barcode"
                render={({ field: { value } }) => (
                    <UnderlineField
                        label="Barcode"
                        value={value ?? '0000000000000'}
                        editable={false}
                        valueFontFamily="mono"
                    />
                )}
            />

            {product && <ReadOnlySource source={product.source} />}

            <ProductNutritionSections control={control} portions={product?.portions ?? []} nutrients={nutrients} basis={basis} onSavePortion={onSavePortion} onCommit={onCommit} />

            {product?.source === 'catalog' && (
                <Text style={styles.attribution}>DATA FROM OPEN FOOD FACTS · ODBL</Text>
            )}

            {product && <PortionsSection product={product} onTrack={onTrack} />}

            <SectionLabel style={styles.sectionSpacing}>Notes</SectionLabel>
            <Controller
                control={control}
                name="notes"
                render={({ field: { onChange, onBlur, value } }) => (
                    <RichEditorField value={value ?? ''} onChangeText={onChange} onBlur={onBlur} />
                )}
            />

            <SectionLabel style={styles.sectionSpacing}>Groups</SectionLabel>
            <GroupPicker groups={groups} selectedIds={selectedGroupIds} onToggle={onToggleGroup} />
        </>
    );
}

const SOURCE_LABELS: Record<string, string> = {
    manual: 'Manual entry',
    catalog: 'Open Food Facts',
    ai_scan: 'AI scan',
    ai_chat: 'AI chat',
};

function ReadOnlySource({ source }: { source: string | null }) {
    return (
        <UnderlineField
            label="Source"
            value={SOURCE_LABELS[source ?? 'manual'] ?? source ?? ''}
            editable={false}
        />
    );
}

const styles = StyleSheet.create({
    sectionSpacing: {
        marginTop: Spacing.lg,
    },
    attribution: {
        marginTop: Spacing.md,
        fontFamily: Typography.fontFamily.mono,
        fontSize: Typography.fontSize.xxs,
        letterSpacing: Typography.letterSpacing.label,
        color: '#9A9189',
    },
});
