import type { TSchema } from "typebox/type"
import type { TConvertOptions, TLogger, TObjectWithDefs } from "./types.js"
import { IsDefsObject } from "./guards.js"

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

export function formatPath(path: string[]): string {
    return path.length === 0 ? "#" : `#/${path.join("/")}`
}

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

export function mergeTypeWithNull(typeValue: unknown): unknown[] {
    if (Array.isArray(typeValue)) {
        return typeValue.includes("null") ? typeValue : [...typeValue, "null"]
    }
    if (typeof typeValue === "string") {
        return [typeValue, "null"]
    }
    return ["null"]
}

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
