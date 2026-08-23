/**
 * Ядро работает на артефакте, без файловой системы.
 *
 * Зачем тест, если есть `check:no-node-globals`. Гейт доказывает, что в `core/` нет
 * node-глобалей — то есть что код СОБЕРЁТСЯ для браузера. Он ничего не говорит о том, что
 * инструменты на браузерных источниках ОТВЕЧАЮТ, а не отдают пустоту: источник, молча
 * возвращающий `null`, гейт проходит идеально.
 *
 * Поэтому здесь знание собирается ровно так, как его соберёт браузер — из объектов в памяти,
 * без единого обращения к диску после подготовки данных, — и через него прогоняются
 * инструменты. Диск читается только чтобы получить содержимое артефакта: в браузере это
 * сделает `fetch`, и разница между «прочитать файл» и «скачать файл» для ядра неразличима.
 *
 * Второй инвариант, не менее важный: деградация обязана быть ВИДИМОЙ. В браузере нет файлов
 * `docs/llms` и нет разбора AST; ответы инструментов должны это показывать, а не выглядеть
 * как «в библиотеке такого нет».
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { BUNDLE_SCHEMA_VERSION, type IndexBundle, type DocsBundle } from '../src/core/bundle.js';
import { KNOWN_PACKAGES, packageDirName } from '../src/core/docs/packages.js';
import { createBrowserKnowledge } from '../src/platform/browser/knowledge.js';
import { chooseApiTool } from '../src/core/tools/choose-api.js';
import { getContextTool } from '../src/core/tools/get-context.js';
import { getSymbolDocsTool } from '../src/core/tools/get-symbol-docs.js';
import { searchDocsTool } from '../src/core/tools/search-docs.js';
import { findRecipeTool } from '../src/core/tools/find-recipe.js';
import { reportIssueTool } from '../src/core/tools/report-issue.js';
import { validateFormTool } from '../src/core/tools/validate-form.js';

const repoRoot = resolve(__dirname, '../../..');

/** Собрать артефакты так же, как это делает `scripts/build-knowledge-bundle.mjs`. */
function loadBundles(): { index: IndexBundle; docs: DocsBundle } | null {
  const index: IndexBundle = { schemaVersion: BUNDLE_SCHEMA_VERSION, builtAt: '', packages: {} };
  const docs: DocsBundle = { schemaVersion: BUNDLE_SCHEMA_VERSION, builtAt: '', packages: {} };

  for (const pkg of KNOWN_PACKAGES) {
    const dir = resolve(repoRoot, 'packages', packageDirName(pkg));
    const indexFile = resolve(dir, 'llms-index.json');
    const docsFile = resolve(dir, 'llms.txt');
    if (existsSync(indexFile)) index.packages[pkg] = JSON.parse(readFileSync(indexFile, 'utf8'));
    if (existsSync(docsFile)) docs.packages[pkg] = readFileSync(docsFile, 'utf8');
  }

  return Object.keys(index.packages).length > 0 ? { index, docs } : null;
}

const bundles = loadBundles();
const describeWithBundle = bundles ? describe : describe.skip;

describeWithBundle('ядро на браузерных источниках', () => {
  const { knowledge: k, issues } = createBrowserKnowledge({
    index: bundles!.index,
    docs: bundles!.docs,
  });

  const textOf = (r: { content: Array<{ text: string }> }) =>
    r.content.map((c) => c.text).join('\n');

  it('индекс собран из артефакта и покрывает все пакеты', () => {
    expect(k.index.symbols.length).toBeGreaterThan(500);
    // Ни один пакет не должен оказаться «без индекса»: в браузере фолбэка нет, и такой пакет
    // молча потерял бы всю свою API-поверхность.
    expect(k.index.withoutIndex).toEqual([]);
  });

  it('choose_api отвечает решением, а не поиском', async () => {
    const out = textOf(
      await chooseApiTool({ requirement: 'значение поля выводится из двух других' }, k)
    );
    expect(out).toContain('choose_api');
    expect(out).toMatch(/computeFrom|compute/);
  });

  it('get_context собирает контекст под задачу', async () => {
    const out = textOf(await getContextTool({ task: 'async проверка email на занятость' }, k));
    expect(out).toContain('get_context');
    expect(out.length).toBeGreaterThan(200);
  });

  it('get_symbol_docs отдаёт сигнатуру из индекса', async () => {
    const out = textOf(await getSymbolDocsTool({ symbol: 'defineFormBehavior' }, k));
    expect(out).toContain('defineFormBehavior');
    // Сигнатура приходит из индекса, а не из разбора AST: в браузере парсера нет вовсе.
    expect(out).toContain('export function defineFormBehavior');
  });

  it('search_docs находит секции и отдаёт резолвимые URI', async () => {
    const out = textOf(await searchDocsTool({ query: 'conditional required validation' }, k));
    const uris = [...out.matchAll(/reformer:\/\/docs\/([^/\s`]+)\/([^\s`]+)/g)];
    expect(uris.length).toBeGreaterThan(0);
    for (const [, short, slug] of uris) {
      expect(k.docs.sectionBySlug(`@reformer/${short}`, slug)).toBeTruthy();
    }
  });

  it('validate_form ловит импорт не из того подпути', async () => {
    const out = textOf(
      await validateFormTool(
        // `defineFormBehavior` живёт только в `./behaviors` — импорт из корня соберётся в
        // монорепо и упадёт у потребителя; ровно этот класс ошибок `tsc` и не ловит.
        { kind: 'code', code: "import { defineFormBehavior } from '@reformer/core';" },
        k
      )
    );
    expect(out).toContain('RF003');
  });

  it('find_recipe без файлов рецептов не молчит, а уходит в каскад', async () => {
    // Первая стадия (подбор по имени файла в docs/llms) в браузере невозможна. Инструмент
    // обязан ответить кандидатами из полнотекстового поиска, а не «не найдено».
    expect(k.recipes.list('@reformer/core')).toEqual([]);
    const out = textOf(await findRecipeTool({ topic: 'copy-from' }, k));
    expect(out).not.toContain('No recipe found');
    expect(out.length).toBeGreaterThan(200);
  });

  it('report_issue сохраняет в память вкладки и говорит куда', async () => {
    const out = textOf(
      await reportIssueTool({ error: 'тестовая проблема', solution: 'тестовое решение' }, k)
    );
    expect(out).toContain('Issue reported successfully');
    expect(out).toContain('памяти вкладки');
    expect(issues.entries().size).toBe(1);
  });

  it('знание без документации работает на одном индексе', async () => {
    // Профиль «только индекс»: 264 кБ gzip против 626 кБ с прозой. Инструменты, которым
    // хватает решения и сигнатуры, обязаны работать и так.
    const { knowledge: lean } = createBrowserKnowledge({ index: bundles!.index });
    expect(lean.docs.packages()).toEqual([]);
    const out = textOf(await getSymbolDocsTool({ symbol: 'defineFormBehavior' }, lean));
    expect(out).toContain('defineFormBehavior');
  });
});
