import { Type } from "typebox"
import { describe, test, expect } from "vitest"
import type { TPromptSchema, TLogger, TConvertOptions } from "../index"
import type { TSchema } from "typebox/type"
import { ConvertToOpenAISchema } from "../index"

const CyclicType = Type.Cyclic(
    {
        CyclicType: Type.Object(
            {
                id: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
                name: Type.String(),
                children: Type.Array(Type.Ref("CyclicType"), {
                    description: "A list of child cyclic types",
                }),
                dates: Type.Array(Type.String()),
                someUnion: Type.Union([
                    Type.Object(
                        {
                            propA: Type.String(),
                        },
                        { additionalProperties: false }
                    ),
                    Type.Object(
                        {
                            propB: Type.Number(),
                        },
                        { additionalProperties: false }
                    ),
                ]),
            },
            {
                additionalProperties: false,
            }
        ),
    },
    "CyclicType"
)

const RootType = Type.Object(
    {
        id: Type.String(),
        data: CyclicType,
    },
    {
        additionalProperties: false,
    }
)

const SimpleSchema = Type.Object(
    {
        title: Type.String(),
        count: Type.Number(),
        isActive: Type.Boolean(),
    },
    {
        additionalProperties: false,
    }
)

const NullableObjectSchema = Type.Object(
    {
        maybe: Type.Union([
            Type.Object(
                {
                    id: Type.Number(),
                },
                { additionalProperties: false }
            ),
            Type.Null(),
        ]),
    },
    { additionalProperties: false }
)

const AnyOfNoNullSchema = Type.Object(
    {
        value: Type.Union([Type.String(), Type.Number()]),
    },
    { additionalProperties: false }
)

