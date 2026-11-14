/**
 * Браузерная стадия верификатора: модуль формы монтируется в playground и проверяется Playwright —
 * что рисуется, какие подписи, роли и порядок видит пользователь (снимок доступности), нет ли
 * нарушений axe, выполняются ли ожидания, недоступные без рендерера.
 *
 * Запускается одним прогоном Playwright на весь батч: dev-сервер поднимается один раз.
 * Скриншоты — артефакт отчёта, вердикт от них не зависит: пиксели хрупки.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { flattenReport, runPlaywright, E2E_DIRECTORY } from '../lib/playwright.mjs';
import { repoRoot } from '../records/record.mjs';
import { readContract } from './contract.mjs';

const PAGES_DIRECTORY = path.join(
  repoRoot,
  'projects/react-playground/src/pages/debug/mcp-scenarios'
);

const pageTemplate = `/**
 * Страница стенда сценариев MCP — НЕ результат агента: она только рисует его компонент.
 * Генерируется \`packages/reformer-mcp/eval/verify/browser.mjs\`.
 */
import type { ComponentType } from 'react';
import * as moduleExports from './module/index';

const exportsByName = moduleExports as unknown as Record<string, ComponentType | undefined>;
const FormComponent =
  exportsByName.default ??
  Object.entries(exportsByName).find(([name]) => /Form$/.test(name))?.[1] ??
  Object.values(exportsByName).find((value) => typeof value === 'function');

export default function Page() {
  if (!FormComponent) throw new Error('Модуль формы не экспортирует компонент');
  return (
    <div data-testid="scenario-root" className="p-6 max-w-4xl">
      <FormComponent />
    </div>
  );
}
`;

/**
 * Что должно быть в снимке доступности: поля контракта с ролью, в порядке контракта. Сравнивается
 * роль, подпись и порядок, а не разметка вокруг поля: группировка — выбор того, кто писал форму.
 * Поле с ролью на другом шаге мастера (`aria.step`) на первом экране не ищется.
 */
export function deriveAriaFields(contract) {
  return (contract.fields ?? [])
    .filter((field) => field.aria?.role && !field.aria.step)
    .map((field) => ({ id: field.id, role: field.aria.role, name: field.aria.name }));
}

/**
 * Смонтировать модули и прогнать браузерные проверки.
 *
 * `renderLayer: false` — форма нарисована схемой без слоя рендера (эталон на core): ожидания
 * видимости (`hidden`) такой форме проверять нечем, пробы с ними пропускаются.
 *
 * @param {Array<{ slot: string, directory: string, contractFile: string, renderLayer?: boolean }>} entries
 * @param {{ batchId: string, workDirectory: string }} options
 * @returns {Record<string, Record<string, unknown>>} проверки по слотам
 */
export function verifyInBrowser(entries, { batchId, workDirectory }) {
  mkdirSync(workDirectory, { recursive: true });
  // Слоты — вывод стенда (в .gitignore). Прошлые убираются: сломанный старый модуль в маршрутах не нужен.
  for (const name of readdirSync(PAGES_DIRECTORY)) {
    const slot = path.join(PAGES_DIRECTORY, name);
    if (statSync(slot).isDirectory()) rmSync(slot, { recursive: true, force: true });
  }
  const screenshots = path.join(E2E_DIRECTORY, 'screenshots', 'mcp-scenarios', batchId);
  const manifest = entries.map(({ slot, directory, contractFile, renderLayer = true }) => {
    const pageDirectory = path.join(PAGES_DIRECTORY, slot);
    rmSync(pageDirectory, { recursive: true, force: true });
    mkdirSync(pageDirectory, { recursive: true });
    cpSync(directory, path.join(pageDirectory, 'module'), { recursive: true });
    writeFileSync(path.join(pageDirectory, 'Page.tsx'), pageTemplate);
    const contract = readContract(contractFile);
    return {
      slot,
      path: `/mcp-scenarios/${slot}`,
      ariaFields: deriveAriaFields(contract),
      probes: (contract.probes ?? []).filter((probe) => probe.where === 'browser'),
      fields: contract.fields ?? [],
      // Удалённые поля: на первом экране их подписи не должно быть.
      absent: (contract.absent ?? [])
        .filter((field) => field.bind?.label && !field.step)
        .map((field) => ({ id: field.id, label: field.bind.label })),
      // Кнопки, которые должны быть на первом экране: подпись — регулярка.
      buttons: contract.buttons ?? [],
      renderLayer,
      sample: contract.sample ?? {},
      screenshot: path.join(screenshots, `${slot}.png`),
      ariaArtifact: path.join(workDirectory, `${slot}.aria.yml`),
    };
  });

  const manifestFile = path.join(workDirectory, 'browser-manifest.json');
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  const reportFile = path.join(workDirectory, 'browser-report.json');
  rmSync(reportFile, { force: true });
  const run = runPlaywright(
    ['--project=mcp-scenarios', `--output=${path.join(workDirectory, 'playwright')}`],
    { MCP_SCENARIO_MANIFEST: manifestFile },
    reportFile
  );

  const results = Object.fromEntries(entries.map(({ slot }) => [slot, {}]));
  if (!existsSync(reportFile)) {
    for (const { slot } of entries) {
      results[slot]['browser.render'] = [
        'fail',
        `Playwright не запустился: ${run.stderr}`.slice(0, 200),
      ];
    }
    return results;
  }
  // Заголовок теста — `<слот> :: <проверка>`.
  const report = JSON.parse(readFileSync(reportFile, 'utf8'));
  for (const test of flattenReport(report)) {
    const [slot, check] = test.title.split(' :: ');
    if (!results[slot] || !check) continue;
    if (test.status === 'passed') results[slot][check] = 'pass';
    else if (test.status === 'skipped') results[slot][check] = 'skip';
    else results[slot][check] = ['fail', (test.error || test.status).slice(0, 200)];
  }
  // Отчёт есть, а тестов слота нет: Playwright упал до тестов (не поднялся dev-сервер). Пустой набор
  // проверок выглядел бы как пройденная стадия — это провал прибора, его надо видеть.
  const reason = (report.errors ?? []).map((error) => error.message).join('; ') || run.stderr;
  for (const { slot } of entries) {
    if (Object.keys(results[slot]).length === 0) {
      results[slot]['browser.render'] = [
        'fail',
        `браузерная стадия не выполнилась: ${reason || 'нет тестов в отчёте'}`.slice(0, 200),
      ];
    }
  }
  return results;
}
