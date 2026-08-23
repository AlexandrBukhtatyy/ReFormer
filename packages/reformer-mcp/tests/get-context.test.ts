/**
 * Сборка контекста: `get_context`.
 *
 * Ключевой инвариант здесь — не «нашёл правильный символ», а **форма ответа отражает
 * уверенность**. Первая версия сборщика подавала догадку в том же виде, что и знание: на
 * запрос «показать текущее количество строк массива» выдача начиналась блоком `## API` с
 * `isGroupNode`, хотя правило не срабатывало и символ не подтверждался ни одной найденной
 * секцией. Это хуже пустого ответа — агент напишет уверенный неверный вызов.
 *
 * Отдельно фиксируется измеренный ОТРИЦАТЕЛЬНЫЙ результат: как единственный вызов
 * `get_context` уступает связке `choose_api` + точечный поиск (first-pass 69.6% против 95.7%
 * на одном корпусе). Поэтому он не должен рекламировать себя как замену — это проверяется
 * на тексте описания инструмента.
 */

import { describe, it, expect } from 'vitest';
import { buildContext } from '../src/core/context/builder';
import { getContextTool, getContextToolDefinition } from '../src/core/tools/get-context';
import { listAvailablePackages } from '../src/utils/docs-parser';
import { cliKnowledge } from '../src/platform/cli/knowledge.js';

/** Знание процесса: тесты гоняются в Node, поэтому источники — те же, что у сервера. */
const k = cliKnowledge();

const hasDocs = listAvailablePackages().length > 0;

