import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { detectProjectStack, renderStackDetectionBlock } from '../utils/project-detector.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const planFormPromptDefinition = {
  name: 'plan-form',
  description:
    'Прочитать спеку формы (markdown), проанализировать поля/шаги/behaviors/arrays/API, и вернуть структурированный markdown-план разработки: roadmap из 7 sub-agent стадий, рекомендуемая последовательность других MCP-промптов, risk matrix (cycle-prevention, plain-leaves, hide-vs-disable), verification scenarios для playwright, test fixtures.',
  arguments: [
    {
      name: 'specPath',
      description:
        'Абсолютный или относительный путь к markdown-спеке формы. Например: docs/specs/credit-application-form.md',
      required: true,
    },
    {
      name: 'target',
      description:
        'Целевой стек: "core" | "renderer-react" | "renderer-json". По умолчанию "core".',
      required: false,
    },
    {
      name: 'projectPath',
      description:
        'Путь к каталогу проекта для auto-detection стека (как в create-form). По умолчанию process.cwd().',
      required: false,
    },
  ],
};

interface SpecAnalysis {
  formName: string;
  totalFields: number;
  steps: number;
  fieldsPerStep: Record<string, number>;
  conditionalFields: string[];
  computedFields: string[];
  arrays: string[];
  apiEndpoints: string[];
  hasCanonicalLabels: boolean;
  hasMasks: boolean;
}

function resolveSpecPath(specPath: string): string | null {
  if (existsSync(specPath)) return specPath;
  const cwdRelative = resolve(process.cwd(), specPath);
  if (existsSync(cwdRelative)) return cwdRelative;
  return null;
}

