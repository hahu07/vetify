// Ported verbatim from frontend/src/lib/formatters.ts -- pure presentation
// helpers, nothing ledger/DB-specific about them.

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function calculateInstallment(principal: number, profitMarginPct: number, tenureMonths: number): number {
  const totalProfit = principal * (profitMarginPct / 100);
  const salePrice = principal + totalProfit;
  return salePrice / tenureMonths;
}
