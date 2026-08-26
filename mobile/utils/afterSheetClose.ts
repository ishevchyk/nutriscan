/** Waits for a bottom sheet's native modal to fully dismiss before pushing a
 * route or presenting another modal (iOS can't present over a live modal). */
export function afterSheetClose(fn: () => void) {
  setTimeout(fn, 350);
}
