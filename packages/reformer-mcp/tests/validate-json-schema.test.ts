/**
 * `validate_json_schema` против примеров документации.
 *
 * Пример из llms-доков — то, что агент скопирует первым. Если валидатор его бракует, агент «чинит»
 * рабочую схему и уходит от рекомендованного пути: так было со структурной формой `$locale` с
 * параметрами (ReFormer-3vz) — конвертер её понимает, а проверка `componentProps` по схемам пропсов
 * кита отвергала как «label must be string».
 *
 * Проверка `componentProps` включается, только если доступен собранный `@reformer/ui-kit/meta`, —
 * без него пример прошёл бы и до исправления, поэтому это предусловие теста.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, it, expect } from 'vitest';
import { validateJsonSchemaTool } from '../src/core/tools/validate-json-schema';
import { loadUiKitPropSchemas } from '../src/core/generate/ui-kit-props';
import { precondition } from './support/preconditions';

const hasKitProps = precondition(
  'схемы пропсов @reformer/ui-kit/meta',
  (await loadUiKitPropSchemas()) !== undefined,
  'npm run build -w @reformer/ui-kit'
);

const I18N_DOC = resolve(__dirname, '../../reformer-renderer-json/docs/llms/08-i18n.md');

/** Узел из jsonc-блока документации, в котором есть подстрока `marker`; строки-комментарии снимаются. */
function docNode(marker: string): unknown {
  const doc = readFileSync(I18N_DOC, 'utf8');
  const block = [...doc.matchAll(/```jsonc\n([\s\S]*?)```/g)]
    .map((m) => m[1])
    .find((body) => body.includes(marker));
  if (!block) throw new Error(`В ${I18N_DOC} нет jsonc-примера с ${marker}`);
  const json = block
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  return JSON.parse(json);
}

const asDocument = (node: unknown) => ({ format: 2, root: node });

describe('validate_json_schema — примеры локализации из docs/llms renderer-json', () => {
  // Первый вызов грузит ajv и компилирует схемы пропсов кита — под нагрузкой (параллельные воркеры,
  // сборка рядом) это дольше дефолтных 5 с, и падал бы по таймауту первый тест, какой ни запусти.
  // Цена платится один раз здесь, с явным таймаутом.
  beforeAll(async () => {
    await validateJsonSchemaTool({ schema: asDocument({ component: '$component(Box)' }) });
  }, 30_000);

  it.runIf(hasKitProps)('структурная форма `$locale` с params — валидна', async () => {
    const node = docNode('"$locale":');
    // Пример действительно про структурную форму — иначе тест проверял бы не то.
    expect(node).toMatchObject({ componentProps: { label: { $locale: expect.any(String) } } });

    const { content } = await validateJsonSchemaTool({ schema: asDocument(node) });
    expect(content[0].text).toMatch(/✅ valid/);
    expect(content[0].text).not.toMatch(/must be string/);
  });

  it.runIf(hasKitProps)('строковый оператор `$locale(key)` — валиден', async () => {
    const node = docNode('$locale(fields.email.label)');
    const { content } = await validateJsonSchemaTool({ schema: asDocument(node) });
    expect(content[0].text).toMatch(/✅ valid/);
  });

  it.runIf(hasKitProps)('объект без `$locale` на месте строки — по-прежнему ошибка', async () => {
    const schema = asDocument({
      model: '$model(password)',
      component: '$component(Input)',
      componentProps: { label: { key: 'fields.min' } },
    });
    const { content } = await validateJsonSchemaTool({ schema });
    expect(content[0].text).toMatch(/❌ invalid/);
    expect(content[0].text).toMatch(/label/);
  });
});
