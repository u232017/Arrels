import Ajv2020 from "ajv/dist/2020";
import schema from "../../contract/arrels.schema.json";
import type { Barri, Meta } from "./types";

const ajv = new Ajv2020({ strict: false });
ajv.addSchema(schema);
const validators = {
  meta: ajv.getSchema(`${schema.$id}#/$defs/meta`),
  barri: ajv.getSchema(`${schema.$id}#/$defs/barri`),
};

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`No s'ha pogut carregar ${url} (${res.status})`);
  return res.json();
}

function checked<T>(kind: keyof typeof validators, doc: unknown, url: string): T {
  const validate = validators[kind];
  if (!validate || !validate(doc)) {
    throw new Error(`Format de dades no vàlid a ${url}: ${ajv.errorsText(validate?.errors)}`);
  }
  return doc as T;
}

export async function loadMeta(base: string, signal?: AbortSignal): Promise<Meta> {
  const url = `${base}/meta.json`;
  return checked<Meta>("meta", await getJson(url, signal), url);
}

export async function loadBarri(base: string, code: string, signal?: AbortSignal): Promise<Barri> {
  const url = `${base}/barri/${encodeURIComponent(code)}.json`;
  return checked<Barri>("barri", await getJson(url, signal), url);
}

const ALLOWED_DIRS = new Set(["data", "sample"]);
const requested: string = import.meta.env.VITE_DATA_DIR ?? "data";

/** Folder with the JSON files: real export by default, synthetic sample for tests and demos. */
export const DATA_DIR = ALLOWED_DIRS.has(requested) ? requested : "data";
