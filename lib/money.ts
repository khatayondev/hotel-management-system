/**
 * Money helper for Ghana Cedi (GHS / GH₵).
 * Rule: Store money as integer pesewas (1 GHS = 100 pesewas).
 * Never trust client-sent prices or calculations; all arithmetic must happen on the server.
 */

export const CURRENCY_CODE = "GHS";
export const CURRENCY_SYMBOL = "GH₵";

/**
 * Format integer pesewas into standard Ghana Cedi display string.
 * Example: 1250 -> "GH₵ 12.50"
 */
export function formatPesewas(
  pesewas: number | bigint,
  options: {
    symbol?: string;
    includeSymbol?: boolean;
    locale?: string;
  } = {}
): string {
  const { symbol = CURRENCY_SYMBOL, includeSymbol = true, locale = "en-GH" } = options;
  const numPesewas = typeof pesewas === "bigint" ? Number(pesewas) : pesewas;

  if (isNaN(numPesewas)) {
    throw new TypeError(`Invalid pesewas amount: ${pesewas}`);
  }

  const cediValue = numPesewas / 100;

  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cediValue);

  return includeSymbol ? `${symbol} ${formattedNumber}` : formattedNumber;
}

/**
 * Converts integer pesewas to decimal GHS number.
 * Example: 2500 -> 25.0
 */
export function pesewasToGhs(pesewas: number): number {
  if (!Number.isFinite(pesewas)) {
    throw new TypeError(`Invalid pesewas amount: ${pesewas}`);
  }
  return Number((pesewas / 100).toFixed(2));
}

/**
 * Converts decimal GHS to integer pesewas, rounding safely.
 * Example: 25.50 -> 2550
 */
export function ghsToPesewas(ghs: number): number {
  if (!Number.isFinite(ghs)) {
    throw new TypeError(`Invalid GHS amount: ${ghs}`);
  }
  return Math.round(ghs * 100);
}

/**
 * Safe integer additions of pesewas.
 */
export function sumPesewas(...amounts: number[]): number {
  return amounts.reduce((total, amount) => {
    if (!Number.isInteger(amount)) {
      throw new Error(`Pesewas amount must be an integer, got: ${amount}`);
    }
    return total + amount;
  }, 0);
}

/**
 * Calculate deposit requirement given a service price in pesewas.
 */
export function calculateDeposit(
  pricePesewas: number,
  depositType: "FIXED" | "PERCENTAGE" | "FULL" | "NONE",
  depositValue?: number
): number {
  switch (depositType) {
    case "NONE":
      return 0;
    case "FULL":
      return pricePesewas;
    case "PERCENTAGE": {
      const percentage = depositValue ?? 30; // default 30%
      if (percentage <= 0 || percentage > 100) {
        throw new Error(`Invalid percentage deposit value: ${percentage}`);
      }
      return Math.round((pricePesewas * percentage) / 100);
    }
    case "FIXED": {
      const fixedPesewas = depositValue ?? 0;
      return Math.min(pricePesewas, Math.max(0, fixedPesewas));
    }
    default:
      return 0;
  }
}
