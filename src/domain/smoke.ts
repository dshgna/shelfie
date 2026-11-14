// Placeholder: proves the src/domain setup (lint rules + Node tests) works.
// Delete this file and smoke.test.ts once the first real module is ported.

/** True when there is nothing left of an item. */
export function isOut(quantity: number): boolean {
  return quantity <= 0
}
