/**
 * T3 — рантайм: форма, собранная `form_build`, работает в браузере под e2e эталона.
 *
 * Модули пишутся в `projects/react-playground/src/pages/debug/mcp-calibration/<кейс>-<таргет>/`:
 * файлы бандла — как их отдал сервер, плюс `Page.tsx` стенда. Страница делает то, что по образцу
 * `index.tsx` дописал бы агент: сборку `createForm` и `FormRenderer`, а у формы без визарда —
 * кнопки «Отправить»/«Очистить» и строку статуса (`submit`, `reset`, `submit-status` — их ждёт
 * e2e эталона регистрации). Страница одна на все модули, так что расхождения прогонов — от
 * сервера, а не от стенда.
 *
 * У таргета `core` разметку по образцу сервера пишет агент в JSX. Схема у `core` и
 * `renderer-react` одна и та же (бандлы совпадают до `index.tsx`), поэтому стенд рисует оба
 * `FormRenderer`-ом; разница таргетов в рантайме — только у `renderer-json`.
 *
 * Прогоны: кредитная заявка — проекты `iter-*` (`MCP_ITER_VERSION=cal`, POM `CreditFormPage`),
 * регистрация — проект `registration-form-json` с `REG_FORM_PATH`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { flattenReport as flatten, runPlaywright as playwright } from '../lib/playwright.mjs';
import { parseFormBuild, prepareFormDirectory, readModule } from './lib/bundle.mjs';
import { inspect, repoRoot } from './lib/inspector.mjs';
import { CASES, TARGETS } from './tracks.mjs';
import { intentForTarget } from '../lib/intent-target.mjs';

const PAGES_DIR = path.join(repoRoot, 'projects/react-playground/src/pages/debug/mcp-calibration');
const E2E_DIR = path.join(repoRoot, 'projects/react-playground-e2e');
const CREDIT_SPECS = [
  'happy-path',
  'navigation',
  'validation',
  'conditional-fields',
  'computed-fields',
  'dependencies',
  'arrays',
  'reorder',
].map((name) => `tests/pages/complex-multy-step-form/${name}.spec.ts`);

function pageTsx({ hasFlow, hasRegistry, messagesExport }) {
  const kit = [...(hasFlow ? [] : ['Button']), ...(hasRegistry ? [] : ['FormField'])];
  const imports = [
    ...(hasFlow ? [] : ["import { useState } from 'react';"]),
    "import { createForm } from '@reformer/core';",
    "import { useFormBundle } from '@reformer/core/react';",
    "import { FormRenderer } from '@reformer/renderer-react';",
    ...(kit.length ? [`import { ${kit.join(', ')} } from '@reformer/ui-kit';`] : []),
    ...(messagesExport ? ["import { ValidationMessagesProvider } from '@reformer/cdk';"] : []),
    "import { formBehavior } from './form.behavior';",
    "import { formSchema } from './form.schema';",
    "import { formValidation } from './form.validation';",
    "import { createFormModel } from './model';",
    ...(hasFlow ? ["import { formFlow } from './form.flow';"] : []),
    ...(hasRegistry ? ["import { createRegistry } from './registry';"] : []),
    ...(messagesExport ? [`import { ${messagesExport} } from './form.messages';`] : []),
  ];
  const config = [
    'model: createFormModel()',
    'schema: formSchema',
    'behavior: formBehavior',
    'validation: formValidation',
    ...(hasFlow ? ['flow: formFlow'] : []),
    ...(hasRegistry ? ['registry: createRegistry()'] : []),
  ];
  const renderer = hasRegistry
    ? '<FormRenderer form={bundle} />'
    : '<FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />';
  const body = messagesExport
    ? `<ValidationMessagesProvider messages={${messagesExport}}>${renderer}</ValidationMessagesProvider>`
    : renderer;
  const actions = hasFlow
    ? ''
    : `
      <div className="flex gap-2 mt-4">
        <Button data-testid="submit" onClick={submit}>Отправить</Button>
        <Button data-testid="reset" variant="outline" onClick={reset}>Очистить</Button>
      </div>
      <p data-testid="submit-status">{status}</p>`;
  // У визарда отправку ведёт сам FormWizard (кнопка `btn-submit`), своих кнопок стенду не нужно.
  const handlers = hasFlow
    ? ''
    : `
  const [status, setStatus] = useState<string | null>(null);

  const submit = async () => {
    const outcome = await bundle.submission.submit(async (values) => values);
    setStatus(outcome.status === 'submitted' ? 'Отправлено' : 'Проверьте выделенные поля');
  };
  const reset = () => {
    bundle.model.reset();
    bundle.form.clearIssues();
    bundle.form.markAsUntouched();
    setStatus(null);
  };
`;
  return `/**
 * Страница калибровочного стенда MCP — НЕ вывод сервера: сборка модуля, записанного \`form_build\`,
 * и кнопки отправки. Генерируется \`packages/reformer-mcp/eval/calibration/runtime.mjs\`.
 */
