import type { TArray, TObject, TRef, TSchema } from "typebox/type"

type TObjectWithDefs = TSchema & {
    $defs: Record<string, TSchema>
}

type TAnyOf = {
    anyOf: TSchema[]
}

export interface TPromptSchema {
    name: string
    strict: true
    schema: TSchema
}

export type TLogger = {
    debug?: (...args: unknown[]) => void
    info?: (...args: unknown[]) => void
    warn?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
}

export type TConvertOptions = {
    logger?: TLogger
    debug?: boolean
}

function IsAnyOf(schema: TSchema): schema is TAnyOf {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "anyOf" in schema &&
        Array.isArray((schema as TAnyOf).anyOf)
    )
}

function IsObject(schema: TSchema): schema is TObject {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "type" in schema &&
        (schema["type"] === "object" ||
            (Array.isArray(schema["type"]) &&
                schema["type"].includes("object")))
    )
}

function IsDefsObject(schema: TSchema): schema is TObjectWithDefs {
    return typeof schema === "object" && schema !== null && "$defs" in schema
}

function IsArray(schema: TSchema): schema is TArray<TSchema> {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "type" in schema &&
        (schema["type"] === "array" ||
            (Array.isArray(schema["type"]) && schema["type"].includes("array")))
    )
}

function IsRef(schema: TSchema): schema is TRef {
    return typeof schema === "object" && schema !== null && "$ref" in schema
}

function createLogger(options?: TConvertOptions): Required<TLogger> {
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

function formatPath(path: string[]): string {
    return path.length === 0 ? "#" : `#/${path.join("/")}`
}

function shouldRewriteRef(ref: string): boolean {
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

function mergeTypeWithNull(typeValue: unknown): unknown[] {
    if (Array.isArray(typeValue)) {
        return typeValue.includes("null") ? typeValue : [...typeValue, "null"]
    }
    if (typeof typeValue === "string") {
        return [typeValue, "null"]
    }
    return ["null"]
}

function withClearedId(
    original: TSchema,
    next: Record<string, unknown>
): Record<string, unknown> {
    return typeof original === "object" &&
        original !== null &&
        "$id" in original
        ? { ...next, $id: undefined }
        : next
}

function removeDefs(schema: TSchema): {
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

/**
 *
 * @param schema
 * @returns A copy of the schema object that was passed with any refs changed to reference
 * the new location of where refs are defined and with all $defs removed
 */
function moveDefsToRoot(
    schema: TSchema,
    allDefs: Record<string, TSchema>,
    logger: Required<TLogger>,
    path: string[] = []
): TSchema {
    if (typeof schema !== "object" || schema === null) {
        return schema
    }

    const { schema: schemaWithoutDefs, defs } = removeDefs(schema)

    if (defs) {
        for (const [schemaId, defSchema] of Object.entries(defs)) {
            allDefs[schemaId] = moveDefsToRoot(
                defSchema,
                allDefs,
                logger,
                path.concat(["$defs", schemaId])
            )
        }
    }

    if (IsAnyOf(schemaWithoutDefs)) {
        const anyOfVals = schemaWithoutDefs.anyOf.map((val, index) =>
            moveDefsToRoot(
                val,
                allDefs,
                logger,
                path.concat(["anyOf", String(index)])
            )
        )

        const nullSchemas = anyOfVals.filter(
            (val) =>
                typeof val === "object" &&
                val !== null &&
                "type" in val &&
                val.type === "null"
        )
        const nonNullSchemas = anyOfVals.filter(
            (val) =>
                !(
                    typeof val === "object" &&
                    val !== null &&
                    "type" in val &&
                    val.type === "null"
                )
        )
        const objectSchemas = nonNullSchemas.filter(IsObject)
        const hasNonObject = nonNullSchemas.some((val) => !IsObject(val))

        if (nullSchemas.length > 0 && nonNullSchemas.length === 0) {
            const formattedPath = formatPath(path)
            logger.error(
                "Unsupported anyOf union with only null branches",
                formattedPath
            )
            throw new Error(
                `Unsupported anyOf union with only null branches at ${formattedPath}`
            )
        }

        if (
            nullSchemas.length > 0 &&
            !hasNonObject &&
            objectSchemas.length === 1 &&
            anyOfVals.length === 2
        ) {
            const baseObject = objectSchemas[0]
            return withClearedId(baseObject, {
                ...baseObject,
                type: mergeTypeWithNull(baseObject.type),
            }) as TSchema
        }

        return withClearedId(schemaWithoutDefs, {
            ...schemaWithoutDefs,
            anyOf: anyOfVals,
        }) as TSchema
    }

    if (IsRef(schemaWithoutDefs)) {
        const normalizedRef = shouldRewriteRef(schemaWithoutDefs.$ref)
            ? `#/$defs/${schemaWithoutDefs.$ref}`
            : schemaWithoutDefs.$ref

        return withClearedId(schemaWithoutDefs, {
            ...schemaWithoutDefs,
            $ref: normalizedRef,
        }) as TSchema
    }

    if (IsObject(schemaWithoutDefs)) {
        const props = schemaWithoutDefs.properties
        const nextProps = props ? ({} as Record<string, TSchema>) : props

        if (props) {
            for (const propName of Object.keys(props)) {
                nextProps[propName] = moveDefsToRoot(
                    props[propName] as TSchema,
                    allDefs,
                    logger,
                    path.concat(["properties", propName])
                )
            }
        }

        const nextSchema =
            props !== undefined
                ? { ...schemaWithoutDefs, properties: nextProps }
                : { ...schemaWithoutDefs }

        return withClearedId(schemaWithoutDefs, nextSchema) as TSchema
    }

    if (IsArray(schemaWithoutDefs)) {
        const items = schemaWithoutDefs.items
        const nextItems = Array.isArray(items)
            ? items.map((item, index) =>
                  moveDefsToRoot(
                      item,
                      allDefs,
                      logger,
                      path.concat(["items", String(index)])
                  )
              )
            : items
              ? moveDefsToRoot(items, allDefs, logger, path.concat(["items"]))
              : items

        const nextSchema =
            items !== undefined
                ? { ...schemaWithoutDefs, items: nextItems }
                : { ...schemaWithoutDefs }

        return withClearedId(schemaWithoutDefs, nextSchema) as TSchema
    }

    return withClearedId(schemaWithoutDefs, {
        ...schemaWithoutDefs,
    }) as TSchema
}

export function ConvertToOpenAISchema(
    inputSchema: TSchema,
    schemaName: string,
    options?: TConvertOptions
): TPromptSchema {
    const logger = createLogger(options)

    const PromptSchema: TPromptSchema = {
        name: schemaName,
        strict: true,
        schema: inputSchema,
    }

    const rootDefs: Record<string, TSchema> = {}
    const finalSchema = moveDefsToRoot(inputSchema, rootDefs, logger)

    return {
        ...PromptSchema,
        schema: {
            ...finalSchema,
            ...(Object.keys(rootDefs).length > 0
                ? {
                      $defs: {
                          ...rootDefs,
                      },
                  }
                : {}),
        } as TObjectWithDefs,
    }
}
