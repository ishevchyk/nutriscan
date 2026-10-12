import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';

import { useCatalogStore } from '../store/catalogStore';
import { CatalogError, parseCatalogError } from '../utils/catalogErrors';

export type LookupState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'inLibrary'; code: string; productId: string; deleted: boolean; name: string }
    | { kind: 'notFound'; code: string }
    | { kind: 'error'; code: string; error: CatalogError };

/**
 * Looks a barcode up in the catalog. A found product is handed to Add Product
 * through catalogStore.draft (which stays mounted underneath and applies it),
 * then this screen closes. Every other outcome is returned as state for
 * LookupOutcomePanel to render.
 */
export function useCatalogLookup() {
    const router = useRouter();
    const [state, setState] = useState<LookupState>({ kind: 'idle' });

    const lookup = useCallback(
        async (code: string) => {
            setState({ kind: 'loading' });
            try {
                const draft = await useCatalogStore.getState().lookup(code);
                if (draft.already_in_library) {
                    setState({
                        kind: 'inLibrary',
                        code,
                        productId: draft.already_in_library.product_id,
                        deleted: draft.already_in_library.deleted,
                        name: draft.name,
                    });
                    return;
                }
                useCatalogStore.getState().setDraft(draft);
                router.back();
            } catch (err) {
                const error = parseCatalogError(err);
                setState(error.code === 'catalog_not_found' ? { kind: 'notFound', code } : { kind: 'error', code, error });
            }
        },
        [router],
    );

    const reset = useCallback(() => setState({ kind: 'idle' }), []);
    return { state, lookup, reset };
}