${imports.join('\n')}

export default function Page() {
  const bundle = useFormBundle(() =>
    createForm({
      ${config.join(',\n      ')},
    })
  );
${handlers}
  return (
    <div className="p-6 max-w-4xl">
      ${body}${actions}
    </div>
  );
}
`;
}

/** Сгенерировать модули форм калибровки из эталонных intent и разложить их в playground. */
export async function mountForms({
  outDir,
  cases = ['registration', 'credit'],
  source = 'golden',
}) {
  mkdirSync(PAGES_DIR, { recursive: true });
  const mounted = [];
  for (const id of cases) {
    const c = CASES.find((x) => x.id === id);
    if (!c?.intent || !existsSync(c.intent)) continue;
    const intent = JSON.parse(readFileSync(c.intent, 'utf8'));
    for (const target of TARGETS) {
      const dir = path.join(PAGES_DIR, `${id}-${target}`);
      prepareFormDirectory(dir, intentForTarget(intent, target));
      const r = await inspect('node', 'tools/call', {
        toolName: 'form_build',
        toolArgs: { dir },
        timeoutMs: 180_000,
      });
      const built = parseFormBuild(r.text);
      const files = built.status === 'ok' ? readModule(dir) : [];
      const messages = files.find((f) => f.path === 'form.messages.ts');
      writeFileSync(
        path.join(dir, 'Page.tsx'),
        pageTsx({
          hasFlow: files.some((f) => f.path === 'form.flow.ts'),
          hasRegistry: files.some((f) => f.path === 'registry.ts'),
          messagesExport:
            messages?.content.match(/export const (\w+)\s*=\s*defineIssueMessages/)?.[1] ?? null,
        })
      );
      mounted.push({
        case: id,
        source,
        target,
        status: built.status,
        files: files.map((f) => f.path),
        path:
          id === 'credit'
            ? `/mcp-credit-application-${target}-vcal`
            : `/mcp-calibration/${id}-${target}`,
      });
    }
  }
  writeFileSync(path.join(outDir, 't3-mounted.json'), JSON.stringify(mounted, null, 2));
  return mounted;
}

/** Прогнать e2e эталонов по смонтированным формам. */
export function runE2e({ outDir, mounted }) {
  const artifacts = path.join(E2E_DIR, 'screenshots', 'mcp-calibration', path.basename(outDir));
  const results = [];
  if (mounted.some((m) => m.case === 'credit')) {
    const file = path.join(outDir, 't3-credit.json');
    const run = playwright(
      [
        '--project=iter-core',
        '--project=iter-renderer-react',
        '--project=iter-renderer-json',
        ...CREDIT_SPECS,
        `--output=${path.join(artifacts, 'credit')}`,
      ],
      { MCP_ITER_VERSION: 'cal' },
      file
    );
    const tests = existsSync(file) ? flatten(JSON.parse(readFileSync(file, 'utf8'))) : [];
    results.push({
      case: 'credit',
      exit: run.status,
      stderr: tests.length ? '' : run.stderr,
      tests,
    });
  }
  for (const m of mounted.filter((x) => x.case === 'registration')) {
    const file = path.join(outDir, `t3-registration-${m.target}.json`);
    const run = playwright(
      [
        '--project=registration-form-json',
        `--output=${path.join(artifacts, `registration-${m.target}`)}`,
      ],
      { REG_FORM_PATH: m.path },
      file
    );
    const tests = existsSync(file) ? flatten(JSON.parse(readFileSync(file, 'utf8'))) : [];
    results.push({
      case: 'registration',
      target: m.target,
      exit: run.status,
      stderr: tests.length ? '' : run.stderr,
      tests: tests.map((t) => ({ ...t, project: `registration/${m.target}` })),
    });
  }
  writeFileSync(path.join(outDir, 't3.json'), JSON.stringify(results, null, 2));
  return results;
}

/** Сводка T3: по проекту — пройдено/всего и первые причины падений. */
export function summarizeE2e(results) {
  const byProject = {};
  for (const r of results) {
    for (const t of r.tests) {
      const p = (byProject[t.project] ??= { passed: 0, total: 0, failed: [] });
      p.total++;
      if (t.status === 'passed') p.passed++;
      else p.failed.push(`${t.file} › ${t.title}: ${t.error}`);
    }
  }
  return byProject;
}
