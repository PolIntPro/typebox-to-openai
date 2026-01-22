import { Type } from "typebox"
import { describe, test, expect } from "vitest"
import { ConvertToOpenAISchema } from "../"

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
                            id: { type: ["string", "null"], format: "uuid" },
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
})
