import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";

const root = join(__dirname, "..");
const schema = JSON.parse(readFileSync(join(root, "..", "contract", "arrels.schema.json"), "utf8"));
const ajv = new Ajv2020({ strict: false });
ajv.addSchema(schema);
const check = (kind: string, doc: unknown) =>
  ajv.validate(`${schema.$id}#/$defs/${kind}`, doc) || ajv.errorsText();

describe("synthetic sample matches the shared JSON contract", () => {
  const dir = join(root, "public", "sample");
  it("meta.json", () => expect(check("meta", JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")))).toBe(true));
  it.each(readdirSync(join(dir, "barri")))("barri/%s", (file) =>
    expect(check("barri", JSON.parse(readFileSync(join(dir, "barri", file), "utf8")))).toBe(true));
});
