import { loadBarri, loadMeta } from "./data";

afterEach(() => vi.unstubAllGlobals());

describe("data loading", () => {
  it("loads meta from the data folder", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ pilots: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    await loadMeta("sample");
    expect(fetchMock).toHaveBeenCalledWith("sample/meta.json");
  });
  it("loads one barri file", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: "1" }) });
    vi.stubGlobal("fetch", fetchMock);
    await loadBarri("data", "080190308");
    expect(fetchMock).toHaveBeenCalledWith("data/barri/080190308.json");
  });
  it("throws a readable error when the file is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(loadMeta("data")).rejects.toThrow(/404/);
  });
});
