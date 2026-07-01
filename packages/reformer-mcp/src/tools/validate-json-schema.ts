/**
 * Tool `validate_json_schema` — программная проверка form-DSL JSON-схемы
 * (`@reformer/renderer-json`) до рендера. Обёртка над `validateFormSchema`
 * из subpath `@reformer/renderer-json/validate` (там изолирован ajv).
 *
 * Даёт агенту objective-обратную связь: структура узлов + синтаксис операторов
 * (`$model/$component/$dataSource`) + неизвестные имена компонентов/data-source.
 */

/** Контракт `validateFormSchema` из `@reformer/renderer-json/validate`. */
interface ValidateFormSchemaFn {
  (
    schema: unknown,
    opts?: { componentNames?: string[]; dataSourceNames?: string[] }
  ): { valid: boolean; errors: string[] };
}

export const validateJsonSchemaToolDefinition = {
  name: 'validate_json_schema',
  description:
    'Validate a @reformer/renderer-json form-DSL JSON schema before rendering. Checks node structure, operator syntax ($model/$component/$dataSource), and — when component/dataSource names are supplied — that every $component(...)/$dataSource(...) name is known. Returns { valid, errors }. Call it on the JSON schema you generated (target renderer-json) before handing it off. Pass componentNames/dataSourceNames matching the registry you will build.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      schema: {
        description:
          'The form-DSL JSON schema to validate. Accepts a JSON object or a JSON string (will be parsed).',
      },
      componentNames: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Names registered as components in your registry (e.g. ["Input","Select","Box","FormField"]). Enables unknown-$component(...) detection. Omit to skip name checks.',
      },
      dataSourceNames: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Names registered as data sources (e.g. ["LOAN_TYPES","GENDERS"]). Enables unknown-$dataSource(...) detection. Omit to skip name checks.',
      },
    },
    required: ['schema'],
  },
};

export interface ValidateJsonSchemaArgs {
  schema: unknown;
  componentNames?: string[];
  dataSourceNames?: string[];
}

export async function validateJsonSchemaTool(
  args: ValidateJsonSchemaArgs
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // Accept a JSON string as well as a parsed object.
  let schema = args.schema;
  if (typeof schema === 'string') {
    try {
      schema = JSON.parse(schema);
    } catch (e) {
      return text(
        `# JSON schema — parse error\n\nThe \`schema\` argument was a string but is not valid JSON: ${(e as Error).message}`
      );
    }
  }

  // Lazily load the validator; ajv lives behind this subpath and the package
  // must be built. Fail gracefully rather than crashing the server.
  let validateFormSchema: ValidateFormSchemaFn;
  try {
    const mod = (await import('@reformer/renderer-json/validate')) as {
      validateFormSchema: ValidateFormSchemaFn;
    };
    validateFormSchema = mod.validateFormSchema;
  } catch (e) {
    return text(
      '# validate_json_schema unavailable\n\n' +
        'Could not load `@reformer/renderer-json/validate`. Ensure `@reformer/renderer-json` ' +
        'is installed and built (`npm run build -w @reformer/renderer-json`).\n\n' +
        `Underlying error: ${(e as Error).message}`
    );
  }

  const { valid, errors } = validateFormSchema(schema, {
    componentNames: args.componentNames,
    dataSourceNames: args.dataSourceNames,
  });

  if (valid) {
    return text(
      '# JSON schema — ✅ valid\n\nNo structural, operator-syntax, or unknown-name errors.'
    );
  }
  return text(
    `# JSON schema — ❌ invalid (${errors.length} error${errors.length === 1 ? '' : 's'})\n\n` +
      errors.map((e) => `- ${e}`).join('\n')
  );
}

function text(message: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: message }] };
}
