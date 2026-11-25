import { type Bag, bagSchema } from "@cj/schema";
import { parse } from "yaml";

/** Parses a YAML list of bags and validates every entry against the schema, failing on the first bad one. */
export function readBags(text: string): Bag[] {
  const doc: unknown = parse(text);
  if (!Array.isArray(doc)) throw new TypeError("Expected a YAML list of bags");
  return doc.map((entry, index) => {
    const result = bagSchema.safeParse(entry);
    if (!result.success) throw new TypeError(`bag ${index}: ${result.error.message}`);
    return result.data;
  });
}
