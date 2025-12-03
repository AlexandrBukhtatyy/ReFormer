export const getImportsToolDefinition = {
  name: 'get_imports',
  description:
    'Get the correct import statements for ReFormer. Returns proper imports for types and functions by category.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        description: 'Category of imports: "validation", "behaviors", "core", "react", or "all"',
        enum: ['validation', 'behaviors', 'core', 'react', 'all'],
      },
    },
    required: ['category'],
  },
};

interface ImportCategory {
  category: string;
  description: string;
  types: {
    source: string;
    imports: string[];
  };
  functions: {
    source: string;
    imports: string[];
  };
  fullExample: string;
}

const importCategories: Record<string, ImportCategory> = {
  validation: {
    category: 'validation',
    description: 'Validation schema and validators',
    types: {
      source: '@reformer/core',
      imports: ['ValidationSchemaFn', 'FieldPath', 'ValidationError'],
    },
    functions: {
      source: '@reformer/core/validators',
      imports: [
        'required',
        'min',
        'max',
        'minLength',
        'maxLength',
        'email',
        'pattern',
        'url',
        'phone',
        'validate',
        'validateTree',
        'when',
      ],
    },
    fullExample: `import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import { required, min, max, minLength, email, validate, validateTree, when } from '@reformer/core/validators';`,
  },
  behaviors: {
    category: 'behaviors',
    description: 'Behavior schema and behavior functions',
    types: {
      source: '@reformer/core',
      imports: ['BehaviorSchemaFn', 'FieldPath'],
    },
    functions: {
      source: '@reformer/core/behaviors',
      imports: [
        'computeFrom',
        'enableWhen',
        'disableWhen',
        'copyFrom',
        'syncFields',
        'watchField',
        'setFieldValue',
      ],
    },
    fullExample: `import type { BehaviorSchemaFn, FieldPath } from '@reformer/core';
import { computeFrom, enableWhen, disableWhen, watchField, copyFrom } from '@reformer/core/behaviors';`,
  },
  core: {
    category: 'core',
    description: 'Core form creation and types',
    types: {
      source: '@reformer/core',
      imports: [
        'GroupNodeWithControls',
        'FieldNode',
        'ArrayNode',
        'FormFields',
        'FieldPath',
        'ValidationSchemaFn',
        'BehaviorSchemaFn',
      ],
    },
    functions: {
      source: '@reformer/core',
      imports: ['createForm', 'GroupNode'],
    },
    fullExample: `import { createForm, GroupNode } from '@reformer/core';
import type { GroupNodeWithControls, FieldNode, FieldPath } from '@reformer/core';`,
  },
  react: {
    category: 'react',
    description: 'React hooks and components',
    types: {
      source: '@reformer/core',
      imports: ['FieldNode', 'GroupNodeWithControls'],
    },
    functions: {
      source: '@reformer/core',
      imports: ['useFormControl', 'useFormState', 'useFieldState'],
    },
    fullExample: `import { useFormControl, useFormState, createForm } from '@reformer/core';
import type { FieldNode, GroupNodeWithControls } from '@reformer/core';`,
  },
};

export async function getImportsTool(args: {
  category: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { category } = args;
  const normalized = category.toLowerCase().trim();

  if (normalized === 'all') {
    let response = `# ReFormer Imports Reference\n\n`;
    response += `## ⚠️ CRITICAL: Import Locations\n\n`;
    response += `| What | Where |\n`;
    response += `|------|-------|\n`;
    response += `| **Types** (ValidationSchemaFn, BehaviorSchemaFn, FieldNode, etc.) | \`@reformer/core\` |\n`;
    response += `| **Validator functions** (required, min, email, etc.) | \`@reformer/core/validators\` |\n`;
    response += `| **Behavior functions** (computeFrom, enableWhen, etc.) | \`@reformer/core/behaviors\` |\n`;
    response += `| **React hooks** (useFormControl, useFormState) | \`@reformer/core\` |\n`;
    response += `| **Form creation** (createForm, GroupNode) | \`@reformer/core\` |\n\n`;

    response += `---\n\n`;

    for (const [key, cat] of Object.entries(importCategories)) {
      response += `## ${key.charAt(0).toUpperCase() + key.slice(1)}\n\n`;
      response += `${cat.description}\n\n`;
      response += `\`\`\`typescript\n${cat.fullExample}\n\`\`\`\n\n`;
    }

    response += `## Complete Example\n\n`;
    response += `\`\`\`typescript\n`;
    response += `// Types - always from @reformer/core\n`;
    response += `import type {\n`;
    response += `  ValidationSchemaFn,\n`;
    response += `  BehaviorSchemaFn,\n`;
    response += `  FieldPath,\n`;
    response += `  GroupNodeWithControls,\n`;
    response += `  FieldNode,\n`;
    response += `} from '@reformer/core';\n\n`;
    response += `// Core functions\n`;
    response += `import { createForm, useFormControl } from '@reformer/core';\n\n`;
    response += `// Validators - from /validators submodule\n`;
    response += `import { required, min, max, email, validate } from '@reformer/core/validators';\n\n`;
    response += `// Behaviors - from /behaviors submodule\n`;
    response += `import { computeFrom, enableWhen, watchField } from '@reformer/core/behaviors';\n`;
    response += `\`\`\`\n\n`;

    response += `## ❌ Common Mistakes\n\n`;
    response += `\`\`\`typescript\n`;
    response += `// ❌ WRONG - types are not in submodules\n`;
    response += `import { ValidationSchemaFn } from '@reformer/core/validators';\n`;
    response += `import { BehaviorSchemaFn } from '@reformer/core/behaviors';\n\n`;
    response += `// ✅ CORRECT - types are in main module\n`;
    response += `import type { ValidationSchemaFn, BehaviorSchemaFn } from '@reformer/core';\n`;
    response += `\`\`\`\n`;

    return {
      content: [{ type: 'text', text: response }],
    };
  }

  const cat = importCategories[normalized];
  if (!cat) {
    return {
      content: [
        {
          type: 'text',
          text: `Category "${category}" not found.\n\nAvailable categories: validation, behaviors, core, react, all`,
        },
      ],
    };
  }

  let response = `## ${cat.category.charAt(0).toUpperCase() + cat.category.slice(1)} Imports\n\n`;
  response += `${cat.description}\n\n`;

  response += `### Types\n`;
  response += `Source: \`${cat.types.source}\`\n\n`;
  response += `\`\`\`typescript\n`;
  response += `import type { ${cat.types.imports.join(', ')} } from '${cat.types.source}';\n`;
  response += `\`\`\`\n\n`;

  response += `### Functions\n`;
  response += `Source: \`${cat.functions.source}\`\n\n`;
  response += `\`\`\`typescript\n`;
  response += `import { ${cat.functions.imports.join(', ')} } from '${cat.functions.source}';\n`;
  response += `\`\`\`\n\n`;

  response += `### Full Example\n\n`;
  response += `\`\`\`typescript\n${cat.fullExample}\n\`\`\`\n`;

  return {
    content: [{ type: 'text', text: response }],
  };
}
