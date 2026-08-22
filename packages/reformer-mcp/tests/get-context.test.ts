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
import { buildContext } from '../src/context/builder';
import { getContextTool, getContextToolDefinition } from '../src/tools/get-context';
import { listAvailablePackages } from '../src/utils/docs-parser';

const hasDocs = listAvailablePackages().length > 0;

describe('get_context', () => {
  it('пустая задача → внятное сообщение, а не падение', async () => {
    for (const task of [undefined, '', '   ']) {
      const { content } = await getContextTool({ task: task as string });
      expect(content[0].text).toMatch(/task/i);
    }
  });

  it.runIf(hasDocs)('сработавшее правило ведёт выдачу и даёт сигнатуру', async () => {
    const r = await buildContext({
      task: 'поле B доступно только когда A заполнено',
      target: 'core',
    });
    expect(r.text).toMatch(/^## Use `enableWhen`/m);
    expect(r.text).toContain('## API');
    expect(r.symbols[0]).toBe('enableWhen');
  });

  it.runIf(hasDocs)('без уверенности не выдумывает блок API', async () => {
    // Запрос намеренно не ложится ни на одно правило и не имеет опорных секций.
    const r = await buildContext({ task: 'zzqq wubble frotz plugh', target: 'core' });
    expect(r.symbols, 'символ без подтверждения секцией не должен попадать в выдачу').toEqual([]);
    expect(r.text).not.toContain('## API');
  });

  it.runIf(hasDocs)('minimal дешевле implementation и не теряет сигнатуру', async () => {
    const task = 'проверить на сервере, что email не занят';
    const min = await buildContext({ task, target: 'core', profile: 'minimal' });
    const impl = await buildContext({ task, target: 'core', profile: 'implementation' });
    expect(min.tokens).toBeLessThan(impl.tokens);
    expect(min.text).toContain('## API');
  });

  it.runIf(hasDocs)('maxTokens соблюдается и перекрывает профиль', async () => {
    const r = await buildContext({
      task: 'проверить на сервере, что email не занят',
      target: 'core',
      profile: 'full',
      maxTokens: 120,
    });
    expect(r.tokens).toBeLessThanOrEqual(140); // допуск на склейку разделителей
    expect(r.dropped + (r.truncated ? 1 : 0), 'что-то обязано было выпасть').toBeGreaterThan(0);
  });

  it.runIf(hasDocs)('выпавшие по бюджету блоки названы в ответе', async () => {
    const { content } = await getContextTool({
      task: 'проверить на сервере, что email не занят',
      target: 'core',
      maxTokens: 100,
    });
    expect(content[0].text).toMatch(/не поместились в бюджет|обрезан/);
  });

  it.runIf(hasDocs)('целевой стек не тянет в выдачу секции чужих пакетов', async () => {
    // Проверяем ИСТОЧНИКИ, а не наличие строки: в каноническом примере renderer-json
    // законно стоит `import { Input, Box } from '@reformer/ui-kit'`, и запрещать это
    // значило бы требовать неполный пример.
    const r = await buildContext({ task: 'описать форму JSON-схемой', target: 'renderer-json' });
    expect(r.sources.every((u) => !u.includes('/ui-kit/'))).toBe(true);
    const apiBlock = r.text.match(/## API[\s\S]*?(?=\n## |$)/)?.[0] ?? '';
    expect(apiBlock).not.toContain('@reformer/ui-kit');
  });

  it('описание инструмента не выдаёт себя за замену choose_api', () => {
    // Замерено: как ЕДИНСТВЕННЫЙ вызов get_context даёт first-pass 69.6% против 95.7%
    // у choose_api + точечного поиска. Описание обязано направлять к дешёвому инструменту.
    expect(getContextToolDefinition.description).toMatch(/choose_api/);
  });
});
