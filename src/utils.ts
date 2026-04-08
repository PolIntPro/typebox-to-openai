import type { TSchema } from "typebox/type"
import type { TConvertOptions, TLogger, TObjectWithDefs } from "./types.js"
import { IsDefsObject } from "./guards.js"

/**
 * Build a fully-populated logger from the given options.
 *
 * Resolution order:
 * 1. If `options.logger` is provided, missing methods become no-ops.
 * 2. If `options.debug` is `true`, all methods delegate to `console`.
 * 3. Otherwise every method is a silent no-op.
 */
export function createLogger(options?: TConvertOptions): Required<TLogger> {
    if (options?.logger) {
        return {
            debug: options.logger.debug ?? (() => undefined),
            info: options.logger.info ?? (() => undefined),
            warn: options.logger.warn ?? (() => undefined),
            error: options.logger.error ?? (() => undefined),
        }
    }

    if (options?.debug) {
        return {
            debug: console.debug.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
        }
    }

    return {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
    }
}

/** Format a path segment array into a JSON Pointer string (e.g. `#/properties/name`). Returns `"#"` for an empty path. */
export function formatPath(path: string[]): string {
    return path.length === 0 ? "#" : `#/${path.join("/")}`
}

/**
 * Determine whether a `$ref` value is a bare ref that needs rewriting.
 *
 * Returns `true` only for simple identifier-like refs (e.g. `"Child"`)
 * that TypeBox emits. External, absolute, and JSON Pointer refs are
 * left alone.
 */
export function shouldRewriteRef(ref: string): boolean {
    if (ref.startsWith("#/")) {
        return false
    }
    if (
        ref.startsWith("http://") ||
        ref.startsWith("https://") ||
        ref.startsWith("file://") ||
        ref.startsWith("/")
    ) {
        return false
    }
    if (ref.includes("#") || ref.includes("/")) {
        return false
    }
    return /^[A-Za-z0-9_.-]+$/.test(ref)
}

/**
 * Ensure `"null"` is present in a JSON Schema `type` value.
 *
 * Handles string (`"object"` → `["object", "null"]`) and array forms,
 * deduplicating when `"null"` is already present.
 */
export function mergeTypeWithNull(typeValue: unknown): unknown[] {
    if (Array.isArray(typeValue)) {
        return typeValue.includes("null") ? typeValue : [...typeValue, "null"]
    }
    if (typeof typeValue === "string") {
        return [typeValue, "null"]
    }
    return ["null"]
}

/**
 * Return `next` with `$id` set to `undefined` when the original schema
 * contained one, effectively stripping the `$id` field from the output.
 */
export function withClearedId(
    original: TSchema,
    next: Record<string, unknown>
): Record<string, unknown> {
    return typeof original === "object" &&
        original !== null &&
        "$id" in original
        ? { ...next, $id: undefined }
        : next
}

/**
 * Separate a schema's `$defs` block (if any) from the rest of the schema.
 *
 * Returns `{ schema, defs }` where `schema` is the input without `$defs`
 * and `defs` is the extracted definitions map (or `undefined` if none existed).
 */
export function removeDefs(schema: TSchema): {
    schema: TSchema
    defs?: Record<string, TSchema>
} {
    if (!IsDefsObject(schema)) {
        return { schema }
    }

    const defs = schema.$defs
    const { $defs: _removed, ...schemaWithoutDefs } = schema as TObjectWithDefs
    return { schema: schemaWithoutDefs as TSchema, defs }
}
