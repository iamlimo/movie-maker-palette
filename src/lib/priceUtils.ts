/**
 * Price conversion utilities for handling Naira ↔ Kobo conversions
 * 
 * PRICING SYSTEM OVERVIEW:
 * =========================
 * 
 * Storage Layer (Database):
 * - All prices stored in KOBO (smallest unit)
 * - 100 kobo = 1 Naira
 * - Example: ₦1,000 = 100000 kobo
 * 
 * API/Backend Layer:
 * - Paystack receives amounts in KOBO
 * - Edge functions process prices in KOBO
 * - Wallet balances stored in KOBO
 * 
 * Display Layer (Frontend):
 * - All prices shown to users in NAIRA
 * - Use formatNaira() for all user-facing prices
 * - Admin inputs in NAIRA (auto-converted to kobo)
 * 
 * Default Prices:
 * - Movies: 100000 kobo (₦1,000)
 * - Seasons: 300000 kobo (₦3,000)
 * - Episodes: 35000 kobo (₦350)
 */

/**
 * Platform default prices in kobo (100 kobo = 1 Naira)
 */
export const DEFAULT_PRICES = {
  MOVIE: 100000,      // ₦1,000
  SEASON: 300000,     // ₦3,000
  EPISODE: 35000,     // ₦350
} as const;

/**
 * Platform default prices in Naira (for display)
 */
export const DEFAULT_PRICES_NAIRA = {
  MOVIE: 1000,
  SEASON: 3000,
  EPISODE: 350,
} as const;

/**
 * Get default price for content type
 */
export const getDefaultPrice = (contentType: 'movie' | 'season' | 'episode'): number => {
  switch (contentType) {
    case 'movie':
      return DEFAULT_PRICES.MOVIE;
    case 'season':
      return DEFAULT_PRICES.SEASON;
    case 'episode':
      return DEFAULT_PRICES.EPISODE;
    default:
      return 0;
  }
};

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
