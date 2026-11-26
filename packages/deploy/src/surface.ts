import { z } from "zod";
import { NEVER_PUBLIC } from "./never-public.ts";
import type { Problem } from "./problems.ts";
import { byCodeUnit } from "./walk.ts";

/**
 * Check 1 (privacy-wall design v2, section 5). The catalogue schemas protect by stripping, so their declared keys are
 * the ceiling of what the build can read. These functions walk `z.toJSONSchema(schema, { io: "output" })` for every
 * export of a module that is a Zod schema; other exports are ignored.
 */

type JsonSchema = boolean | { readonly [key: string]: unknown };

/** What one walk of a JSON Schema finds: leaf types by path, every object key, and every open shape. */
interface Walked {
  leaves: Map<string, Set<string>>;
  keys: Array<{ path: string; key: string }>;
  open: Set<string>;
  /** Object or non-empty array fallbacks (`.default()`, `.catch()`): returned without parsing. */
  unsafeDefaults: Set<string>;
  /** Records whose keys are not a fixed list. */
  openRecords: Set<string>;
}

function isObject(value: unknown): value is { readonly [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A Zod 4 schema carries its internals under `_zod`; anything else a module exports is ignored. */
function isZodSchema(value: unknown): value is z.ZodType {
  return typeof value === "object" && value !== null && "_zod" in value;
}

/**
 * Catalogue exports that are not schemas but may be exported beside them. Anything else a schema module exports
 * is `surface-unknown-export`: a schema nested in an object, array or function would escape the walk. Adding a
 * name is a never-auto-merge change.
 */
export const SURFACE_CONSTANTS: readonly string[] = ["FABRICS"];

/** Whether `value` holds a Zod schema at any depth of plain objects and arrays. */
function holdsSchema(value: unknown, seen: Set<unknown> = new Set()): boolean {
  if (isZodSchema(value)) return true;
  if (typeof value !== "object" || value === null || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((inner) => holdsSchema(inner, seen));
}

/**
 * Exports that are neither a Zod schema nor a `SURFACE_CONSTANTS` entry, and allow-listed constants that hold a
 * schema: each is a `surface-unknown-export` problem at its export name.
 */
export function unknownExports(
  module: Readonly<Record<string, unknown>>,
  allowed: readonly string[] = SURFACE_CONSTANTS,
): Problem[] {
  return Object.keys(module)
    .filter((name) => {
      const value = module[name];
      if (isZodSchema(value)) return false;
      return !allowed.includes(name) || holdsSchema(value);
    })
    .sort(byCodeUnit)
    .map((path) => ({ path, rule: "surface-unknown-export" }));
}

/** Each Zod schema the module exports, by export name in code-unit order, as output-side JSON Schema. */
/** The JSON Schema of an export, or undefined when Zod cannot represent it (`z.date()`, a transform, ...). */
function toJsonSchema(value: z.ZodType): JsonSchema | undefined {
  try {
    // An empty registry: registered metadata (`.meta()`, `.describe()`) is overlaid on the generated shape, so
    // `.meta({ properties })` could hide a field from every check below (sol security r3, S5-2).
    return z.toJSONSchema(value, { io: "output", metadata: z.registry() }) as JsonSchema;
  } catch {
    return undefined;
  }
}

function exportedSchemas(module: Readonly<Record<string, unknown>>): Array<[string, JsonSchema]> {
  return Object.keys(module)
    .sort(byCodeUnit)
    .flatMap((name) => {
      const value = module[name];
      const schema = isZodSchema(value) ? toJsonSchema(value) : undefined;
      return schema === undefined ? [] : [[name, schema] as [string, JsonSchema]];
    });
}

/**
 * Schema exports Zod cannot turn into JSON Schema, each a `schema-unrepresentable` problem at its export name. The
 * other walks skip them, so check 1 names the export instead of stopping on the conversion error.
 */
export function schemaConversionProblems(module: Readonly<Record<string, unknown>>): Problem[] {
  return Object.keys(module)
    .sort(byCodeUnit)
    .filter((name) => {
      const value = module[name];
      return isZodSchema(value) && toJsonSchema(value) === undefined;
    })
    .map((path) => ({ path, rule: "schema-unrepresentable" }));
}

function walkSchema(name: string, root: JsonSchema): Walked {
  const found: Walked = {
    leaves: new Map(),
    keys: [],
    open: new Set(),
    unsafeDefaults: new Set(),
    openRecords: new Set(),
  };
  const defs = isObject(root) && isObject(root.$defs) ? root.$defs : {};
  const leaf = (path: string, type: string): void => {
    const types = found.leaves.get(path) ?? new Set<string>();
    types.add(type);
    found.leaves.set(path, types);
  };
  const visit = (node: unknown, path: string, refs: ReadonlySet<string>): void => {
    if (node === false) return;
    if (!isObject(node)) {
      // `true`, or anything that is not a schema object: accepts anything.
      found.open.add(path);
      leaf(path, "unknown");
      return;
    }
    if ("default" in node) {
      const fallback = node.default;
      if (typeof fallback === "object" && fallback !== null && !(Array.isArray(fallback) && fallback.length === 0)) {
        found.unsafeDefaults.add(path);
      }
    }
    if (typeof node.$ref === "string") {
      const ref = node.$ref;
      if (refs.has(ref)) {
        leaf(path, "object");
        return;
      }
      const target = ref === "#" ? root : ref.startsWith("#/$defs/") ? defs[ref.slice("#/$defs/".length)] : undefined;
      if (target === undefined) {
        found.open.add(path);
        leaf(path, "unknown");
        return;
      }
      visit(target, path, new Set([...refs, ref]));
      return;
    }
    const alternatives = [node.anyOf, node.oneOf, node.allOf].filter(Array.isArray).flat();
    for (const alternative of alternatives) visit(alternative, path, refs);
    const types = typeof node.type === "string" ? [node.type] : Array.isArray(node.type) ? node.type.map(String) : [];
    if (types.length === 0) {
      if (alternatives.length > 0) return;
      if ("const" in node) {
        leaf(path, jsonType(node.const));
        return;
      }
      if (Array.isArray(node.enum)) {
        for (const value of node.enum) leaf(path, jsonType(value));
        return;
      }
      // No type, no alternatives, no fixed value: `any` or `unknown`.
      found.open.add(path);
      leaf(path, "unknown");
      return;
    }
    for (const type of types) {
      if (type === "object") visitObject(node, path, refs);
      else if (type === "array") visitArray(node, path, refs);
      else leaf(path, type);
    }
  };
  const visitObject = (node: { readonly [key: string]: unknown }, path: string, refs: ReadonlySet<string>): void => {
    const properties = isObject(node.properties) ? node.properties : {};
    const keys = Object.keys(properties).sort(byCodeUnit);
    for (const key of keys) {
      found.keys.push({ path, key });
      visit(properties[key], `${path}.${key}`, refs);
    }
    const extra = node.additionalProperties;
    const listed = new Set(keys);
    // Names in `required` that `properties` does not list: Zod writes an enum-keyed record's keys there.
    const required = (Array.isArray(node.required) ? node.required : []).filter(
      (name): name is string => typeof name === "string" && !listed.has(name),
    );
    if ("propertyNames" in node) {
      // A record. Fixed key names (an enum or literal key schema) are keys like any other, each with the value
      // schema; any other key schema makes the values readable at `.*`. Either way the values must be closed.
      const named = fixedKeys(node.propertyNames);
      const fixed = [...new Set([...named.keys, ...required])].filter((k) => !listed.has(k)).sort(byCodeUnit);
      for (const key of fixed) {
        found.keys.push({ path, key });
        visit(extra ?? true, `${path}.${key}`, refs);
      }
      if (named.rest) found.openRecords.add(path);
      if (named.rest || fixed.length === 0) visit(extra ?? true, `${path}.*`, refs);
      return;
    }
    for (const key of required) found.keys.push({ path, key });
    // A loose or catch-all object (or one with no `additionalProperties`) lets unlisted keys through.
    if (extra !== false) found.open.add(path);
    if (keys.length === 0) leaf(path, "object");
  };
  const fixedKeys = (names: unknown): { keys: string[]; rest: boolean } => {
    if (!isObject(names)) return { keys: [], rest: true };
    const branches = [names.anyOf, names.oneOf].filter(Array.isArray).flat();
    if (branches.length > 0) {
      const parts = branches.map(fixedKeys);
      return { keys: parts.flatMap((p) => p.keys), rest: parts.some((p) => p.rest) };
    }
    if (typeof names.const === "string") return { keys: [names.const], rest: false };
    if (Array.isArray(names.enum)) {
      const values = names.enum.filter((v): v is string => typeof v === "string");
      return { keys: values, rest: values.length !== names.enum.length };
    }
    return { keys: [], rest: true };
  };
  const visitArray = (node: { readonly [key: string]: unknown }, path: string, refs: ReadonlySet<string>): void => {
    const items = [
      ...(Array.isArray(node.prefixItems) ? node.prefixItems : []),
      ...("items" in node ? [node.items] : []),
    ];
    if (items.length === 0) visit(true, `${path}[]`, refs);
    for (const item of items) visit(item, `${path}[]`, refs);
  };
  visit(root, name, new Set());
  return found;
}

function jsonType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

function sortProblems(problems: Problem[]): Problem[] {
  const unique = new Map(problems.map((p) => [`${p.path}\u0000${p.rule}`, p]));
  return [...unique.values()].sort((a, b) => byCodeUnit(a.path, b.path));
}

/**
 * The readable surface: one `"<export>.<path>: <type>"` line per leaf, sorted by code unit. Object keys join with
 * `.`, an array's items add `[]`, a record's values add `.*`. The type is the JSON Schema type; several types (a
 * union, or a nullable) are sorted and joined with `|`.
 */
export function publicSurface(module: Readonly<Record<string, unknown>>): string[] {
  const lines: string[] = [];
  for (const [name, schema] of exportedSchemas(module)) {
    for (const [path, types] of walkSchema(name, schema).leaves)
      lines.push(`${path}: ${[...types].sort(byCodeUnit).join("|")}`);
  }
  return lines.sort(byCodeUnit);
}

/** A key as the deny-list compares it: lower case, without `_` or `-`. */
function normalise(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, "");
}

const NEVER_PUBLIC_KEYS = new Set(NEVER_PUBLIC.map(normalise));

/** A key on the list, or a plural of one (`orderReferences`, `shippingAddresses`). */
function isNeverPublic(key: string): boolean {
  const k = normalise(key);
  return (
    NEVER_PUBLIC_KEYS.has(k) ||
    (k.endsWith("es") && NEVER_PUBLIC_KEYS.has(k.slice(0, -2))) ||
    (k.endsWith("s") && NEVER_PUBLIC_KEYS.has(k.slice(0, -1)))
  );
}

/**
 * Keys on the never-public list (`never-public.ts`) or their plurals, compared without case, `_` or `-`, at any
 * depth. A key is
 * reported whether its value is a leaf or an object, by its full path.
 */
export function neverPublicFields(module: Readonly<Record<string, unknown>>): Problem[] {
  const problems: Problem[] = [];
  for (const [name, schema] of exportedSchemas(module)) {
    for (const { path, key } of walkSchema(name, schema).keys) {
      if (isNeverPublic(key)) problems.push({ path: `${path}.${key}`, rule: "never-public-name" });
    }
  }
  return sortProblems(problems);
}

/**
 * Open shapes: `any`, `unknown`, loose or catch-all objects, and records whose value schema is not closed. A
 * stripping or strict object passes; a record passes when its values are closed.
 */
export function openShapes(module: Readonly<Record<string, unknown>>): Problem[] {
  const problems: Problem[] = [];
  for (const [name, schema] of exportedSchemas(module)) {
    for (const path of walkSchema(name, schema).open) problems.push({ path, rule: "open-shape" });
  }
  return sortProblems(problems);
}

/**
 * Two shapes the surface walk cannot vouch for. `unsafe-default`: an object or non-empty array `.default()` or
 * `.catch()` fallback, which Zod returns without parsing, so it can hold keys the shape never declares (use
 * `.prefault()`, which is parsed). `open-record`: a record keyed by any string or pattern, whose keys cannot be
 * checked against the never-public names; key it by an enum or literals instead.
 */
export function strictnessProblems(module: Readonly<Record<string, unknown>>): Problem[] {
  const problems: Problem[] = [];
  for (const [name, schema] of exportedSchemas(module)) {
    const walked = walkSchema(name, schema);
    for (const path of walked.unsafeDefaults) problems.push({ path, rule: "unsafe-default" });
    for (const path of walked.openRecords) problems.push({ path, rule: "open-record" });
  }
  return sortProblems(problems);
}

type ZodDef = { readonly [key: string]: unknown; readonly type?: unknown; readonly checks?: unknown };

function defOf(schema: z.ZodType): ZodDef {
  return (schema as unknown as { _zod: { def: ZodDef } })._zod.def;
}

/**
 * The check kinds that only validate: lengths and sizes, string formats and patterns (`regex`, `includes`,
 * `startsWith`, `endsWith`, `email`, `iso.date` and the rest are all `string_format`), number comparisons and
 * formats, `multipleOf`, MIME types, and the metadata-only `describe` and `meta`. Any other kind is refused:
 * `overwrite` (`.overwrite()`, `.trim()`, `.toLowerCase()`) replaces the value, and `custom` (`refine`,
 * `superRefine`, `.check()` with a function) hands it to a callback that can change it in place.
 */
const VALIDATE_ONLY_CHECKS: ReadonlySet<unknown> = new Set([
  "less_than",
  "greater_than",
  "multiple_of",
  "number_format",
  "bigint_format",
  "max_size",
  "min_size",
  "size_equals",
  "max_length",
  "min_length",
  "length_equals",
  "string_format",
  "mime_type",
  "describe",
  "meta",
]);

/** The tag Zod 4.6.7 puts on the function it wraps a constant `.catch()` value in (`core/util.js:867`). */
const CONSTANT_CATCH = "~constantCatch";

/**
 * A node that can change its output after parsing: a check kind outside `VALIDATE_ONLY_CHECKS`, a transform, a
 * codec, `z.custom()`, a function-valued `.catch()`, or any `.default()` or `.prefault()`.
 */
function rewritesOutput(def: ZodDef): boolean {
  if (def.type === "transform" || def.type === "custom") return true;
  if (def.type === "pipe" && typeof def.transform === "function") return true;
  if (def.type === "catch" && typeof def.catchValue === "function" && !(CONSTANT_CATCH in def.catchValue)) return true;
  // Any default or prefault (sol security r3, S5-3): Zod returns a default unvalidated, and a function default can
  // return one thing when inspected and private data later. No public schema uses either.
  if (def.type === "default" || def.type === "prefault") return true;
  const checks = Array.isArray(def.checks) ? def.checks : [];
  return checks.some((check) => !isZodSchema(check) || !VALIDATE_ONLY_CHECKS.has(defOf(check).check));
}

/**
 * Schemas that can change their output after parsing (security-sol r2, S2-5): any check outside the validate-only
 * allow-list (overwrites such as `.trim()`, and `refine`, `superRefine` and `.check()` callbacks), a transform
 * (`.transform()`, `z.preprocess()`, a pipe into `z.transform()`), a codec, `z.custom()`, a function-valued
 * `.catch()`, and any `.default()` or `.prefault()` (S5-3), at any depth, each a `schema-rewrite` problem. Zod runs these callbacks after the
 * shape is checked while its JSON Schema still shows only the declared shape, so the surface walk cannot see what
 * they add. Walks Zod's own definitions, not the JSON Schema, and each schema once (recursive schemas end).
 */
export function rewriteProblems(module: Readonly<Record<string, unknown>>): Problem[] {
  const problems: Problem[] = [];
  for (const name of Object.keys(module).sort(byCodeUnit)) {
    const value = module[name];
    if (!isZodSchema(value)) continue;
    const seen = new Set<unknown>();
    const visit = (schema: z.ZodType, path: string): void => {
      if (seen.has(schema)) return;
      seen.add(schema);
      const def = defOf(schema);
      if (rewritesOutput(def)) problems.push({ path, rule: "schema-rewrite" });
      if (def.type === "object" && isObject(def.shape)) {
        const shape = def.shape;
        for (const key of Object.keys(shape).sort(byCodeUnit)) {
          const field = shape[key];
          if (isZodSchema(field)) visit(field, `${path}.${key}`);
        }
        if (isZodSchema(def.catchall)) visit(def.catchall, `${path}.*`);
        return;
      }
      if (def.type === "array" && isZodSchema(def.element)) {
        visit(def.element, `${path}[]`);
        return;
      }
      if ((def.type === "record" || def.type === "map") && isZodSchema(def.valueType)) {
        if (isZodSchema(def.keyType)) visit(def.keyType, path);
        visit(def.valueType, `${path}.*`);
        return;
      }
      if (def.type === "lazy" && typeof def.getter === "function") {
        const inner: unknown = def.getter();
        if (isZodSchema(inner)) visit(inner, path);
        return;
      }
      // Every other wrapper (optional, nullable, default, union, intersection, tuple, pipe, ...): its schemas.
      for (const [key, inner] of Object.entries(def)) {
        if (key === "checks") continue;
        for (const candidate of Array.isArray(inner) ? inner : [inner]) {
          if (isZodSchema(candidate)) visit(candidate, path);
        }
      }
    };
    visit(value, name);
  }
  return sortProblems(problems);
}
