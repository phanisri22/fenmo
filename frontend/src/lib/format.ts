/**
 * Format a rupee amount using Indian number grouping (e.g. ₹1,45,000.00).
 * Summation uses integer paise math to avoid floating-point accumulation.
 */
export function formatINR(amount: number): string {
  return (
    "₹" +
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  );
}

/** Sum an array of rupee floats without floating-point drift. */
export function sumPaise(amounts: number[]): number {
  const paise = amounts.reduce((acc, a) => acc + Math.round(a * 100), 0);
  return paise / 100;
}

/** YYYY-MM-DD → DD/MM/YYYY */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const PALETTE = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
];

/** Deterministic color class for a category name (consistent across renders). */
export function categoryColor(name: string): string {
  let h = 0;
  for (const ch of name) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
