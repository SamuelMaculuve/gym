const CURRENCY_SYMBOLS: Record<string, string> = {
  MZN: 'MT',
  USD: 'US$',
  EUR: '€',
  ZAR: 'R',
};

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/** Converte um valor em unidades (ex.: 1500.5 MT) para cêntimos inteiros. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Agrupa milhares com "." e decimais com "," — ex.: 1.500 MT, 1.250,50 MT */
export function formatNumber(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${value < 0 ? '-' : ''}${grouped}${dec ? `,${dec}` : ''}`;
}

export function formatMoney(cents: number, currency = 'MZN'): string {
  const value = fromCents(cents);
  const decimals = Number.isInteger(value) ? 0 : 2;
  return `${formatNumber(value, decimals)} ${currencySymbol(currency)}`;
}
