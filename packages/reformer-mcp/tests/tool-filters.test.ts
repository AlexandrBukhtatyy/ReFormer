/**
 * Сужение выдачи инструментов знания: фильтры `list_symbols` и `package` у `get_symbol_docs`.
 * Чтение спеки с диска в `plan_form` — `plan-form.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { getSymbolDocsTool } from '../src/core/tools/get-symbol-docs';
import { listSymbolsTool } from '../src/core/tools/list-symbols';
import { cliKnowledge } from '../src/platform/cli/knowledge';
import { getPublicSymbols } from '../src/platform/cli/symbols-parser';
import { precondition } from './support/preconditions';

const knowledge = cliKnowledge();
const hasSymbols = precondition(
  'символы @reformer/core',
  getPublicSymbols('@reformer/core').length > 0,
  'npm run build в пакетах (нужны llms.txt и llms-index.json)'
);

describe.runIf(hasSymbols)('list_symbols: фильтры', () => {
  const listed = async (args: Parameters<typeof listSymbolsTool>[0]) =>
    (await listSymbolsTool(args, knowledge)).content[0].text;

  it('package оставляет один пакет и принимает короткое имя', async () => {
    const text = await listed({ package: 'core', nameContains: 'createForm' });
    expect(text).toContain('## @reformer/core');
    expect(text).not.toContain('## @reformer/cdk');
    expect(text).not.toContain('## @reformer/ui-kit');
  });

  it('nameContains не зависит от регистра и отбрасывает остальное', async () => {
    const text = await listed({ package: 'core', nameContains: 'CREATEFORM' });
    expect(text).toContain('createForm');
    expect(text).not.toContain('computeFrom');
  });

  it('kind оставляет только свой вид', async () => {
    const onlyTypes = await listed({ package: 'core', kind: 'interface', nameContains: 'form' });
    const onlyFunctions = await listed({ package: 'core', kind: 'function', nameContains: 'form' });
    // Имя упоминается и в описаниях соседних символов, поэтому сверяются сами строки списка.
    const rows = (text: string) => text.split('\n').filter((line) => line.startsWith('- `'));
    expect(rows(onlyFunctions).join('\n')).toContain('- `createForm` (function)');
    expect(rows(onlyTypes).length).toBeGreaterThan(0);
    expect(rows(onlyTypes).every((row) => row.includes('(interface)'))).toBe(true);
  });

  it('пустая выборка называет применённые фильтры', async () => {
    const text = await listed({ package: 'core', kind: 'enum', nameContains: 'нетТакогоИмени' });
    expect(text).toMatch(/No public symbols/);
    expect(text).toContain('`enum`');
    expect(text).toContain('нетТакогоИмени');
  });
});

describe.runIf(hasSymbols)('get_symbol_docs: package', () => {
  const docs = async (symbol: string, packageName?: string) =>
    (await getSymbolDocsTool({ symbol, package: packageName }, knowledge)).content[0].text;

  it('при коллизии имён package выбирает вариант', async () => {
    expect(await docs('FormField', 'cdk')).toContain('@reformer/cdk');
    expect(await docs('FormField', 'ui-kit')).toContain('@reformer/ui-kit');
  });

  it('символ чужого пакета не находится и ответ называет пакет', async () => {
    const text = await docs('createForm', 'ui-kit');
    expect(text).toMatch(/not found/);
    expect(text).toContain('ui-kit');
  });
});
