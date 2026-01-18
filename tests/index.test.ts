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
})