describe("index tests", () => {
    test("Convert simple schema", () => {
        const expectedResult = {
            name: "SimpleSchema",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    count: { type: "number" },
                    isActive: { type: "boolean" },
                },
                required: ["title", "count", "isActive"],
                additionalProperties: false,
            },
        }

        expect(ConvertToOpenAISchema(SimpleSchema, "SimpleSchema")).toEqual(
            expectedResult
        )
    })

    test("Verify schema transformation", () => {
        const expectedResult = {
            name: "SchemaName",
            strict: true,
            schema: {
                $defs: {
                    CyclicType: {
                        type: "object",
                        properties: {
                            id: {
                                anyOf: [
                                    { type: "string", format: "uuid" },
                                    { type: "null" },
                                ],
                            },
                            name: { type: "string" },
                            children: {
                                type: "array",
                                items: { $ref: "#/$defs/CyclicType" },
                                description: "A list of child cyclic types",
                            },
                            dates: { type: "array", items: { type: "string" } },
                            someUnion: {
                                anyOf: [
                                    {
                                        type: "object",
                                        properties: {
                                            propA: { type: "string" },
                                        },
                                        required: ["propA"],
                                        additionalProperties: false,
                                    },
                                    {
                                        type: "object",
                                        properties: {
                                            propB: { type: "number" },
                                        },
                                        required: ["propB"],
                                        additionalProperties: false,
                                    },
                                ],
                            },
                        },
                        required: [
                            "id",
                            "name",
                            "children",
                            "dates",
                            "someUnion",
                        ],
                        additionalProperties: false,
                    },
                },
                type: "object",
                properties: {
                    id: { type: "string" },
                    data: { $ref: "#/$defs/CyclicType" },
                },
                required: ["id", "data"],
                additionalProperties: false,
            },
        }

        expect(ConvertToOpenAISchema(RootType, "SchemaName")).toEqual(
            expectedResult
        )
    })

    test("Merge anyOf with null into a nullable object type", () => {
        const expectedResult = {
            name: "NullableObjectSchema",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    maybe: {
                        type: ["object", "null"],
                        properties: {
                            id: { type: "number" },
                        },
                        required: ["id"],
                        additionalProperties: false,
                    },
                },
                required: ["maybe"],
                additionalProperties: false,
            },
        }

        expect(
            ConvertToOpenAISchema(NullableObjectSchema, "NullableObjectSchema")
        ).toEqual(expectedResult)
    })

    test("Preserve anyOf unions that do not include null", () => {
        const expectedResult = {
            name: "AnyOfNoNullSchema",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    value: {
                        anyOf: [{ type: "string" }, { type: "number" }],
                    },
                },
                required: ["value"],
                additionalProperties: false,
            },
        }

        expect(
            ConvertToOpenAISchema(AnyOfNoNullSchema, "AnyOfNoNullSchema")
        ).toEqual(expectedResult)
    })

    test("Rewrites non-root $ref paths in nested objects", () => {
        const inputSchema = {
            type: "object",
            properties: {
                child: { $ref: "Child" },
            },
            required: ["child"],
            additionalProperties: false,
        }

        const expectedResult = {
            name: "RefRewriteSchema",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    child: { $ref: "#/$defs/Child" },
                },
                required: ["child"],
                additionalProperties: false,
            },
        }

        expect(ConvertToOpenAISchema(inputSchema, "RefRewriteSchema")).toEqual(
            expectedResult
        )
    })

    test("Throws when anyOf contains null but no object types", () => {
        const badSchema = {
            anyOf: [{ type: "null" }, { type: "null" }],
        }

        expect(() => ConvertToOpenAISchema(badSchema, "BadSchema")).toThrow(
            "Unsupported anyOf union with only null branches at #"
        )
    })

    test("Preserves anyOf with multiple object branches and null", () => {
        const multiObjectSchema = Type.Object(
            {
                value: Type.Union([
                    Type.Object(
                        { a: Type.String() },
                        { additionalProperties: false }
                    ),
                    Type.Object(
                        { b: Type.Number() },
                        { additionalProperties: false }
                    ),
                    Type.Null(),
                ]),
            },
            { additionalProperties: false }
        )

        const expectedResult = {
            name: "MultiObjectSchema",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    value: {
                        anyOf: [
                            {
                                type: "object",
                                properties: { a: { type: "string" } },
                                required: ["a"],
                                additionalProperties: false,
                            },
                            {
                                type: "object",
                                properties: { b: { type: "number" } },
                                required: ["b"],
                                additionalProperties: false,
                            },
                            { type: "null" },
                        ],
                    },
                },
                required: ["value"],
                additionalProperties: false,
            },
        }

        expect(
            ConvertToOpenAISchema(multiObjectSchema, "MultiObjectSchema")
        ).toEqual(expectedResult)
    })

    test("Preserves anyOf with non-object types and null", () => {
        const schema = Type.Object(
            {
                value: Type.Union([Type.String(), Type.Null()]),
            },
            { additionalProperties: false }
        )

        const expectedResult = {
            name: "StringOrNullSchema",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    value: {
                        anyOf: [{ type: "string" }, { type: "null" }],
                    },
                },
                required: ["value"],
                additionalProperties: false,
            },
        }

        expect(ConvertToOpenAISchema(schema, "StringOrNullSchema")).toEqual(
            expectedResult
        )
    })

    test("Collects root $defs without $ref", () => {
        const schemaWithDefs = {
            type: "object",
            properties: {
                child: { $ref: "#/$defs/Child" },
            },
            required: ["child"],
            additionalProperties: false,
            $defs: {
                Child: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                    },
                    required: ["id"],
                    additionalProperties: false,
                },
            },
        }

        const expectedResult = {
            name: "RootDefsSchema",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    child: { $ref: "#/$defs/Child" },
                },
                required: ["child"],
                additionalProperties: false,
                $defs: {
                    Child: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                        },
                        required: ["id"],
                        additionalProperties: false,
                    },
                },
            },
        }

        expect(ConvertToOpenAISchema(schemaWithDefs, "RootDefsSchema")).toEqual(
            expectedResult
        )
    })

    test("Processes tuple items in arrays", () => {
        const tupleSchema = {
            type: "array",
            items: [{ $ref: "Child" }, { type: "string" }],
        }

        const expectedResult = {
            name: "TupleSchema",
            strict: true,
            schema: {
                type: "array",
                items: [{ $ref: "#/$defs/Child" }, { type: "string" }],
            },
        }

        expect(ConvertToOpenAISchema(tupleSchema, "TupleSchema")).toEqual(
            expectedResult
        )
    })

    test("Preserves external and JSON pointer refs", () => {
        const schema = {
            type: "object",
            properties: {
                external: { $ref: "https://example.com/schema.json" },
                internal: { $ref: "#/components/schemas/Thing" },
            },
            required: ["external", "internal"],
            additionalProperties: false,
        }

        const expectedResult = {
            name: "ExternalRefSchema",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    external: { $ref: "https://example.com/schema.json" },
                    internal: { $ref: "#/components/schemas/Thing" },
                },
                required: ["external", "internal"],
                additionalProperties: false,
            },
        }

        expect(ConvertToOpenAISchema(schema, "ExternalRefSchema")).toEqual(
            expectedResult
        )
    })

    test("Exported types are importable", () => {
        const options: TConvertOptions = {
            debug: true,
        }
        const logger: TLogger = {
            debug: () => undefined,
        }
        const optionsWithLogger: TConvertOptions = { logger }
        const result: TPromptSchema = ConvertToOpenAISchema(
            SimpleSchema,
            "SimpleSchema",
            options
        )
        expect(result.name).toBe("SimpleSchema")
        expect(result.strict).toBe(true)

        // Use optionsWithLogger to avoid unused variable lint error
        expect(optionsWithLogger.logger).toBeDefined()
    })

    test("Throws on boolean schema value", () => {
        expect(() =>
            ConvertToOpenAISchema(true as unknown as TSchema, "BoolSchema")
        ).toThrow("Unsupported schema")
    })

    test("Throws on multi-entry allOf", () => {
        const schema = {
            allOf: [
                { type: "object", properties: { a: { type: "string" } }, required: ["a"], additionalProperties: false },
                { type: "object", properties: { b: { type: "number" } }, required: ["b"], additionalProperties: false },
            ],
        }
        expect(() => ConvertToOpenAISchema(schema, "AllOfSchema")).toThrow(
            'Unsupported schema type "allOf" at #'
        )
    })

    test("Flattens single-entry allOf", () => {
        const schema = {
            type: "object",
            properties: {
                child: { allOf: [{ $ref: "Foo" }] },
            },
            required: ["child"],
            additionalProperties: false,
        }
        const result = ConvertToOpenAISchema(schema, "SingleAllOf")
        expect((result.schema as Record<string, unknown>).properties).toEqual({
            child: { $ref: "#/$defs/Foo" },
        })
    })

    test("Flattens single-entry allOf with sibling keywords", () => {
        const schema = {
            type: "object",
            properties: {
                child: {
                    allOf: [{ type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false }],
                    description: "A child object",
                },
            },
            required: ["child"],
            additionalProperties: false,
        }
        const result = ConvertToOpenAISchema(schema, "AllOfSibling")
        const props = (result.schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>
        expect(props.child.description).toBe("A child object")
        expect(props.child.type).toBe("object")
        expect(props.child.allOf).toBeUndefined()
    })

    test("Throws on oneOf nested in property", () => {
        const schema = {
            type: "object",
            properties: {
                value: {
                    oneOf: [{ type: "string" }, { type: "number" }],
                },
            },
            required: ["value"],
            additionalProperties: false,
        }
        expect(() => ConvertToOpenAISchema(schema, "OneOfSchema")).toThrow(
            'Unsupported schema type "oneOf" at #/properties/value'
        )
    })

    test("Throws on not", () => {
        const schema = {
            type: "object",
            properties: {
                value: {
                    not: { type: "string" },
                },
            },
            required: ["value"],
            additionalProperties: false,
        }
        expect(() => ConvertToOpenAISchema(schema, "NotSchema")).toThrow(
            'Unsupported schema type "not" at #/properties/value'
        )
    })

    test("Throws on array without items", () => {
        const schema = {
            type: "object",
            properties: {
                tags: { type: "array" },
            },
            required: ["tags"],
            additionalProperties: false,
        }
        expect(() => ConvertToOpenAISchema(schema, "NoItemsArray")).toThrow(
            'Unsupported schema: array type requires "items" at #/properties/tags'
        )
    })

    test("Throws on unrecognized leaf node", () => {
        const schema = {
            type: "object",
            properties: {
                mystery: { description: "no type here" },
            },
            required: ["mystery"],
            additionalProperties: false,
        }
        expect(() => ConvertToOpenAISchema(schema, "LeafSchema")).toThrow(
            'Unsupported schema: missing "type", "$ref", "anyOf", "const", or "enum" at #/properties/mystery'
        )
    })

    test("Throws on $defs key collision", () => {
        const schema = {
            type: "object",
            properties: {
                a: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                    },
                    required: ["id"],
                    additionalProperties: false,
                    $defs: {
                        Shared: {
                            type: "object",
                            properties: { x: { type: "string" } },
                            required: ["x"],
                            additionalProperties: false,
                        },
                    },
                },
                b: {
                    type: "object",
                    properties: {
                        id: { type: "number" },
                    },
                    required: ["id"],
                    additionalProperties: false,
                    $defs: {
                        Shared: {
                            type: "object",
                            properties: { y: { type: "number" } },
                            required: ["y"],
                            additionalProperties: false,
                        },
                    },
                },
            },
            required: ["a", "b"],
            additionalProperties: false,
        }
        expect(() => ConvertToOpenAISchema(schema, "CollisionSchema")).toThrow(
            'Duplicate $defs key "Shared"'
        )
    })

    test("Does not mutate input schema", () => {
        const inputSchema = {
            type: "object",
            properties: {
                child: { $ref: "Child" },
            },
            required: ["child"],
            additionalProperties: false,
        }

        const originalSnapshot = JSON.parse(JSON.stringify(inputSchema))

        ConvertToOpenAISchema(inputSchema, "MutationCheckSchema")

        expect(inputSchema).toEqual(originalSnapshot)
    })

    test("Works with no options", () => {
        expect(() =>
            ConvertToOpenAISchema(SimpleSchema, "SimpleSchema")
        ).not.toThrow()
    })

    test("Works with undefined options", () => {
        expect(() =>
            ConvertToOpenAISchema(SimpleSchema, "SimpleSchema", undefined)
        ).not.toThrow()
    })

    test("debug: true enables console logging without throwing", () => {
        expect(() =>
            ConvertToOpenAISchema(SimpleSchema, "SimpleSchema", { debug: true })
        ).not.toThrow()
    })

    test("Custom logger receives error calls on unsupported schema", () => {
        const errorCalls: unknown[][] = []
        const logger: TLogger = {
            error: (...args: unknown[]) => errorCalls.push(args),
        }
        const badSchema = {
            type: "object",
            properties: {
                value: { oneOf: [{ type: "string" }, { type: "number" }] },
            },
            required: ["value"],
            additionalProperties: false,
        }
        expect(() =>
            ConvertToOpenAISchema(badSchema, "BadSchema", { logger })
        ).toThrow()
        expect(errorCalls.length).toBeGreaterThan(0)
    })

    test("Custom logger is accepted without throwing", () => {
        const logger: TLogger = {
            debug: () => undefined,
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
        }
        expect(() =>
            ConvertToOpenAISchema(SimpleSchema, "SimpleSchema", { logger })
        ).not.toThrow()
    })

    test("Type.Integer() passes through as {type: 'integer'}", () => {
        const schema = Type.Object(
            { count: Type.Integer() },
            { additionalProperties: false }
        )
        const result = ConvertToOpenAISchema(schema, "IntegerSchema")
        const props = (result.schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>
        expect(props.count.type).toBe("integer")
    })

    test("Type.Literal() passes through as const value", () => {
        const schema = Type.Object(
            { status: Type.Literal("active") },
            { additionalProperties: false }
        )
        const result = ConvertToOpenAISchema(schema, "LiteralSchema")
        const props = (result.schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>
        expect(props.status.const).toBe("active")
    })

    test("Union of Literals produces anyOf with const values", () => {
        const schema = Type.Object(
            {
                color: Type.Union([
                    Type.Literal("red"),
                    Type.Literal("green"),
                    Type.Literal("blue"),
                ]),
            },
            { additionalProperties: false }
        )
        const result = ConvertToOpenAISchema(schema, "UnionLiteralSchema")
        const props = (result.schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>
        expect(props.color.anyOf).toBeDefined()
    })

    test("Type.Enum() passes through with enum array", () => {
        enum Color { Red = "red", Green = "green", Blue = "blue" }
        const schema = Type.Object(
            { color: Type.Enum(Color) },
            { additionalProperties: false }
        )
        const result = ConvertToOpenAISchema(schema, "EnumSchema")
        const props = (result.schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>
        // TypeBox Type.Enum() produces { enum: [...] } which passes through as-is
        expect(props.color.enum).toBeDefined()
    })

    test("Type.Optional() omits property from required array", () => {
        const schema = Type.Object(
            {
                name: Type.String(),
                nickname: Type.Optional(Type.String()),
            },
            { additionalProperties: false }
        )
        const result = ConvertToOpenAISchema(schema, "OptionalSchema")
        const s = result.schema as Record<string, unknown>
        expect(s.required).toEqual(["name"])
        const props = s.properties as Record<string, Record<string, unknown>>
        expect(props.nickname).toBeDefined()
        expect(props.nickname.type).toBe("string")
    })
})
