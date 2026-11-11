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

const MONTHS_SHORT_CA = ["gen.", "febr.", "març", "abr.", "maig", "juny", "jul.", "ag.", "set.", "oct.", "nov.", "des."];
// Catalan takes "l'" before a vowel: "A l'agost", "Al setembre".
const ELIDED = new Set([4, 8, 10]);

/** Chart tick: "set.", with the year on January ("gen. 2025"). */
export function formatMonthShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${MONTHS_SHORT_CA[0]} ${y}` : MONTHS_SHORT_CA[m - 1];
}

/** "A l'agost de 2025" / "Al setembre de 2025". */
export function monthPhrase(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${ELIDED.has(m) ? "A l'" : "Al "}${MONTHS_CA[m - 1]} de ${y}`;
}

/** "Entre setembre de 2024 i agost de 2025". */
export function periodPhrase(from: string, to: string): string {
  const name = (ym: string) => formatMonth(ym).replace(" ", " de ");
  return `Entre ${name(from)} i ${name(to)}`;
}

/** Axis numbers: whole numbers with Catalan grouping. */
export function formatCompact(n: number): string {
  return formatInt(n);
}
