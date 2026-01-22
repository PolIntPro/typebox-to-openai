# typebox-to-openai

Convert TypeBox schemas into OpenAI Structured Output schemas. The converter lifts `$defs` to the root, normalizes `$ref` paths, and keeps schemas compatible with the OpenAI API's JSON Schema expectations.

## Install

```bash
pnpm add typebox-to-openai
# or
npm install typebox-to-openai
```

## Usage

```ts
import { Type } from "typebox"
import { ConvertToOpenAISchema } from "typebox-to-openai"

const User = Type.Object(
    {
        id: Type.String({ format: "uuid" }),
        name: Type.String(),
        tags: Type.Array(Type.String()),
    },
    { additionalProperties: false }
)

const promptSchema = ConvertToOpenAISchema(User, "User")
```

`promptSchema` is shaped like:

```json
{
    "name": "User",
    "strict": true,
    "schema": {
        "type": "object",
        "properties": {
            "id": { "type": "string", "format": "uuid" },
            "name": { "type": "string" },
            "tags": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["id", "name", "tags"],
        "additionalProperties": false
    }
}
```

## API

### `ConvertToOpenAISchema(inputSchema, schemaName)`

Returns an object containing:

- `name`: prompt schema name
- `strict`: always `true`
- `schema`: OpenAI Structured Output-compatible schema

## Notes

- `$id` fields are removed at all levels to avoid OpenAI API validation issues.
- `$ref` values are normalized to `#/$defs/...`.
- `anyOf` unions that include `null` are merged into a single schema with a nullable `type` array.

## Development

- Run tests: `pnpm test`
- Build: `pnpm build`

## License

MIT. See `LICENSE`.
