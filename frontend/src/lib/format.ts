const LOCALE: Record<string, string> = { MXN: "es-MX", COP: "es-CO", ARS: "es-AR", USD: "en-US" };

/** Currency code first, digits formatted the way each country writes them. */
export function money(amount: number, currency: string): string {
  const n = new Intl.NumberFormat(LOCALE[currency] ?? "es", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `${currency} ${n}`;
}