describe('get_context', () => {
  it('пустая задача → внятное сообщение, а не падение', async () => {
    for (const task of [undefined, '', '   ']) {
      const { content } = await getContextTool({ task: task as string }, k);
      expect(content[0].text).toMatch(/task/i);
    }
  });

  it.runIf(hasDocs)('сработавшее правило ведёт выдачу и даёт сигнатуру', async () => {
    const r = await buildContext(k, {
      task: 'поле B доступно только когда A заполнено',
      target: 'core',
    });
    expect(r.text).toMatch(/^## Use `enableWhen`/m);
    expect(r.text).toContain('## API');
    expect(r.symbols[0]).toBe('enableWhen');
  });

  it.runIf(hasDocs)('без уверенности не выдумывает блок API', async () => {
    // Запрос намеренно не ложится ни на одно правило и не имеет опорных секций.
    const r = await buildContext(k, { task: 'zzqq wubble frotz plugh', target: 'core' });
    expect(r.symbols, 'символ без подтверждения секцией не должен попадать в выдачу').toEqual([]);
    expect(r.text).not.toContain('## API');
  });

  it.runIf(hasDocs)('minimal дешевле implementation и не теряет сигнатуру', async () => {
    const task = 'проверить на сервере, что email не занят';
    const min = await buildContext(k, { task, target: 'core', profile: 'minimal' });
    const impl = await buildContext(k, { task, target: 'core', profile: 'implementation' });
    expect(min.tokens).toBeLessThan(impl.tokens);
    expect(min.text).toContain('## API');
  });

  it.runIf(hasDocs)('maxTokens соблюдается и перекрывает профиль', async () => {
    const r = await buildContext(k, {
      task: 'проверить на сервере, что email не занят',
      target: 'core',
      profile: 'full',
      maxTokens: 120,
    });
    expect(r.tokens).toBeLessThanOrEqual(140); // допуск на склейку разделителей
    expect(r.dropped + (r.truncated ? 1 : 0), 'что-то обязано было выпасть').toBeGreaterThan(0);
  });

  it.runIf(hasDocs)('выпавшие по бюджету блоки названы в ответе', async () => {
    const { content } = await getContextTool(
      {
        task: 'проверить на сервере, что email не занят',
        target: 'core',
        maxTokens: 100,
      },
      k
    );
    expect(content[0].text).toMatch(/не поместились в бюджет|обрезан/);
  });

  it.runIf(hasDocs)('целевой стек не тянет в выдачу секции чужих пакетов', async () => {
    // Проверяем ИСТОЧНИКИ, а не наличие строки: в каноническом примере renderer-json
    // законно стоит `import { Input, Box } from '@reformer/ui-kit'`, и запрещать это
    // значило бы требовать неполный пример.
    const r = await buildContext(k, { task: 'описать форму JSON-схемой', target: 'renderer-json' });
    expect(r.sources.every((u) => !u.includes('/ui-kit/'))).toBe(true);
    const apiBlock = r.text.match(/## API[\s\S]*?(?=\n## |$)/)?.[0] ?? '';
    expect(apiBlock).not.toContain('@reformer/ui-kit');
  });

  it.runIf(hasDocs)('раскладка файлов формы доезжает при ЛЮБОМ target', async () => {
    // Замерено расследованием (`.tmp/layout-check/report.md`): правило именования файлов
    // формы жило ровно в одном пакете — `@reformer/mcp`, — а `packagesFor()` вырезал его при
    // распознанном target'е. Секции §1/§2 гайда были недостижимы через `get_context` ни при
    // какой формулировке, и агент, не прочитавший `reformer://guide` целиком (~47 КБ),
    // придумывал имена файлов сам: 5/10 совпадений с каноном против 8/9 у прочитавшего.
    const LAYOUT = 'reformer://docs/mcp/minimalist-default-flat-one-file-per-concern';
    for (const target of ['core', 'renderer-react', 'renderer-json']) {
      const r = await buildContext(k, { task: 'form directory layout file names', target });
      expect(r.sources, `target=${target}: правило раскладки не доехало`).toContain(LAYOUT);
    }
  });

  it.runIf(hasDocs)('самодокументация сервера не забивает выдачу по задаче формы', async () => {
    // Обратная сторона правки выше: mcp участвует, но при прочих равных уступает
    // библиотечным пакетам (`OWN_DOCS_PENALTY` в search-docs). Замер на этой задаче — одна
    // секция mcp из четырёх источников (`## 6. choose_api`, где эта формулировка стоит
    // примером правила). Больше одной означает, что понижение перестало работать.
    const r = await buildContext(k, {
      task: 'поле B доступно только когда A заполнено',
      target: 'core',
    });
    const own = r.sources.filter((u) => u.includes('/mcp/'));
    expect(own.length, `секции mcp вытесняют библиотечные: ${own.join(', ')}`).toBeLessThanOrEqual(
      1
    );
  });

  it.runIf(hasDocs)('прикладная задача получает имена файлов ТЕЛОМ, а не ссылкой', async () => {
    // Замер до правки (`.tmp/layout-check/report.md`): на этом самом запросе ответ занимал
    // 3 926 символов и не содержал НИ ОДНОГО канонического имени — ни `profile:"full"`, ни
    // явный `topics:['form-directory-layout']` этого не меняли. Причина: doc-секции попадают
    // в `get_context` только списком URI в `## Read more`, а прикладная формулировка
    // («кредитная заявка») layout-секцию не ранжирует вовсе.
    const r = await buildContext(k, {
      task: 'собрать многошаговую форму кредитной заявки',
      target: 'renderer-json',
    });
    for (const file of ['renderer.schema.ts', 'renderer.behavior.ts', 'form.behavior.ts']) {
      expect(r.text, `имя ${file} не доехало телом ответа`).toContain(file);
    }
    // Спорные имена доставлены — значит есть чем сверить: обе ручки названы тут же.
    expect(r.text).toContain('find_recipe directory-layout');
    expect(r.text).toMatch(/validate_form kind="layout"/);
  });

  it.runIf(hasDocs)('набор имён свой у каждого target, лишнего не приносит', async () => {
    const task = 'сделать форму заявки на кредит';
    const core = await buildContext(k, { task, target: 'core' });
    expect(core.text).toContain('form.schema.ts');
    expect(core.text, 'core не знает слоя рендера').not.toContain('renderer.schema.ts');
    expect(core.text, 'реестр компонентов — только у renderer-json').not.toContain('registry.ts');

    const react = await buildContext(k, { task, target: 'renderer-react' });
    expect(react.text).toContain('renderer.behavior.ts');
    expect(react.text).not.toContain('registry.ts');
  });

  it.runIf(hasDocs)('вопрос «куда положить» доезжает без слова «форма»', async () => {
    // Формулировки из `eval/corpus/07-layout.json`: спрашивают про ОДИН файл и предмета
    // «форма» не содержат вовсе, поэтому признак «предмет + глагол сборки» их не ловит —
    // ловит прямой вопрос о размещении.
    const cases: Array<[string, string, string]> = [
      [
        'куда положить поведение модели — computeFrom, enableWhen, copyFrom',
        'core',
        'form.behavior.ts',
      ],
      [
        'куда положить поведение слоя рендера — renderEffect, hideWhen по узлам схемы',
        'renderer-react',
        'renderer.behavior.ts',
      ],
      ['как назвать файл JSON-схемы формы на renderer-json', 'renderer-json', 'renderer.schema.ts'],
      [
        'куда положить app-shim компонента визарда для формы на JSON-схеме',
        'renderer-json',
        // Опциональный файл — то самое имя, вместо которого придумывали `json-wizard.tsx`.
        'renderer.wizard.tsx',
      ],
    ];
    for (const [task, target, expected] of cases) {
      const r = await buildContext(k, { task, target });
      expect(r.text, `"${task}" → ${expected} не доехал`).toContain(expected);
    }
  });

  it.runIf(hasDocs)('узкий вопрос про оператор не платит за раскладку', async () => {
    // Обратная сторона: блок стоит ~85 токенов, и в ответе «каким оператором» он лишний.
    const r = await buildContext(k, {
      task: 'поле B доступно только когда A заполнено',
      target: 'core',
    });
    expect(r.parts).not.toContain('layout');
    expect(r.text).not.toContain('index.tsx');
  });

  it('описание инструмента не выдаёт себя за замену choose_api', () => {
    // Замерено: как ЕДИНСТВЕННЫЙ вызов get_context даёт first-pass 69.6% против 95.7%
    // у choose_api + точечного поиска. Описание обязано направлять к дешёвому инструменту.
    expect(getContextToolDefinition.description).toMatch(/choose_api/);
  });
});
