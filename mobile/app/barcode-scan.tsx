import { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';

import { LookupOutcomePanel } from '../components/catalog/LookupOutcomePanel';
import { OffAttribution } from '../components/catalog/OffAttribution';
import { ThemeColors } from '../constants/Colors';
import { Radii } from '../constants/Radii';
import { Spacing } from '../constants/Spacing';
import { Typography } from '../constants/Typography';
import { useCatalogLookup } from '../hooks/useCatalogLookup';
import { useThemeColor } from '../hooks/useThemeColor';

export default function BarcodeScan() {
    const router = useRouter();
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [permission, requestPermission] = useCameraPermissions();
    const { state, lookup, reset } = useCatalogLookup();
    // The camera fires onBarcodeScanned continuously; handle one scan per attempt.
    const handled = useRef(false);

    function onScanned({ data }: { data: string }) {
        if (handled.current) return;
        handled.current = true;
        lookup(data);
    }

    function scanAgain() {
        handled.current = false;
        reset();
    }

    if (!permission) return <View style={styles.container} />;

    if (!permission.granted) {
        return (
            <View style={[styles.container, styles.centered]}>
                <Text style={styles.message}>Camera access is needed to scan barcodes.</Text>
                <Pressable style={styles.button} onPress={requestPermission}>
                    <Text style={styles.buttonText}>Allow camera</Text>
                </Pressable>
                <Pressable onPress={() => router.back()}>
                    <Text style={styles.link}>Enter manually instead</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                onBarcodeScanned={state.kind === 'idle' ? onScanned : undefined}
            />
            <View style={styles.overlay} pointerEvents="box-none">
                {state.kind === 'idle' ? (
                    <>
                        <View style={styles.frame} />
                        <Text style={styles.overlayText}>Point the camera at a product barcode</Text>
                    </>
                ) : (
                    <View style={styles.panelWrap}>
                        {/* Phase 6: pass onScanLabelWithAI={openAiLabelScan} to offer the Claude Vision fallback. */}
                        <LookupOutcomePanel state={state} onRetry={lookup} onDismiss={scanAgain} />
                    </View>
                )}
                <View style={styles.footer}>
                    <OffAttribution />
                </View>
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: '#000' },
        centered: { alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.xl, backgroundColor: colors.pageBackground },
        message: { color: colors.text, fontSize: Typography.fontSize.base, textAlign: 'center' },
        button: { backgroundColor: colors.primary, borderRadius: Radii.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
        buttonText: { color: colors.onPrimary, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },
        link: { color: colors.primary, fontSize: Typography.fontSize.base },
        overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
        frame: { width: 260, height: 160, borderWidth: 2, borderColor: '#fff', borderRadius: Radii.lg },
        overlayText: { color: '#fff', marginTop: Spacing.lg, fontSize: Typography.fontSize.base },
        panelWrap: { alignSelf: 'stretch' },
        footer: { position: 'absolute', bottom: Spacing.xl, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: Radii.lg, paddingHorizontal: Spacing.lg },
    });
}
