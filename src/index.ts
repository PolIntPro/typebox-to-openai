import type { TSchema, TArray, TObject, TRef, TNull } from "typebox"

type TObjectWithDefs = TRef & {
    $defs: Record<string, TObject>
}

type TAnyObject = TObject | TRef | TObjectWithDefs | TArray | TRef | TNull

type TAnyOf = {
    anyOf: TAnyObject[]
}

type TAnything = TAnyObject | TAnyOf

interface TPromptSchema {
    name: string
    strict: true
    schema: TAnyObject
}

function IsAnyOf(schema: TSchema): schema is TAnyOf {
    return "anyOf" in schema
}

function IsObject(schema: TSchema): schema is TObject {
    return (
        "type" in schema &&
        (schema["type"] === "object" ||
            (Array.isArray(schema["type"]) &&
                schema["type"].includes("object")))
    )
}

function IsDefsObject(schema: TSchema): schema is TObjectWithDefs {
    return "$defs" in schema && "$ref" in schema
}

function IsArray(schema: TSchema): schema is TArray<TAnyObject> {
    return (
        "type" in schema &&
        (schema["type"] === "array" ||
            (Array.isArray(schema["type"]) && schema["type"].includes("array")))
    )
}

function IsRef(schema: TSchema): schema is TRef {
    return "$ref" in schema
}

/**
 *
 * @param schema
 * @returns A copy of the schema object that was passed with any refs changed to reference
 * the new location of where refs are defined and with all $defs removed
 */
export function moveDefsToRoot<T extends TAnything>(
    schema: T,
    allDefs: Record<string, TAnyObject>
): TAnyObject {
    const result: T = {
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
        let actualObject: Record<string, any> | null = null
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
        return moveDefsToRoot(actualObject as TAnyObject, allDefs)
    }

    if (IsDefsObject(result)) {
        // This result should be moved to the $defs root
        console.debug(
            "Object contains $defs, extracting to defs and recursing",
            result
        )

        const { $defs: schemaDefs, $ref: schemaRef } = result
        for (const schemaId of Object.keys(schemaDefs!)) {
            allDefs[schemaId as string] = moveDefsToRoot(
                schemaDefs![schemaId],
                allDefs
            )
        }

        return {
            $ref: `#/$defs/${schemaRef}`,
        } as unknown as TAnyObject
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
            const childProp = moveDefsToRoot(
                props[propName] as TObject,
                allDefs
            )

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

export function ConvertToOpenAISchema(
    inputSchema: any,
    schemaName: string
): TPromptSchema {
    const schema = JSON.parse(JSON.stringify(inputSchema)) as TObject

    const PromptSchema: TPromptSchema = {
        name: schemaName,
        strict: true,
        schema: schema,
    }

    const rootDefs: Record<string, TAnyObject> = {}
    const finalSchema = moveDefsToRoot(schema, rootDefs)

    return {
        ...PromptSchema,
        schema: {
            ...PromptSchema.schema,
            ...finalSchema,
            $defs: {
                ...rootDefs,
            },
        } as TObjectWithDefs,
    }
}
