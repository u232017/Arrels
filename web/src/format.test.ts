import { formatInt, formatMonth, formatPct, formatSignedPct } from "./format";

describe("format (ca-ES)", () => {
  it("groups thousands with a dot", () => expect(formatInt(472794)).toBe("472.794"));
  it("shows a share as a percentage with a decimal comma", () =>
    expect(formatPct(0.1734)).toBe("17,3 %"));
  it("signs changes", () => {
    expect(formatSignedPct(0.074)).toBe("+7,4 %");
    expect(formatSignedPct(-0.005)).toBe("−0,5 %");
  });
  it("names months in Catalan", () => expect(formatMonth("2024-02")).toBe("febrer 2024"));
});
