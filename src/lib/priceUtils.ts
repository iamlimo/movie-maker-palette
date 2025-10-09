/**
 * Price conversion utilities for handling Naira ↔ Kobo conversions
 * 
 * Storage: All prices are stored in kobo (smallest unit)
 * Display: All prices are shown in Naira to users
 * API: Paystack receives amounts in kobo
 */

/**
 * Convert kobo to Naira for display
 * @param kobo - Amount in kobo
 * @returns Amount in Naira
 */
export const koboToNaira = (kobo: number): number => kobo / 100;

/**
 * Convert Naira to kobo for storage/API
 * @param naira - Amount in Naira
 * @returns Amount in kobo (rounded)
 */
export const nairaToKobo = (naira: number): number => Math.round(naira * 100);

/**
 * Format kobo as Naira currency string with proper localization
 * @param kobo - Amount in kobo
 * @returns Formatted Naira string (e.g., "₦1,000.00")
 */
export const formatNaira = (kobo: number): string => {
  const naira = koboToNaira(kobo);
  return `₦${naira.toLocaleString('en-NG', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};
