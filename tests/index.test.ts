import { ConvertToOpenAISchema } from "src"
import { Type } from "typebox"
import { describe, test, expect } from "vitest"

const CyclicType = Type.Cyclic(
    {
        CyclicType: Type.Object(
            {
                name: Type.String(),
                children: Type.Array(Type.Ref("CyclicType"), {
                    description: "A list of child cyclic types",
                }),
                dates: Type.Array(Type.String()),
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

describe("index tests", () => {
    test("Verify schema transformation", () => {
        const expectedResult = {
            name: "SchemaName",
            strict: true,
            schema: {
                $defs: {
                    CyclicType: {
                        $id: "CyclicType",
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            children: {
                                type: "array",
                                items: { $ref: "#/$defs/CyclicType" },
                                description: "A list of child cyclic types",
                            },
                            dates: { type: "array", items: { type: "string" } },
                        },
                        required: ["name", "children", "dates"],
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
