import axios from 'axios';

/** Backend errors look like `{ detail: { code, ...extra } }` (or a plain string). */
function errorCode(err: unknown): string | null {
    if (!axios.isAxiosError(err)) return null;
    const detail = err.response?.data?.detail;
    return detail && typeof detail === 'object' && typeof detail.code === 'string' ? detail.code : null;
}

export function isAlreadyConverted(err: unknown): boolean {
    return errorCode(err) === 'already_converted';
}

export function mealProductErrorMessage(err: unknown): string {
    switch (errorCode(err)) {
        case 'meal_has_no_ingredients':
            return 'Add at least one ingredient before converting this meal.';
        case 'meal_has_no_weight':
            return 'This meal has no weight yet. Add ingredient grams or a cooked weight.';
        case 'circular_ingredient':
            return "This meal uses the product made from itself, so it can't be synced.";
        case 'already_converted':
            return 'This meal already has a product.';
    }
    if (axios.isAxiosError(err) && !err.response) return "Can't reach the server. Check your connection.";
    return 'Something went wrong. Try again.';
}
