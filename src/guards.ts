import type { TArray, TObject, TRef, TSchema } from "typebox/type"
import type { TAnyOf, TObjectWithDefs } from "./types.js"

/** Type guard — returns `true` when the schema contains an `anyOf` array. */
export function IsAnyOf(schema: TSchema): schema is TAnyOf {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "anyOf" in schema &&
        Array.isArray((schema as TAnyOf).anyOf)
    )
}

/** Type guard — returns `true` when the schema has `type: "object"` (or includes `"object"` in a type array). */
export function IsObject(schema: TSchema): schema is TObject {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "type" in schema &&
        (schema["type"] === "object" ||
            (Array.isArray(schema["type"]) &&
                schema["type"].includes("object")))
    )
}

/** Type guard — returns `true` when the schema contains a `$defs` block. */
export function IsDefsObject(schema: TSchema): schema is TObjectWithDefs {
    return typeof schema === "object" && schema !== null && "$defs" in schema
}

/** Type guard — returns `true` when the schema has `type: "array"` (or includes `"array"` in a type array). */
export function IsArray(schema: TSchema): schema is TArray<TSchema> {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "type" in schema &&
        (schema["type"] === "array" ||
            (Array.isArray(schema["type"]) && schema["type"].includes("array")))
    )
}

/** Type guard — returns `true` when the schema contains a `$ref` pointer. */
export function IsRef(schema: TSchema): schema is TRef {
    return typeof schema === "object" && schema !== null && "$ref" in schema
}

/** Type guard — returns `true` when the schema contains an `allOf` array (intersection). */
export function IsAllOf(
    schema: TSchema
): schema is TSchema & { allOf: TSchema[] } {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "allOf" in schema &&
        Array.isArray((schema as Record<string, unknown>).allOf)
    )
}

/** Type guard — returns `true` when the schema contains a `oneOf` array (exclusive union). */
export function IsOneOf(
    schema: TSchema
): schema is TSchema & { oneOf: TSchema[] } {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "oneOf" in schema &&
        Array.isArray((schema as Record<string, unknown>).oneOf)
    )
}

/** Type guard — returns `true` when the schema contains a `not` keyword (negation). */
export function IsNot(schema: TSchema): schema is TSchema & { not: TSchema } {
    return typeof schema === "object" && schema !== null && "not" in schema
}
