/**
 * Shared monetary utility functions.
 * All money is stored in paise (smallest unit) to avoid floating-point issues.
 */

/** Tolerance for floating-point comparison of monetary values */
export const MONEY_EPSILON = 0.01;

const PAISE_MULTIPLIER = 100;

/** Round a number to 2 decimal places */
export function round2(value: number): number {
  return Math.round(value * PAISE_MULTIPLIER) / PAISE_MULTIPLIER;
}

/** Convert rupees to paise (integer) */
export function toPaise(amountInRupees: number): number {
  return Math.round(round2(amountInRupees) * PAISE_MULTIPLIER);
}

/** Format a rupee amount as "INR 123.45" */
export function formatInr(amount: number): string {
  return `INR ${round2(amount).toFixed(2)}`;
}
