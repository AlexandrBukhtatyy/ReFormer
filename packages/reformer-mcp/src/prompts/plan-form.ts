import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { detectProjectStack, renderStackDetectionBlock } from '../utils/project-detector.js';

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
  // Try absolute path first
  if (existsSync(specPath)) return specPath;
  // Then cwd-relative
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
  // "### Шаг N: ..." (colon) or "### Шаг N. ..." (dot) or "### Step N: ..."
  const stepMatches = content.match(/^###\s+(?:Шаг|Step)\s+\d+[:.]/gim) ?? [];
  if (stepMatches.length === 0) {
    // Fallback: chip-label table в Canonical strings
    const chipTable = content.match(/Шаг\s+\d+[:.]\s+/g);
    return chipTable ? new Set(chipTable).size : 0;
  }
  return stepMatches.length;
}

function countFieldsPerStep(content: string): Record<string, number> {
  // Find each "### Шаг N:" / "### Шаг N." / "### Step N:" section.
  const result: Record<string, number> = {};
  const stepRegex = /^###\s+(?:Шаг|Step)\s+(\d+)[:.]\s*([^\n]*)/gim;
  const matches = Array.from(content.matchAll(stepRegex));
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const stepNum = m[1];
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : content.length;
    const section = content.slice(start, end);
    // Try HTML <td>N.M</td> pattern first (spec uses HTML <table>).
    const htmlRowRegex = new RegExp(`<td>\\s*${stepNum}\\.\\d+\\s*</td>`, 'g');
    const htmlMatches = section.match(htmlRowRegex);
    if (htmlMatches && htmlMatches.length > 0) {
      result[`step${stepNum}`] = htmlMatches.length;
      continue;
    }
    // Fallback: markdown table rows (lines starting with `|` excluding separator).
    const mdRowMatches =
      section.match(/^\|(?!\s*[-:|\s]+\|\s*$)[^|\n]+\|/gm) ?? [];
    const fieldCount = Math.max(0, mdRowMatches.length - 1);
    result[`step${stepNum}`] = fieldCount;
  }
  return result;
}

