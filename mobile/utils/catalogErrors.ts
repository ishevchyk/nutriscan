import axios from 'axios';

export type CatalogErrorCode =
    | 'catalog_not_found'
    | 'catalog_unavailable'
    | 'rate_limited'
    | 'already_in_library'
    | 'invalid_barcode'
    | 'invalid_query'
    | 'network'
    | 'unknown';

export type CatalogError = {
    code: CatalogErrorCode;
    /** Seconds to wait before retrying (503/429). */
    retryAfter?: number;
    /** Set with 'already_in_library'. */
    productId?: string;
};

/** Backend errors look like `{ detail: { code, ...extra } }`. */
export function parseCatalogError(err: unknown): CatalogError {
    if (!axios.isAxiosError(err)) return { code: 'unknown' };
    if (!err.response) return { code: 'network' };
    const detail = err.response.data?.detail;
    if (detail && typeof detail === 'object' && typeof detail.code === 'string') {
        return { code: detail.code, retryAfter: detail.retry_after, productId: detail.product_id };
    }
    return { code: 'unknown' };
}

export function catalogErrorMessage(error: CatalogError): string {
    switch (error.code) {
        case 'catalog_unavailable':
        case 'rate_limited':
            return 'Catalog is busy — try again in a minute, or add manually.';
        case 'network':
            return "Can't reach the server. Check your connection and try again.";
        case 'invalid_barcode':
            return "That doesn't look like a valid barcode.";
        default:
            return 'Something went wrong with the catalog. Try again, or add manually.';
    }
}
