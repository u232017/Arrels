import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadBarri, loadMeta } from "./data";

const sample = join(__dirname, "..", "public", "sample");
const read = (rel: string) => JSON.parse(readFileSync(join(sample, rel), "utf8"));

afterEach(() => vi.unstubAllGlobals());

describe("data loading", () => {
  it("loads and validates meta from the data folder", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => read("meta.json") });
    vi.stubGlobal("fetch", fetchMock);
    const meta = await loadMeta("sample");
    expect(fetchMock).toHaveBeenCalledWith("sample/meta.json", expect.anything());
    expect(meta.pilots).toHaveLength(3);
  });
  it("loads one barri file with an encoded code", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => read("barri/000000001.json") });
    vi.stubGlobal("fetch", fetchMock);
    await loadBarri("data", "000000001");
    expect(fetchMock).toHaveBeenCalledWith("data/barri/000000001.json", expect.anything());
  });
  it("rejects a file that breaks the contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ pilots: [] }) }));
    await expect(loadMeta("data")).rejects.toThrow(/format de dades no vàlid/i);
  });
  it("throws a readable error when the file is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(loadMeta("data")).rejects.toThrow(/404/);
  });
});
