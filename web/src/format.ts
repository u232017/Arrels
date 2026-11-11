const LOCALE = "ca-ES";
const MINUS = "−";

const intFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0, useGrouping: true });
const pctFmt = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const MONTHS_CA = [
  "gener", "febrer", "març", "abril", "maig", "juny",
  "juliol", "agost", "setembre", "octubre", "novembre", "desembre",
];

// ca-ES leaves 4-digit numbers ungrouped; force the dot so all values read the same way.
export function formatInt(n: number): string {
  const s = intFmt.format(Math.round(n));
  return /^\d{4}$/.test(s) ? `${s[0]}.${s.slice(1)}` : s;
}

export function formatPct(share: number): string {
  return `${pctFmt.format(share * 100)} %`;
}

export function formatSignedPct(change: number): string {
  const sign = change > 0 ? "+" : change < 0 ? MINUS : "";
  return `${sign}${pctFmt.format(Math.abs(change) * 100)} %`;
}

export function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_CA[m - 1]} ${y}`;
}
