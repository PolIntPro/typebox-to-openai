import OpenAI from "openai"
import { describe, expect, test } from "vitest"
import { Type } from "typebox"
import { ConvertToOpenAISchema } from "../index"

// Required env vars: OPENAI_API_KEY (required), OPENAI_BASE_URL (optional), OPENAI_MODEL (optional)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ""
const OPENAI_BASE_URL =
    process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.2"
const OPENAI_TIMEOUT_MS = 15000

const shouldRun = Boolean(OPENAI_API_KEY)
const describeIfConfigured = shouldRun ? describe : describe.skip

type OpenAIResponse = {
    output_text?: string
    output?: Array<{
        content?: Array<{
            type?: string
            text?: string
        }>
    }>
}

function extractOutputText(response: OpenAIResponse): string {
    if (typeof response.output_text === "string") {
        return response.output_text
    }

    const output = response.output ?? []
    for (const item of output) {
        for (const content of item.content ?? []) {
            if (
                content.type === "output_text" &&
                typeof content.text === "string"
            ) {
                return content.text
            }
        }
    }

    return ""
}

async function requestStructuredOutput(
    schemaName: string,
    schema: Record<string, unknown>
) {
    const client = new OpenAI({
        apiKey: OPENAI_API_KEY,
        baseURL: OPENAI_BASE_URL,
    })

    const response = await client.responses.create({
        model: OPENAI_MODEL,
        input: "Return a JSON object that matches the provided schema.",
        text: {
            format: {
                type: "json_schema",
                name: schemaName,
                strict: true,
                schema,
            },
        },
    })

    return response as OpenAIResponse
}

describeIfConfigured("OpenAI integration (optional)", () => {
    test(
        "accepts a simple TypeBox schema as response_format",
        async () => {
            const SimpleSchema = Type.Object(
                {
                    title: Type.String(),
                    count: Type.Number(),
                    isActive: Type.Boolean(),
                },
                { additionalProperties: false }
            )

            const promptSchema = ConvertToOpenAISchema(
                SimpleSchema,
                "SimpleSchema"
            )
            const response = await requestStructuredOutput(
                promptSchema.name,
                promptSchema.schema as Record<string, unknown>
            )
            const text = extractOutputText(response)
            const parsed = JSON.parse(text) as {
                title?: string
                count?: number
                isActive?: boolean
            }

            expect(parsed.title).toBeTypeOf("string")
            expect(parsed.count).toBeTypeOf("number")
            expect(parsed.isActive).toBeTypeOf("boolean")
        },
        OPENAI_TIMEOUT_MS
    )

    test(
        "accepts schemas that include $defs and $ref",
        async () => {
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

            const promptSchema = ConvertToOpenAISchema(
                schemaWithDefs,
                "SchemaWithDefs"
            )
            const response = await requestStructuredOutput(
                promptSchema.name,
                promptSchema.schema as Record<string, unknown>
            )
            const text = extractOutputText(response)
            const parsed = JSON.parse(text) as { child?: { id?: string } }

            expect(parsed.child?.id).toBeTypeOf("string")
        },
        OPENAI_TIMEOUT_MS
    )
})