function analyzeSpec(content: string): SpecAnalysis {
  const formName = extractFormName(content);
  const steps = countSteps(content);
  const fieldsPerStep = countFieldsPerStep(content);
  const totalFields = Object.values(fieldsPerStep).reduce((a, b) => a + b, 0);
  const conditionalFields = extractConditionalFields(content);
  const computedFields = extractComputedFields(content);
  const arrays = extractArrays(content);
  const apiEndpoints = extractApiEndpoints(content);
  const hasCanonicalLabels = /## Canonical user-facing strings/i.test(content);
  const hasMasks = /InputMask|маска|mask:\s*['"`]/.test(content);

  return {
    formName,
    totalFields,
    steps,
    fieldsPerStep,
    conditionalFields,
    computedFields,
    arrays,
    apiEndpoints,
    hasCanonicalLabels,
    hasMasks,
  };
}

function extractFormName(content: string): string {
  const titleMatch = content.match(/^#\s+(?:Форма:\s+)?(.+)$/m);
  return titleMatch ? titleMatch[1].trim() : 'Unknown form';
}

function countSteps(content: string): number {
  const stepMatches = content.match(/^###\s+(?:Шаг|Step)\s+\d+[:.]/gim) ?? [];
  if (stepMatches.length === 0) {
    const chipTable = content.match(/Шаг\s+\d+[:.]\s+/g);
    return chipTable ? new Set(chipTable).size : 0;
  }
  return stepMatches.length;
}

function countFieldsPerStep(content: string): Record<string, number> {
  const result: Record<string, number> = {};
  const stepRegex = /^###\s+(?:Шаг|Step)\s+(\d+)[:.]\s*([^\n]*)/gim;
  const matches = Array.from(content.matchAll(stepRegex));
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const stepNum = m[1];
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : content.length;
    const section = content.slice(start, end);
    const htmlRowRegex = new RegExp(`<td>\\s*${stepNum}\\.\\d+\\s*</td>`, 'g');
    const htmlMatches = section.match(htmlRowRegex);
    if (htmlMatches && htmlMatches.length > 0) {
      result[`step${stepNum}`] = htmlMatches.length;
      continue;
    }
    const mdRowMatches = section.match(/^\|(?!\s*[-:|\s]+\|\s*$)[^|\n]+\|/gm) ?? [];
    const fieldCount = Math.max(0, mdRowMatches.length - 1);
    result[`step${stepNum}`] = fieldCount;
  }
  return result;
}

function extractFieldKeyFromTrBlock(trBlock: string): string | null {
  const tdMatches = Array.from(trBlock.matchAll(/<td[^>]*>([^<]+)<\/td>/g));
  for (const m of tdMatches) {
    const cell = m[1].trim();
    if (/^[a-z][a-zA-Z0-9.]*$/.test(cell) && cell.length > 1 && cell.length < 50) {
      return cell;
    }
  }
  return null;
}

function extractConditionalFields(content: string): string[] {
  const patterns: string[] = [];
  const trBlocks = content.match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
  for (const block of trBlocks) {
    if (
      /условн|только если|показ(ыв)?ается если|показ(ыв)?ать если|появля?ется если|зависит от|появ.{1,30}при\s+|if\s+\w+\s*[=!]|when\s+\w+/i.test(
        block
      )
    ) {
      const key = extractFieldKeyFromTrBlock(block);
      if (key && !patterns.includes(key)) patterns.push(key);
    }
  }
  if (patterns.length === 0) {
    const lines = content.split('\n');
    for (const line of lines) {
      if (
        /условн|только если|показывается если|зависит от|appears? when|if\s+\w+\s*[=!]/i.test(line)
      ) {
        const cellMatch = line.match(/^\|\s*([\w.]+)\s*\|/);
        if (cellMatch && !patterns.includes(cellMatch[1])) {
          patterns.push(cellMatch[1]);
        }
      }
    }
  }
  return patterns.slice(0, 30);
}

function extractComputedFields(content: string): string[] {
  const patterns: string[] = [];
  const trBlocks = content.match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
  for (const block of trBlocks) {
    if (/Вычисляется автоматически|вычисляемое|computed|readonly|disabled.*автомат/i.test(block)) {
      const key = extractFieldKeyFromTrBlock(block);
      if (key && !patterns.includes(key)) patterns.push(key);
    }
  }
  if (patterns.length === 0) {
    const lines = content.split('\n');
    for (const line of lines) {
      if (/Вычисляется автоматически|computed|вычисляемое|readonly/i.test(line)) {
        const cellMatch = line.match(/^\|\s*([\w.]+)\s*\|/);
        if (cellMatch && !patterns.includes(cellMatch[1])) {
          patterns.push(cellMatch[1]);
        }
      }
    }
  }
  return patterns.slice(0, 20);
}

function extractArrays(content: string): string[] {
  const patterns: string[] = [];
  const arrayRegex =
    /\b(?:hasProperty|hasExistingLoans|hasCoBorrower|properties|existingLoans|coBorrowers)\b/g;
  const matches = content.match(arrayRegex);
  if (matches) {
    for (const m of matches) {
      if (!patterns.includes(m)) patterns.push(m);
    }
  }
  const genericRegex = /\bмассив|\barray|\bFormArray\b/i;
  if (patterns.length === 0 && genericRegex.test(content)) {
    patterns.push('(см. секцию массивов в спеке)');
  }
  return patterns;
}

function extractApiEndpoints(content: string): string[] {
  const patterns: string[] = [];
  const apiRegex = /(?:GET|POST|PUT|DELETE|PATCH)\s+\/[\w/\-{}:]+/gi;
  const matches = content.match(apiRegex) ?? [];
  for (const m of matches) {
    if (!patterns.includes(m)) patterns.push(m);
  }
  return patterns.slice(0, 15);
}

function buildPlanVars(
  spec: SpecAnalysis,
  stackBlock: string,
  target: string,
  specPathRel: string
): Record<string, unknown> {
  const stepsLine =
    spec.steps > 0
      ? `Multi-step (${spec.steps} шагов): ${Object.entries(spec.fieldsPerStep)
          .map(([s, n]) => `${s}=${n} полей`)
          .join(', ')}`
      : 'Single-page form';

  const conditionalLine =
    spec.conditionalFields.length > 0
      ? spec.conditionalFields.slice(0, 12).join(', ') +
        (spec.conditionalFields.length > 12 ? ` (+${spec.conditionalFields.length - 12})` : '')
      : 'не обнаружено';

  const computedLine =
    spec.computedFields.length > 0
      ? spec.computedFields.slice(0, 12).join(', ') +
        (spec.computedFields.length > 12 ? ` (+${spec.computedFields.length - 12})` : '')
      : 'не обнаружено';

  const arraysLine = spec.arrays.length > 0 ? spec.arrays.join(', ') : 'не обнаружено';

  const apiLine =
    spec.apiEndpoints.length > 0
      ? spec.apiEndpoints.join('\n   - ')
      : 'не обнаружено (или не требует backend)';

  const canonicalLine = spec.hasCanonicalLabels
    ? '✅ Спека содержит "Canonical user-facing strings" таблицу — используй её literally для всех label/placeholder/error messages.'
    : '⚠️ Спека НЕ содержит canonical strings таблицу — попроси оркестратора подтвердить, какие тексты использовать. Не выдумывай свои.';

  const masksLine = spec.hasMasks
    ? '✅ Поля с masks обнаружены — используй `InputMask` из `@reformer/ui-kit` с `componentProps.mask`.'
    : 'Маски не упомянуты.';

  const promptOrder =
    target === 'renderer-react'
      ? '`create-form` (target=renderer-react) → `add-validation` → `add-behavior` → `add-form-array` (renderer-react section) → `add-wizard` (через `schema.node().setHidden()`)'
      : target === 'renderer-json'
        ? '`create-form` (target=renderer-json) → `add-validation` → `add-behavior` → `add-form-array` (renderer-json section с `CreditFormProvider`) → `add-wizard` (через `setHidden` из useEffect)'
        : '`create-form` (target=core) → `add-validation` → `add-behavior` → `add-form-array` (с `useArrayLength` + JSX-conditional) → `add-wizard` (manual `useState currentStep` + `STEP_VALIDATIONS`)';

  return {
    formName: spec.formName,
    totalFields: spec.totalFields,
    steps: spec.steps,
    stepsLine,
    conditionalLine,
    computedLine,
    arraysLine,
    apiLine,
    canonicalLine,
    masksLine,
    stackBlock,
    target,
    specPathRel,
    promptOrder,
    stepsCountText: spec.steps > 0 ? String(spec.steps) : 'все',
    stepsTextOrSix: spec.steps > 0 ? String(spec.steps) : '6',
    stepsTextOrOne: spec.steps > 0 ? String(spec.steps) : '1',
    rendererArtifactSuffix: target !== 'core' ? ' + render-schema' : '',
  };
}

export function getPlanFormPrompt(args: {
  specPath: string;
  target?: string;
  projectPath?: string;
}): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const target = (args.target ?? 'core').toLowerCase();
  const resolvedSpecPath = resolveSpecPath(args.specPath);

  if (!resolvedSpecPath) {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `❌ **plan-form: spec файл не найден**

Передан \`specPath: "${args.specPath}"\`, но файл не существует ни как абсолютный путь, ни относительно \`process.cwd()\` (\`${process.cwd()}\`).

**Что делать:**
1. Проверь, что путь к спеке корректный.
2. Если спека в монорепо — передавай относительный путь от корня репо, например \`docs/specs/credit-application-form.md\`.
3. Передавай \`projectPath\` тоже, если нужно подсказать корень.

Без спеки plan-form не может построить осмысленный roadmap — попроси оркестратора уточнить путь.`,
          },
        },
      ],
    };
  }

  let specContent: string;
  try {
    specContent = readFileSync(resolvedSpecPath, 'utf-8');
  } catch (err) {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `❌ **plan-form: ошибка чтения файла**

\`${resolvedSpecPath}\`: ${err instanceof Error ? err.message : String(err)}

Проверь права доступа.`,
          },
        },
      ],
    };
  }

  const spec = analyzeSpec(specContent);
  const stack = detectProjectStack(args.projectPath);
  const stackBlock = renderStackDetectionBlock(stack);
  const vars = buildPlanVars(spec, stackBlock, target, args.specPath);
  const text = renderPromptTemplate('plan-form', vars);

  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text },
      },
    ],
  };
}
