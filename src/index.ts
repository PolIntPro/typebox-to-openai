import type { TSchema } from "typebox/type"
import type {
    TConvertOptions,
    TLogger,
    TObjectWithDefs,
    TPromptSchema,
} from "./types.js"
import {
    IsAllOf,
    IsAnyOf,
    IsArray,
    IsNot,
    IsObject,
    IsOneOf,
    IsRef,
} from "./guards.js"
import {
    createLogger,
    formatPath,
    mergeTypeWithNull,
    removeDefs,
    shouldRewriteRef,
    withClearedId,
} from "./utils.js"

export type { TPromptSchema, TLogger, TConvertOptions } from "./types.js"

function moveDefsToRoot(
    schema: TSchema,
    allDefs: Record<string, TSchema>,
    logger: Required<TLogger>,
    path: string[] = []
): TSchema {
    if (typeof schema !== "object" || schema === null) {
        const formattedPath = formatPath(path)
        logger.error("Unsupported schema: not an object", formattedPath)
        throw new Error(
            `Unsupported schema: expected an object node at ${formattedPath}`
        )
    }

    const { schema: schemaWithoutDefs, defs } = removeDefs(schema)

    if (defs) {
        for (const [schemaId, defSchema] of Object.entries(defs)) {
            if (schemaId in allDefs) {
                const formattedPath = formatPath(
                    path.concat(["$defs", schemaId])
                )
                logger.error(`Duplicate $defs key "${schemaId}"`, formattedPath)
                throw new Error(
                    `Duplicate $defs key "${schemaId}" at ${formattedPath}`
                )
            }
            allDefs[schemaId] = moveDefsToRoot(
                defSchema,
                allDefs,
                logger,
                path.concat(["$defs", schemaId])
            )
        }
    }

    if (IsAllOf(schemaWithoutDefs)) {
        if (schemaWithoutDefs.allOf.length === 1) {
            const { allOf: _allOf, ...siblings } =
                schemaWithoutDefs as unknown as Record<string, unknown>
            const unwrapped = {
                ...schemaWithoutDefs.allOf[0],
                ...siblings,
            } as TSchema
            return moveDefsToRoot(unwrapped, allDefs, logger, path)
        }
        const formattedPath = formatPath(path)
        logger.error('Unsupported schema type "allOf"', formattedPath)
        throw new Error(`Unsupported schema type "allOf" at ${formattedPath}`)
    }

    if (IsOneOf(schemaWithoutDefs)) {
        const formattedPath = formatPath(path)
        logger.error('Unsupported schema type "oneOf"', formattedPath)
        throw new Error(`Unsupported schema type "oneOf" at ${formattedPath}`)
    }

    if (IsNot(schemaWithoutDefs)) {
        const formattedPath = formatPath(path)
        logger.error('Unsupported schema type "not"', formattedPath)
        throw new Error(`Unsupported schema type "not" at ${formattedPath}`)
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
        if (items === undefined || items === null) {
            const formattedPath = formatPath(path)
            logger.error(
                'Unsupported schema: array type requires "items"',
                formattedPath
            )
            throw new Error(
                `Unsupported schema: array type requires "items" at ${formattedPath}`
            )
        }
        const nextItems = Array.isArray(items)
            ? items.map((item, index) =>
                  moveDefsToRoot(
                      item,
                      allDefs,
                      logger,
                      path.concat(["items", String(index)])
                  )
              )
            : moveDefsToRoot(items, allDefs, logger, path.concat(["items"]))

        const nextSchema =
            items !== undefined
                ? { ...schemaWithoutDefs, items: nextItems }
                : { ...schemaWithoutDefs }

        return withClearedId(schemaWithoutDefs, nextSchema) as TSchema
    }

    const hasType = "type" in schemaWithoutDefs
    const hasConst = "const" in schemaWithoutDefs
    const hasEnum = "enum" in schemaWithoutDefs
    if (!hasType && !hasConst && !hasEnum) {
        const formattedPath = formatPath(path)
        logger.error(
            'Unsupported schema: missing "type", "$ref", "anyOf", "const", or "enum"',
            formattedPath
        )
        throw new Error(
            `Unsupported schema: missing "type", "$ref", "anyOf", "const", or "enum" at ${formattedPath}`
        )
    }

    return withClearedId(schemaWithoutDefs, {
        ...schemaWithoutDefs,
    }) as TSchema
}

/**
 * Convert a TypeBox schema into an OpenAI Structured Output-compatible
 * prompt schema.
 *
 * Transformations applied:
 * - **$defs lifting** — nested `$defs` are collected and moved to the root.
 * - **$ref normalization** — bare refs like `"Child"` are rewritten to `"#/$defs/Child"`.
 *   External, absolute, and JSON Pointer refs are left unchanged.
 * - **$id removal** — `$id` fields are stripped at all levels.
 * - **Nullable object merging** — `anyOf` with one object + one null branch becomes
 *   `{ type: ["object", "null"], ... }`.
 * - **Single-entry allOf flattening** — `{ allOf: [schema] }` is unwrapped to `schema`.
 * - **Immutability** — the input schema is never mutated.
 *
 * @param inputSchema - The TypeBox (or raw JSON Schema) schema to convert.
 * @param schemaName - The name for the prompt schema (used by OpenAI).
 * @param options - Optional logging configuration.
 * @returns A {@link TPromptSchema} ready to pass to the OpenAI API.
 *
 * @throws When the schema contains unsupported constructs:
 *   - Multi-entry `allOf` (intersections)
 *   - `oneOf` or `not`
 *   - Array types without `items`
 *   - Nodes missing `type`, `$ref`, `anyOf`, `const`, or `enum`
 *   - `anyOf` unions with only null branches
 *   - Duplicate `$defs` keys across nested schemas
 */
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
