import { existsSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { discoverUnknownStack } from './sampling-helpers.js';

export interface ProjectStack {
  /** Absolute path to the resolved project package.json (or null if not found). */
  projectRoot: string | null;
  /** All dependencies (deps + devDeps + peerDeps) keyed by name → version range. */
  allDependencies: Record<string, string>;
  /** Whether @reformer/ui-kit is in deps. */
  hasUiKit: boolean;
  /** Whether @reformer/cdk is in deps. */
  hasCdk: boolean;
  /** Whether @reformer/renderer-react is in deps. */
  hasRendererReact: boolean;
  /** Whether @reformer/renderer-json is in deps. */
  hasRendererJson: boolean;
  /** Whether tailwindcss / @tailwindcss/vite is in deps. */
  hasTailwindDep: boolean;
  /** Whether tailwind.config.{js,ts,cjs,mjs} exists at project root (Tailwind v3). */
  hasTailwindConfig: boolean;
  /** Whether @tailwindcss/vite plugin is in deps (Tailwind v4 — no separate config file needed). */
  hasTailwindVitePlugin: boolean;
  /** True if Tailwind dep detected AND (config file OR Vite plugin) — i.e. functional setup. */
  hasTailwind: boolean;
  /** Path to detected tailwind.config (for reference). */
  tailwindConfigPath: string | null;
}

/**
 * Walk up from cwd looking for the nearest package.json that is not a workspace
 * root descriptor (i.e. has dependencies). Stops at filesystem root or 8 levels
 * up. Returns null if not found.
 */
function findProjectPackageJson(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      try {
        const json = JSON.parse(readFileSync(candidate, 'utf-8'));
        const allDeps = {
          ...(json.dependencies ?? {}),
          ...(json.devDependencies ?? {}),
          ...(json.peerDependencies ?? {}),
        };
        if (Object.keys(allDeps).length > 0) {
          return candidate;
        }
      } catch {
        // ignore unreadable package.json
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function findTailwindConfig(projectRoot: string): string | null {
  const candidates = [
    'tailwind.config.ts',
    'tailwind.config.js',
    'tailwind.config.mjs',
    'tailwind.config.cjs',
  ];
  for (const name of candidates) {
    const p = join(projectRoot, name);
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Detect project stack from a starting directory (defaults to process.cwd()).
 * Reads only package.json + checks for tailwind.config presence — no other
 * files are read (prompt-time hint only, must stay cheap).
 *
 * In monorepos pass an explicit `startDir` (the app directory), otherwise
 * detector returns the root package.json which usually lacks app-level deps.
 */
export function detectProjectStack(startDir?: string): ProjectStack {
  const start = startDir ? resolve(startDir) : process.cwd();
  const pkgPath = findProjectPackageJson(start);
  if (!pkgPath) {
    return {
      projectRoot: null,
      allDependencies: {},
      hasUiKit: false,
      hasCdk: false,
      hasRendererReact: false,
      hasRendererJson: false,
      hasTailwindDep: false,
      hasTailwindConfig: false,
      hasTailwindVitePlugin: false,
      hasTailwind: false,
      tailwindConfigPath: null,
    };
  }

  const projectRoot = dirname(pkgPath);
  let json: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  } = {};
  try {
    json = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    json = {};
  }

  const allDeps: Record<string, string> = {
    ...(json.dependencies ?? {}),
    ...(json.devDependencies ?? {}),
    ...(json.peerDependencies ?? {}),
  };

  const tailwindConfigPath = findTailwindConfig(projectRoot);
  const hasTailwindDep = '@tailwindcss/vite' in allDeps || 'tailwindcss' in allDeps;
  const hasTailwindVitePlugin = '@tailwindcss/vite' in allDeps;

  return {
    projectRoot,
    allDependencies: allDeps,
    hasUiKit: '@reformer/ui-kit' in allDeps,
    hasCdk: '@reformer/cdk' in allDeps,
    hasRendererReact: '@reformer/renderer-react' in allDeps,
    hasRendererJson: '@reformer/renderer-json' in allDeps,
    hasTailwindDep,
    hasTailwindConfig: tailwindConfigPath !== null,
    hasTailwindVitePlugin,
    // Tailwind functional if: dep present AND (config file OR Vite plugin = v4 inline config).
    hasTailwind: hasTailwindDep && (tailwindConfigPath !== null || hasTailwindVitePlugin),
    tailwindConfigPath,
  };
}

/**
 * Render a short markdown block summarising what was detected and what
 * recommendation follows. Used by create-form prompt.
 */
export function renderStackDetectionBlock(stack: ProjectStack): string {
  if (!stack.projectRoot) {
    return [
      '> ⚠️ MCP не нашёл `package.json` рабочего проекта в дереве выше cwd. Уточни у оркестратора:',
      '> «Какие UI-компоненты использовать? (a) `@reformer/ui-kit`, (b) shadcn/ui, (c) MUI, (d) plain HTML, (e) другое — укажи».',
      '> «Какая система стилей? (a) Tailwind, (b) CSS Modules, (c) Emotion / styled-components, (d) vanilla CSS, (e) inline style».',
    ].join('\n');
  }

  const lines: string[] = [];
  lines.push('### Detected stack (auto)');
  lines.push('');
  lines.push(`Project root: \`${stack.projectRoot}\``);
  lines.push('');

  const detected: string[] = [];
  if (stack.hasUiKit) detected.push('`@reformer/ui-kit`');
  if (stack.hasCdk) detected.push('`@reformer/cdk`');
  if (stack.hasRendererReact) detected.push('`@reformer/renderer-react`');
  if (stack.hasRendererJson) detected.push('`@reformer/renderer-json`');
  if (stack.hasTailwind) {
    detected.push(
      stack.hasTailwindVitePlugin && !stack.hasTailwindConfig
        ? 'Tailwind CSS (v4 via @tailwindcss/vite, inline @theme)'
        : 'Tailwind CSS'
    );
  } else if (stack.hasTailwindDep) detected.push('Tailwind dep (no config + no vite plugin)');
  else if (stack.hasTailwindConfig) detected.push('Tailwind config (no dep)');

  if (detected.length > 0) {
    lines.push(`**Detected:** ${detected.join(', ')}.`);
  } else {
    lines.push('**Detected:** ничего из known stacks. См. MCP-gap-вопрос ниже.');
  }
  lines.push('');

  // UI kit recommendation
  if (stack.hasUiKit) {
    lines.push('**UI components → используй `@reformer/ui-kit`:**');
    lines.push('');
    lines.push('```typescript');
    lines.push('// Поля формы');
    lines.push("import { Input, InputMask, InputPassword, Textarea } from '@reformer/ui-kit';");
    lines.push(
      "import { Checkbox, RadioGroup, Select, SelectGroup, SelectItem } from '@reformer/ui-kit';"
    );
    lines.push('// Layout-контейнеры (для RenderSchema или ручной разметки)');
    lines.push("import { Section, Box, Collapsible } from '@reformer/ui-kit';");
    lines.push('// Кнопки и обвязка');
    lines.push("import { Button, FormField, AsyncBoundary, cn } from '@reformer/ui-kit';");
    lines.push('```');
    lines.push('');
    lines.push(
      'Все компоненты совместимы с `FieldNode` (`value`/`onChange`/`onBlur`) — подключай через `<FormField control={form.email} />` или регистрируй в `RenderSchema`.'
    );
  } else {
    lines.push('> ⚠️ `@reformer/ui-kit` НЕ найден в зависимостях. **Уточни у оркестратора:**');
    lines.push(
      '> «Какие UI-компоненты использовать? (a) добавить `@reformer/ui-kit`, (b) shadcn/ui, (c) MUI, (d) plain HTML, (e) другое».'
    );
    lines.push('> До получения ответа НЕ генерируй код — это инвалидный fallback.');
  }
  lines.push('');

  // Tailwind recommendation
  if (stack.hasTailwind) {
    const setupNote =
      stack.hasTailwindVitePlugin && !stack.hasTailwindConfig
        ? ' (v4 — конфиг inline через `@theme` в CSS, отдельного `tailwind.config.*` нет)'
        : '';
    lines.push(`**Styling → используй Tailwind utility-classes**${setupNote}:`);
    lines.push('');
    lines.push('- Layout: `grid grid-cols-2 gap-4`, `flex flex-col gap-4`, `space-y-4`.');
    lines.push('- Spacing/padding: `p-4`, `px-6 py-3`, `mb-6`, `pt-2`.');
    lines.push('- Typography: `text-sm`, `text-2xl font-bold`, `text-gray-900`.');
    lines.push('- Состояния полей: `disabled:opacity-50`, `focus:ring-2 focus:ring-blue-500`.');
  } else if (stack.hasTailwindDep || stack.hasTailwindConfig) {
    lines.push(
      '> ⚠️ Tailwind частично обнаружен (' +
        (stack.hasTailwindDep ? 'dep есть' : 'dep НЕТ') +
        ', ' +
        (stack.hasTailwindConfig ? 'config есть' : 'config НЕТ') +
        '). Уточни у оркестратора, считать ли Tailwind включённым.'
    );
  } else {
    lines.push('> ⚠️ Tailwind не обнаружен. **Уточни у оркестратора:**');
    lines.push(
      '> «Какая система стилей? (a) Tailwind, (b) CSS Modules, (c) Emotion / styled-components, (d) vanilla CSS, (e) inline style».'
    );
    lines.push('> До получения ответа НЕ генерируй классы.');
  }

  return lines.join('\n');
}

/**
 * Render layout skeleton recommendation for create-form prompt. Active only
 * when both ui-kit and Tailwind detected.
 */
export function renderLayoutSkeletonBlock(stack: ProjectStack, target: string): string {
  if (!stack.hasUiKit || !stack.hasTailwind) return '';

  const lines: string[] = [];
  lines.push('### Layout skeleton (target visual density)');
  lines.push('');
  lines.push('Для многошаговой/секционной формы используй такую плотность:');
  lines.push('');

  if (target === 'renderer-react' || target === 'renderer-json') {
    lines.push('**Step / Section в RenderSchema (с card wrap):**');
    lines.push('');
    lines.push('```typescript');
    lines.push('{');
    lines.push("  selector: 'step1',");
    lines.push('  component: Section,');
    lines.push('  componentProps: {');
    lines.push("    title: 'Шаг 1. Параметры кредита',");
    lines.push("    titleAs: 'h2',");
    lines.push("    titleClassName: 'text-xl font-bold mb-4 text-gray-900',");
    lines.push('    // ВАЖНО: card wrap, не просто space-y-4 — иначе секция выглядит дёшево');
    lines.push("    className: 'space-y-4 bg-white border rounded-xl shadow-sm p-6',");
    lines.push('  },');
    lines.push('  children: [');
    lines.push('    {');
    lines.push('      component: Box,');
    lines.push("      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },");
    lines.push('      children: [');
    lines.push('        { component: path.step1.loanAmount },  // testId="step1.loanAmount"');
    lines.push('        { component: path.step1.loanTerm },');
    lines.push('      ],');
    lines.push('    },');
    lines.push('    { component: path.step1.loanPurpose },  // full-width');
    lines.push('  ],');
    lines.push('}');
    lines.push('```');
    lines.push('');
    lines.push(
      '**Settings.fieldWrapper = FormField** — оборачивает каждое поле в label + error + pending:'
    );
    lines.push('```tsx');
    lines.push('<FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />');
    lines.push('```');
  } else {
    lines.push('**Step-обёртка в ручном React (с card wrap):**');
    lines.push('');
    lines.push('```tsx');
    lines.push('<section className="space-y-4 bg-white border rounded-xl shadow-sm p-6">');
    lines.push(
      '  <h2 className="text-xl font-bold mb-4 text-gray-900">Шаг 1. Параметры кредита</h2>'
    );
    lines.push('  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">');
    lines.push('    <FormField control={form.step1.loanAmount} testId="step1.loanAmount" />');
    lines.push('    <FormField control={form.step1.loanTerm} testId="step1.loanTerm" />');
    lines.push('  </div>');
    lines.push('  <FormField control={form.step1.loanPurpose} testId="step1.loanPurpose" />');
    lines.push('</section>');
    lines.push('```');
    lines.push('');
    lines.push('**Внешний контейнер страницы:**');
    lines.push('```tsx');
    lines.push('<div className="max-w-4xl mx-auto p-6 space-y-6">');
    lines.push('  <h1 className="text-2xl font-bold text-gray-900">Заявка на кредит</h1>');
    lines.push('  <StepIndicator current={currentStep} completed={completedSteps} />');
    lines.push('  {/* card-wrapped step section */}');
    lines.push('  {/* nav-buttons row */}');
    lines.push('  {/* progress text */}');
    lines.push('</div>');
    lines.push('```');
  }
  lines.push('');
  lines.push('**Step indicator с иконками + dashes (lucide-react):**');
  lines.push('```tsx');
  lines.push(
    "import { Coins, User, Phone, Briefcase, FileText, CheckSquare } from 'lucide-react';"
  );
  lines.push('');
  lines.push('const STEP_META = [');
  lines.push("  { n: 1, label: 'Кредит', icon: Coins },");
  lines.push("  { n: 2, label: 'Данные', icon: User },");
  lines.push("  { n: 3, label: 'Контакты', icon: Phone },");
  lines.push("  { n: 4, label: 'Работа', icon: Briefcase },");
  lines.push("  { n: 5, label: 'Доп. инфо', icon: FileText },");
  lines.push("  { n: 6, label: 'Подтверждение', icon: CheckSquare },");
  lines.push('];');
  lines.push('// chip = <button> (не <div>), клик ведёт на n если completed || n <= maxReached.');
  lines.push('// Между chip и chip — `<li className="text-gray-300">—</li>` (en-dash).');
  lines.push('```');
  lines.push('');
  lines.push('**Кнопки навигации с visual cues + progress text:**');
  lines.push('```tsx');
  lines.push("import { Button } from '@reformer/ui-kit';");
  lines.push('');
  lines.push('<div className="flex items-center justify-between gap-3 pt-4 border-t">');
  lines.push('  {currentStep > 1');
  lines.push('    ? <Button type="button" variant="outline" onClick={prev}>← Назад</Button>');
  lines.push('    : <span aria-hidden />}');
  lines.push('  {currentStep < TOTAL_STEPS');
  lines.push('    ? <Button type="button" onClick={next}>Далее →</Button>');
  lines.push('    : <Button type="submit">Отправить</Button>}');
  lines.push('</div>');
  lines.push('<div className="text-sm text-center text-gray-500">');
  lines.push(
    '  Шаг {currentStep} из {TOTAL_STEPS} • {Math.round((currentStep - 1) / (TOTAL_STEPS - 1) * 100)}% завершено'
  );
  lines.push('</div>');
  lines.push('```');
  lines.push('');
  lines.push(
    '**Не используй plain `<input>` / `<button>` / inline-style** — это нарушает консистентность baseline.'
  );
  lines.push(
    '**Не пропускай:** card wrap (`bg-white border rounded-xl shadow-sm p-6`), иконки в indicator, en-dashes между chips, "← Назад" / "Далее →" со стрелкой, progress-text. Каждый из этих элементов — заметный gap vs baseline (см. iter-3 fix-plan).'
  );

  return lines.join('\n');
}

/**
 * Async variant of {@link renderStackDetectionBlock} that asks the connected
 * client LLM (via sampling) for likely UI library + styling system when local
 * detection couldn't find `@reformer/ui-kit` or Tailwind.
 *
 * Falls back to the synchronous `renderStackDetectionBlock` output (legacy
 * MCP-gap question) when the client doesn't support sampling, the call fails,
 * or the LLM has no useful suggestion.
 *
 * Pass `server` from the MCP request handler. Without `server`, behaves
 * exactly like the sync version.
 */
export async function renderStackDetectionBlockAsync(
  stack: ProjectStack,
  server?: Server
): Promise<string> {
  // Only kick in when we have a project root but failed to find both ui-kit
  // and Tailwind — that's the case where the legacy block becomes a static
  // "ask the orchestrator" question. With sampling we can do better.
  const needsDiscovery = stack.projectRoot !== null && !stack.hasUiKit && !stack.hasTailwind;
  if (!needsDiscovery || !server) {
    return renderStackDetectionBlock(stack);
  }

  const discovered = await discoverUnknownStack(server, stack);
  if (!discovered || (!discovered.uiKit && !discovered.styling)) {
    return renderStackDetectionBlock(stack);
  }

  const lines: string[] = [];
  lines.push('### Detected stack (auto + LLM-assisted)');
  lines.push('');
  lines.push(`Project root: \`${stack.projectRoot}\``);
  lines.push('');
  lines.push(
    '**LLM analysis of dependencies suggests:**' +
      (discovered.uiKit ? `\n- UI library: \`${discovered.uiKit}\`` : '') +
      (discovered.styling ? `\n- Styling system: \`${discovered.styling}\`` : '')
  );
  lines.push('');
  lines.push(
    '> ⚠️ This is an LLM guess based on `package.json`, not a verified detection. ' +
      'Confirm with the orchestrator before generating code.'
  );
  return lines.join('\n');
}
