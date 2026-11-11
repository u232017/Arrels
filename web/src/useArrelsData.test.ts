import { fitRange } from "./useArrelsData";

describe("fitRange", () => {
  const months = ["2024-01", "2024-02", "2024-03"];
  it("keeps a range that exists in the new barri", () =>
    expect(fitRange({ from: "2024-02", to: "2024-03" }, months)).toEqual({ from: "2024-02", to: "2024-03" }));
  it("falls back to the latest months when the range does not exist", () =>
    expect(fitRange({ from: "2023-01", to: "2023-02" }, months)).toEqual({ from: "2024-01", to: "2024-03" }));
  it("is null for a barri without months", () => expect(fitRange(null, [])).toBeNull());
});
