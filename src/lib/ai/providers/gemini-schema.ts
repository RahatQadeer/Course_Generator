type Json = Record<string, unknown>;

/**
 * Gemini accepts a subset of JSON Schema. Zod's output needs three fixes:
 *   - `$ref`/`$defs` are inlined (Gemini's support is inconsistent)
 *   - `const` becomes a single-value `enum`
 *   - validation-only keywords it rejects are dropped
 * These schemas are acyclic, so inlining always terminates.
 */
export function toGeminiSchema(input: Json): Json {
  const defs = (input.$defs ?? input.definitions ?? {}) as Record<string, Json>;

  const resolve = (ref: string): Json => {
    const key = ref.replace(/^#\/(\$defs|definitions)\//, "");
    const target = defs[key];
    if (!target) throw new Error(`Unresolvable $ref in schema: ${ref}`);
    return target;
  };

  const DROP = new Set([
    "$schema",
    "$id",
    "$comment",
    "$defs",
    "definitions",
    "additionalProperties",
    "unevaluatedProperties",
    "patternProperties",
    "dependentRequired",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    "default",
    "examples",
    "readOnly",
    "writeOnly",
    "contentEncoding",
    "contentMediaType",
    "not",
    "if",
    "then",
    "else",
  ]);

  const walk = (node: unknown, depth: number): unknown => {
    if (depth > 40) return {};
    if (Array.isArray(node)) return node.map((entry) => walk(entry, depth + 1));
    if (!node || typeof node !== "object") return node;

    const source = node as Json;
    if (typeof source.$ref === "string") {
      const { $ref, ...rest } = source;
      return walk({ ...resolve($ref), ...rest }, depth + 1);
    }

    const output: Json = {};
    for (const [key, value] of Object.entries(source)) {
      if (DROP.has(key)) continue;

      if (key === "const") {
        output.enum = [value];
        if (!("type" in source)) output.type = jsonType(value);
        continue;
      }

      if (key === "properties" && value && typeof value === "object") {
        output.properties = Object.fromEntries(
          Object.entries(value as Json).map(([name, schema]) => [name, walk(schema, depth + 1)]),
        );
        continue;
      }

      if (key === "prefixItems") {
        // Gemini has no tuple support; fall back to a homogeneous array.
        const first = Array.isArray(value) ? (value[0] as Json | undefined) : undefined;
        if (first) output.items = walk(first, depth + 1);
        continue;
      }

      output[key] = walk(value, depth + 1);
    }

    // Gemini requires an explicit type on object/array nodes.
    if (!output.type && output.properties) output.type = "object";
    if (!output.type && output.items) output.type = "array";

    // Gemini rejects the whole request when an array of complex objects carries
    // a minItems above ~4 — constrained decoding appears to expand the item
    // schema that many times and blow a budget. The counts are not lost: Zod
    // still enforces them on the response and every prompt states the target
    // explicitly. Bounds on arrays of primitives are cheap, so they stay.
    if (output.type === "array" && hasObjectItems(output)) {
      delete output.minItems;
      delete output.maxItems;
    }

    return output;
  };

  const result = walk(input, 0) as Json;
  return result.type ? result : { ...result, type: "object" };
}

/** True when the array's items are objects, or a union that contains one. */
function hasObjectItems(arraySchema: Json): boolean {
  const items = arraySchema.items;
  if (!items || typeof items !== "object") return false;

  const isObjectish = (node: unknown): boolean => {
    if (!node || typeof node !== "object") return false;
    const schema = node as Json;
    if (schema.type === "object" || schema.properties) return true;
    for (const key of ["anyOf", "oneOf", "allOf"] as const) {
      const branches = schema[key];
      if (Array.isArray(branches) && branches.some(isObjectish)) return true;
    }
    // Nested arrays of objects count too.
    if (schema.type === "array") return isObjectish(schema.items);
    return false;
  };

  return isObjectish(items);
}

function jsonType(value: unknown): string {
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}
