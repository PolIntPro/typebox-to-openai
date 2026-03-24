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

### Using with OpenAI

Pass the converted schema directly to the OpenAI API as a `response_format`:

```ts
import OpenAI from "openai"
import { Type } from "typebox"
import { ConvertToOpenAISchema } from "typebox-to-openai"

const schema = Type.Object(
    {
        title: Type.String(),
        count: Type.Number(),
        isActive: Type.Boolean(),
    },
    { additionalProperties: false }
)

const promptSchema = ConvertToOpenAISchema(schema, "MySchema")

const client = new OpenAI()
const response = await client.responses.create({
    model: "gpt-4o",
    input: "Return a JSON object that matches the provided schema.",
    text: {
        format: {
            type: "json_schema",
            name: promptSchema.name,
            strict: true,
            schema: promptSchema.schema,
        },
    },
})
```

### Nullable unions

A `Type.Union([Type.Object(...), Type.Null()])` with exactly one object branch and one null branch is merged into a single schema with a nullable `type` array:

```ts
const NullableObject = Type.Object(
    {
        maybe: Type.Union([
            Type.Object({ id: Type.Number() }, { additionalProperties: false }),
            Type.Null(),
        ]),
    },
    { additionalProperties: false }
)

const result = ConvertToOpenAISchema(NullableObject, "NullableObject")
// result.schema.properties.maybe.type === ["object", "null"]
```

Unions with multiple object branches, non-object types, or no null branch are preserved as `anyOf` arrays.

### Cyclic and recursive schemas

TypeBox `Type.Cyclic` and `Type.Ref` schemas are supported. Nested `$defs` are lifted to the root level and bare `$ref` values are rewritten to `#/$defs/...` paths:

```ts
const TreeNode = Type.Cyclic(
    {
        TreeNode: Type.Object(
            {
                value: Type.String(),
                children: Type.Array(Type.Ref("TreeNode")),
            },
            { additionalProperties: false }
        ),
    },
    "TreeNode"
)

const result = ConvertToOpenAISchema(TreeNode, "TreeNode")
// result.schema.$defs.TreeNode exists
// children.items.$ref === "#/$defs/TreeNode"
```

## API

### `ConvertToOpenAISchema(inputSchema, schemaName, options?)`

Returns an object containing:

| Property | Type     | Description                                     |
| -------- | -------- | ----------------------------------------------- |
| `name`   | `string` | The schema name passed in                       |
| `strict` | `true`   | Always `true`                                   |
| `schema` | `object` | OpenAI Structured Output-compatible JSON schema |

#### Options

The optional third argument accepts:

| Option   | Type                               | Description                                                                                           |
| -------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `debug`  | `boolean`                          | When `true`, logs to the console via `console.debug`, `console.info`, `console.warn`, `console.error` |
| `logger` | `{ debug?, info?, warn?, error? }` | Custom logger object — each method is optional and receives `(...args: unknown[])`                    |

If both `logger` and `debug` are provided, `logger` takes precedence.

## Schema transformations

The converter applies these transformations recursively:

- **`$defs` lifting** — nested `$defs` blocks are collected and moved to the root-level `$defs` of the output schema.
- **`$ref` normalization** — bare ref values like `"Child"` are rewritten to `"#/$defs/Child"`. External refs (`https://...`), absolute refs (`/...`), and JSON pointer refs (`#/...`) are left unchanged.
- **`$id` removal** — `$id` fields are removed at all levels to avoid OpenAI API validation errors.
- **Nullable object merging** — `anyOf` unions with exactly one object branch and one null branch are merged into `{ type: ["object", "null"], ... }`.
- **Immutability** — the input schema is never mutated; a new object is always returned.

## Development

```bash
pnpm install          # install dependencies
pnpm build            # compile TypeScript
pnpm test             # run unit tests
pnpm lint             # lint with ESLint
pnpm prettify         # format with Prettier
```

### Integration tests

The integration test suite (`tests/openai.integration.test.ts`) makes real API calls to OpenAI and is skipped by default. To run it:

```bash
OPENAI_API_KEY=sk-... pnpm test
```

Optional env vars:

| Variable          | Default                     | Description                        |
| ----------------- | --------------------------- | ---------------------------------- |
| `OPENAI_API_KEY`  | —                           | Required to run integration tests  |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | API base URL                       |
| `OPENAI_MODEL`    | `gpt-5.2`                   | Model to use for structured output |

## License

MIT. See `LICENSE`.
