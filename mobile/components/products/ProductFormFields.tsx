import { StyleSheet } from 'react-native';
import { Control, Controller, FieldErrors, FieldPath } from 'react-hook-form';

import { Spacing } from '../../constants/theme';
import { ProductFormInput, ProductFormValues } from '../../hooks/useProductForm';
import { SectionLabel, UnderlineField, StatGrid, StatCard, NotesField } from '../ui';
import { GroupPicker } from '../groups/GroupPicker';
import { Group } from '../../store/types';

type FormControl = Control<ProductFormInput, any, ProductFormValues>;
type TextFieldName = Extract<FieldPath<ProductFormInput>, 'name' | 'brand'>;
type StatFieldName = Extract<
    FieldPath<ProductFormInput>,
    'calories' | 'protein' | 'fat' | 'carbs' | 'fiber' | 'sugar' | 'salt'
>;

type ProductFormFieldsProps = {
    control: FormControl;
    errors: FieldErrors<ProductFormInput>;
    groups: Group[];
    selectedGroupIds: string[];
    onToggleGroup: (groupId: string) => void;
};

function ControlledUnderlineField({
    control,
    name,
    label,
    error,
}: {
    control: FormControl;
    name: TextFieldName;
    label: string;
    error?: string;
}) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field: { onChange, onBlur, value } }) => (
                <UnderlineField label={label} value={value ?? ''} onChangeText={onChange} onBlur={onBlur} error={error} />
            )}
        />
    );
}

function ControlledStatCard({
    control,
    name,
    label,
    unit,
    size,
}: {
    control: FormControl;
    name: StatFieldName;
    label: string;
    unit: string;
    size: 'lg' | 'sm';
}) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field: { onChange, value } }) => (
                <StatCard label={label} unit={unit} value={value as number | null} onChangeValue={onChange} size={size} />
            )}
        />
    );
}

export function ProductFormFields({ control, errors, groups, selectedGroupIds, onToggleGroup }: ProductFormFieldsProps) {
    return (
        <>
            <SectionLabel>Identity</SectionLabel>
            <ControlledUnderlineField control={control} name="name" label="Name" error={errors.name?.message} />
            <ControlledUnderlineField control={control} name="brand" label="Brand" error={errors.brand?.message} />
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

            <SectionLabel style={styles.sectionSpacing}>Macronutrients (per 100g)</SectionLabel>
            <StatGrid columns={2}>
                <ControlledStatCard control={control} name="calories" label="Calories" unit="kcal" size="lg" />
                <ControlledStatCard control={control} name="protein" label="Protein" unit="g" size="lg" />
                <ControlledStatCard control={control} name="fat" label="Fat" unit="g" size="lg" />
                <ControlledStatCard control={control} name="carbs" label="Carbs" unit="g" size="lg" />
            </StatGrid>

            <SectionLabel style={styles.sectionSpacing}>Detail (per 100g)</SectionLabel>
            <StatGrid columns={3}>
                <ControlledStatCard control={control} name="fiber" label="Fiber" unit="g" size="sm" />
                <ControlledStatCard control={control} name="sugar" label="Sugar" unit="g" size="sm" />
                <ControlledStatCard control={control} name="salt" label="Salt" unit="g" size="sm" />
            </StatGrid>

            <SectionLabel style={styles.sectionSpacing}>Notes</SectionLabel>
            <Controller
                control={control}
                name="notes"
                render={({ field: { onChange, onBlur, value } }) => (
                    <NotesField value={value ?? ''} onChangeText={onChange} onBlur={onBlur} />
                )}
            />

            <SectionLabel style={styles.sectionSpacing}>Groups</SectionLabel>
            <GroupPicker groups={groups} selectedIds={selectedGroupIds} onToggle={onToggleGroup} />
        </>
    );
}

const styles = StyleSheet.create({
    sectionSpacing: {
        marginTop: Spacing.lg,
    },
});
