export function fmtMoney(n: number | null | undefined, dp = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  const opts = { minimumFractionDigits: dp, maximumFractionDigits: dp };
  return `£${Number(n).toLocaleString("en-GB", opts)}`;
}

export function fmtNumber(n: number | null | undefined, dp = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function fmtPct(n: number | null | undefined, dp = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(dp)}%`;
}
