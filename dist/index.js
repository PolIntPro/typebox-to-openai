function IsAnyOf(schema) {
    return "anyOf" in schema
}
function IsObject(schema) {
    return (
        "type" in schema &&
        (schema["type"] === "object" ||
            (Array.isArray(schema["type"]) &&
                schema["type"].includes("object")))
    )
}
function IsDefsObject(schema) {
    return "$defs" in schema && "$ref" in schema
}
function IsArray(schema) {
    return (
        "type" in schema &&
        (schema["type"] === "array" ||
            (Array.isArray(schema["type"]) && schema["type"].includes("array")))
    )
}
function IsRef(schema) {
    return "$ref" in schema
}
/**
 *
 * @param schema
 * @returns A copy of the schema object that was passed with any refs changed to reference
 * the new location of where refs are defined and with all $defs removed
 */
function moveDefsToRoot(schema, allDefs) {
    const result = {
        ...schema,
        // $id seems to break OpenAI API, so make sure it is always undefined at all levels
        $id: undefined,
    }
    if (IsAnyOf(result)) {
        /*
        If we have anyOf, we extract both children and combine the types.

        For example:
        { anyOf: [ { type: "object", properties: { ... } }, { type: "null" } ] }
        becomes
        { type: ["object", "null"], properties: { ... } }
        */
        console.debug(
            "Schema is anyOf, combining types",
            JSON.stringify(result, null, 4)
        )
        // Should be the object definition and null, in which case we'll mutate the object and recurse
        const anyOfVals = result["anyOf"]
        let actualObject = null
        let foundNull = false
        for (const val of anyOfVals) {
            if ("type" in val && val["type"] !== "null") {
                actualObject = val
            } else {
                foundNull = true
            }
        }
        if (foundNull && actualObject !== null && anyOfVals.length === 2) {
            actualObject["type"] = [actualObject["type"], "null"]
        } else {
            console.error(
                "Did not find expected values in anyOf",
                JSON.stringify(anyOfVals, null, 4)
            )
            throw new Error("Did not find expected values in anyOf")
        }
        // Recurse on the extracted type
        return moveDefsToRoot(actualObject, allDefs)
    }
    if (IsDefsObject(result)) {
        // This result should be moved to the $defs root
        console.debug(
            "Object contains $defs, extracting to defs and recursing",
            result
        )
        const { $defs: schemaDefs, $ref: schemaRef } = result
        for (const schemaId of Object.keys(schemaDefs)) {
            allDefs[schemaId] = moveDefsToRoot(schemaDefs[schemaId], allDefs)
        }
        return {
            $ref: `#/$defs/${schemaRef}`,
        }
    }
    if (IsRef(result)) {
        // If schema is a simple ref, ensure the path is updated and return it
        if (!result["$ref"].startsWith("#/")) {
            result["$ref"] = `#/$defs/${result["$ref"]}`
        }
    }
    if (IsObject(result)) {
        console.debug("Processing object", JSON.stringify(result, null, 4))
        const props = result.properties
        for (const propName in props) {
            console.debug(
                "Processing object",
                propName,
                JSON.stringify(props[propName], null, 4)
            )
            const childProp = moveDefsToRoot(props[propName], allDefs)
            // allDefs = { ...allDefs, ...childDefs }
            result.properties[propName] = childProp
        }
    }
    if (IsArray(result)) {
        result.items = moveDefsToRoot(result.items, allDefs)
        return result
    }
    return result
}
export function ConvertToOpenAISchema(inputSchema, schemaName) {
    const schema = JSON.parse(JSON.stringify(inputSchema))
    const PromptSchema = {
        name: schemaName,
        strict: true,
        schema: schema,
    }
    const rootDefs = {}
    const finalSchema = moveDefsToRoot(schema, rootDefs)
    return {
        ...PromptSchema,
        schema: {
            ...PromptSchema.schema,
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
