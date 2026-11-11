// Mirrors contract/arrels.schema.json. src/contract.test.ts checks the sample data against it.

export type State = "published" | "suppressed" | "absent";

export interface Badge {
  window: string;
  pct_published: number;
  pct_suppressed: number;
  pct_absent: number;
  n_routes?: number;
}

export interface Value {
  value: number | null;
  state: State;
  badge: Badge;
}

export interface Home {
  code: string;
  name: string;
  visitors: number;
  lat?: number | null;
  lon?: number | null;
}

export interface BarriMonth {
  month: string; // YYYY-MM
  visitors: Value;
  yoy: Value;
  weekend_share: Value;
  holidays: string[];
  homes?: Home[];
}

export interface Barri {
  code: string;
  name: string;
  months: BarriMonth[];
  context: { rent: Value; residents: Value; hut_per_1000: Value };
}

export interface Meta {
  generated: string;
  window: { start: string; end: string };
  threshold: number;
  pilots: { code: string; name: string }[];
  missing_days: string[];
  partial_days: string[];
}