function extractFieldKeyFromTrBlock(trBlock: string): string | null {
  // Find <td>fieldKey</td> in the THIRD or FOURTH cell (column "Ключ в форме").
  const tdMatches = Array.from(trBlock.matchAll(/<td[^>]*>([^<]+)<\/td>/g));
  // Look for cell that looks like a field key: alphanumeric + dots, no spaces, lowercase camelCase
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
  // For HTML <table>: split by <tr> blocks, look for "условн", "только если", "если ", "if loanType=", etc.
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
  // Fallback: markdown table rows with similar wording
  if (patterns.length === 0) {
    const lines = content.split('\n');
    for (const line of lines) {
      if (
        /условн|только если|показывается если|зависит от|appears? when|if\s+\w+\s*[=!]/i.test(
          line
        )
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
  // Match "массив", "array", "FormArray" or items with `[...]` markers
  const patterns: string[] = [];
  const arrayRegex = /\b(?:hasProperty|hasExistingLoans|hasCoBorrower|properties|existingLoans|coBorrowers)\b/g;
  const matches = content.match(arrayRegex);
  if (matches) {
    for (const m of matches) {
      if (!patterns.includes(m)) patterns.push(m);
    }
  }
  // Generic fallback
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

function buildPlanMarkdown(
  spec: SpecAnalysis,
  stackBlock: string,
  target: string,
  specPathRel: string
): string {
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

  const arraysLine =
    spec.arrays.length > 0 ? spec.arrays.join(', ') : 'не обнаружено';

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

  // Recommended prompt order based on target
  const promptOrder =
    target === 'renderer-react'
      ? '`create-form` (target=renderer-react) → `add-validation` → `add-behavior` → `add-form-array` (renderer-react section) → `add-wizard` (через `schema.node().setHidden()`)'
      : target === 'renderer-json'
        ? '`create-form` (target=renderer-json) → `add-validation` → `add-behavior` → `add-form-array` (renderer-json section с `CreditFormProvider`) → `add-wizard` (через `setHidden` из useEffect)'
        : '`create-form` (target=core) → `add-validation` → `add-behavior` → `add-form-array` (с `useArrayLength` + JSX-conditional) → `add-wizard` (manual `useState currentStep` + `STEP_VALIDATIONS`)';

  return `# План разработки формы: ${spec.formName}

> Сгенерировано MCP-промптом \`plan-form\` на основе спеки \`${specPathRel}\`.
> Target stack: **\`${target}\`**.

## 1. Анализ спеки

- **Структура:** ${stepsLine}
- **Полей всего:** ${spec.totalFields}
- **Conditional поля** (показываются по условию): ${conditionalLine}
- **Computed поля** (Вычисляется автоматически): ${computedLine}
- **Arrays / FormArray:** ${arraysLine}
- **API endpoints** (для load-options/async-валидации/submit):
   - ${apiLine}
- **Канонические тексты:** ${canonicalLine}
- **Маски:** ${masksLine}

## 2. Detected стек

${stackBlock}

## 3. Этапы разработки (sub-agent roadmap)

Рекомендуемый порядок MCP-промптов: ${promptOrder}.

| # | Стадия | MCP-prompt | Артефакты | Verification (orchestrator) |
|---|--------|------------|-----------|------------------------------|
| 1 | **Planning** | \`plan-form\` (этот) | возврат markdown в чате | Orchestrator валидирует план: ≥6 секций, risk matrix, ≥5 verification scenarios. |
| 2 | **Types** | (нет prompt) | \`types.ts\` | \`tsc --noEmit\` clean + grep: число properties в interface ≈ ${spec.totalFields}. |
| 3 | **FormSchema + UI** | \`create-form\` (\`target=${target}\`) | \`schema.ts\` + \`index.tsx\`${target !== 'core' ? ' + render-schema' : ''} | Playwright: рендер ${spec.steps > 0 ? spec.steps : 'все'} step section, screenshots, 0 console errors, все спека-поля имеют \`[data-testid^="input-"]\`. |
| 4 | **Validation** | \`add-validation\` | \`validation:\` блок в \`schema.ts\` + submit handler | Playwright: empty submit → specific Russian errors совпадают с canonical messages из спеки. Generic \`"Поле обязательно для заполнения"\` = failure. |
| 5 | **Behaviors** | \`add-behavior\` | \`behavior:\` блок в \`schema.ts\` | Playwright: trigger каждый behavior из секции 5 ниже, assert effects (computed cascade, copyFrom, hide-on-condition). |
| 6 | **FormArray + Wizard** | \`add-form-array\` + \`add-wizard\` | template factories, StepIndicator, nav, setHidden | Playwright: walk all ${spec.steps > 0 ? spec.steps : 6} steps, chip click navigation, FormArray add/remove с правильными default'ами (НЕ \`[object Object]\`). |
| 7 | **Report** | (sub-agent сам пишет) | \`dev-report.md\` | Orchestrator проверяет: использованные MCP tools перечислены, все 7 верификаций отмечены, новые gaps зафиксированы. |

## 4. Risk matrix (must-not-do)

| ⚠️ | Что не делать | Почему |
|---|---|---|
| 1 | \`enableWhen\` + \`resetOnDisable: true\` на whole \`ArrayNode\` | Browser hang на mount (verified iter-1). Условный показ массива гейти в JSX/setHidden. |
| 2 | Conditional fields через \`enableWhen\` (loanType/employmentStatus) | Visible-disabled = visual spam. Используй JSX-conditional для core, \`hideWhen\`/\`setHidden\` для renderer-react/json. |
| 3 | \`FormArray.AddButton initialValue\` = FieldConfig (\`{ value, component }\`) | Silent corruption: \`[object Object]\` в Textarea, checkbox flip true. Template factory возвращает PLAIN leaf values. |
| 4 | \`watchField\` без \`{ immediate: false }\` или без value-equality guard на \`setValue\` | Реактивный цикл, browser hang. Каждый \`watchField\` — \`{ immediate: false }\` + \`if (ctx.form.X.value.value !== next) ctx.form.X.setValue(next)\`. |
| 5 | \`testId\` с дефисами или с одним leaf-name | Collisions при дублирующихся именах в разных шагах. Convention: dotted-path (\`step1.loanAmount\`, \`step2.passportData.series\`). |
| 6 | Reшreстуктурировать спеку (collapse/drop/move fields) | Spec literal: каждое поле спеки = отдельное поле в FormSchema, в том же шаге, с тем же именем. |
| 7 | Дефолтные английские placeholder \`"Select an option..."\` или выдуманные label | User-facing strings берём из спеки (canonical labels table) или задаём по шаблону спеки на родном языке. |

## 5. Verification scenarios (playwright)

| # | Сценарий | Шаги | Ожидаемый результат |
|---|---|---|---|
| 1 | Initial render | Navigate \`/examples/<page>\` | ${spec.steps > 0 ? spec.steps : '1'} step section в DOM, 0 console errors, header виден. |
| 2 | Empty submit step 1 | Click \`[data-testid="wizard-next"]\` без заполнения | 2+ specific Russian errors из canonical messages, \`h2\` остаётся "Шаг 1...". |
| 3 | Conditional reveal | Switch loanType → "Ипотека" | \`propertyValue\`/\`initialPayment\` появились (DOM contains testIds); \`carBrand\`/Model/Year/Price скрыты. |
| 4 | Cascade computed | Set monthlyIncome=120000 + additionalIncome=20000 | \`totalIncome\` = 140000 (read disabled \`<input>\` value). |
| 5 | copyFrom toggle | Check \`sameAsRegistration\` | residenceAddress поля = registrationAddress поля. |
| 6 | FormArray plain-leaves | Step 5: toggle hasProperty + click "+ Добавить" | Item #2 description="" (placeholder visible), hasEncumbrance=false, type="Квартира". НЕТ \`[object Object]\`. |
| 7 | Chip back-navigation | После step 3 click chip 1 | Header = "Шаг 1...", chip 1 active blue. |
| 8 | End-to-end happy path | Заполнить ${spec.steps > 0 ? `${spec.steps}` : 'все'} шагов canonical happy-path данными → submit | console.log values JSON, alert "Заявка отправлена". |

## 6. Test fixtures

### Happy-path (consumer кредит, минимум conditional полей)

\`\`\`json
{
  "step1": {
    "loanType": "consumer",
    "loanAmount": 500000,
    "loanTerm": 24,
    "loanPurpose": "Покупка бытовой техники для дома"
  },
  "step2": {
    "personalData": { "lastName": "Петров", "firstName": "Иван", "middleName": "Сергеевич", "birthDate": "1990-05-15", "gender": "male", "birthPlace": "Москва" },
    "passportData": { "series": "1234", "number": "123456", "issueDate": "2010-06-20", "issuedBy": "УВД района Тверское г. Москвы", "departmentCode": "770-001" },
    "inn": "123456789012",
    "snils": "123-456-789 00"
  },
  "step3": {
    "phoneMain": "+7 (916) 123-45-67",
    "email": "ivan@example.com",
    "registrationAddress": { "region": "Москва", "city": "Москва", "street": "Тверская", "house": "5", "apartment": "12", "postalCode": "125009" },
    "sameAsRegistration": true
  },
  "step4": {
    "employmentStatus": "employed",
    "companyName": "ООО Ромашка", "companyInn": "7701234567", "companyPhone": "+7 (495) 123-45-67", "companyAddress": "Москва, Пресненская набережная, 12",
    "position": "Инженер", "workExperienceTotal": 60, "workExperienceCurrent": 24,
    "monthlyIncome": 120000
  },
  "step5": { "maritalStatus": "single", "dependents": 0, "education": "higher", "hasProperty": false, "hasExistingLoans": false, "hasCoBorrower": false },
  "step6": { "agreePersonalData": true, "agreeCreditHistory": true, "agreeTerms": true, "confirmAccuracy": true, "electronicSignature": "Петров Иван Сергеевич" }
}
\`\`\`

### Edge case (mortgage + 2 properties + 1 existing loan + 1 co-borrower)

Использует step1.loanType="mortgage" + propertyValue=8000000 + step5 toggles ON + array push.
Полная JSON-структура — реализуется sub-agent'ом по канонам выше при stage 6.

---

## Финальный чек-лист (sub-agent stage 1 включает в свой report)

- [ ] План загружен и понят (этот документ).
- [ ] Sub-agent stage 2 (Types) знает: ${spec.totalFields} fields, ${spec.steps} steps, conditional list, computed list, arrays.
- [ ] Sub-agent stage 3 (FormSchema+UI) использует **target=\`${target}\`** + canonical strings из спеки.
- [ ] Sub-agent stage 4 (Validation) использует canonical messages, добавляет \`{ message }\` к каждому validator.
- [ ] Sub-agent stage 5 (Behaviors) применяет 8 watchField + copyFrom + enableWhen с cycle-prevention.
- [ ] Sub-agent stage 6 (FormArray + Wizard) использует PLAIN leaves в template + lucide-icons + clickable chips + progress text.
- [ ] Sub-agent stage 7 (Report) фиксирует план vs реализация.

> **Важно:** используй этот план как контракт. Если хочешь отойти от него (упростить, поменять order стадий) — сначала verify с orchestrator'ом, не делай самостоятельно.
`;
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
  const planMarkdown = buildPlanMarkdown(spec, stackBlock, target, args.specPath);

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: planMarkdown,
        },
      },
    ],
  };
}
