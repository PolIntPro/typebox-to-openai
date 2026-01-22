function IsAnyOf(schema) {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "anyOf" in schema &&
        Array.isArray(schema.anyOf)
    )
}
function IsObject(schema) {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "type" in schema &&
        (schema["type"] === "object" ||
            (Array.isArray(schema["type"]) &&
                schema["type"].includes("object")))
    )
}
function IsDefsObject(schema) {
    return typeof schema === "object" && schema !== null && "$defs" in schema
}
function IsArray(schema) {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "type" in schema &&
        (schema["type"] === "array" ||
            (Array.isArray(schema["type"]) && schema["type"].includes("array")))
    )
}
function IsRef(schema) {
    return typeof schema === "object" && schema !== null && "$ref" in schema
}
function createLogger(options) {
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
function formatPath(path) {
    return path.length === 0 ? "#" : `#/${path.join("/")}`
}
function shouldRewriteRef(ref) {
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
function mergeTypeWithNull(typeValue) {
    if (Array.isArray(typeValue)) {
        return typeValue.includes("null") ? typeValue : [...typeValue, "null"]
    }
    if (typeof typeValue === "string") {
        return [typeValue, "null"]
    }
    return ["null"]
}
function withClearedId(original, next) {
    return typeof original === "object" &&
        original !== null &&
        "$id" in original
        ? { ...next, $id: undefined }
        : next
}
function removeDefs(schema) {
    if (!IsDefsObject(schema)) {
        return { schema }
    }
    const defs = schema.$defs
    const { $defs: _removed, ...schemaWithoutDefs } = schema
    return { schema: schemaWithoutDefs, defs }
}
/**
 *
 * @param schema
 * @returns A copy of the schema object that was passed with any refs changed to reference
 * the new location of where refs are defined and with all $defs removed
 */
function moveDefsToRoot(schema, allDefs, logger, path = []) {
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
            })
        }
        return withClearedId(schemaWithoutDefs, {
            ...schemaWithoutDefs,
            anyOf: anyOfVals,
        })
    }
    if (IsRef(schemaWithoutDefs)) {
        const normalizedRef = shouldRewriteRef(schemaWithoutDefs.$ref)
            ? `#/$defs/${schemaWithoutDefs.$ref}`
            : schemaWithoutDefs.$ref
        return withClearedId(schemaWithoutDefs, {
            ...schemaWithoutDefs,
            $ref: normalizedRef,
        })
    }
    if (IsObject(schemaWithoutDefs)) {
        const props = schemaWithoutDefs.properties
        const nextProps = props ? {} : props
        if (props) {
            for (const propName of Object.keys(props)) {
                nextProps[propName] = moveDefsToRoot(
                    props[propName],
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
        return withClearedId(schemaWithoutDefs, nextSchema)
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
        return withClearedId(schemaWithoutDefs, nextSchema)
    }
    return withClearedId(schemaWithoutDefs, {
        ...schemaWithoutDefs,
    })
}
export function ConvertToOpenAISchema(inputSchema, schemaName, options) {
    const logger = createLogger(options)
    const PromptSchema = {
        name: schemaName,
        strict: true,
        schema: inputSchema,
    }
    const rootDefs = {}
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
        },
    }
}
