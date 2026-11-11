import type { Barri, Meta } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No s'ha pogut carregar ${url} (${res.status})`);
  return (await res.json()) as T;
}

export const loadMeta = (base: string) => getJson<Meta>(`${base}/meta.json`);
export const loadBarri = (base: string, code: string) => getJson<Barri>(`${base}/barri/${code}.json`);

/** Folder with the JSON files: real export by default, synthetic sample for tests and demos. */
export const DATA_DIR: string = import.meta.env.VITE_DATA_DIR ?? "data";
