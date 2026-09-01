/**
 * Единственный оставшийся эмиттер, печатающий текст КОДОМ.
 *
 * Одиннадцать целей из двенадцати переведены на шаблоны, и их проверки не пропали, а заменены
 * на строго более сильные: `plugins/codegen/golden.test.ts` держит ПОБАЙТОВЫЙ снимок каждого
 * файла на семи комбинациях схемы, кита и правил, тогда как здесь лежала подстрока в одной.
 *
 * `renderer.schema.json` остаётся кодом навсегда, и довод не в лени: это `JSON.stringify`.
 * Шаблон здесь означал бы рукописную сериализацию JSON — то есть round-trip редактора схемы
 * (ради которого схема и лежит данными, а не литералом) зависел бы от чужих кавычек.
 *
 * @module reformer-builder/lib/codegen/emit.test
 */

import { describe, expect, it } from 'vitest';
import { builtinKit, plainSchema } from './__fixtures__/kit';
import { prepare, type CodegenInput, type EmitContext } from './context';
import { emitSchema } from './emit/schema';

function ctxOf(input: Partial<CodegenInput> = {}): EmitContext {
  return prepare({
    schema: input.schema ?? plainSchema(),
    formName: input.formName ?? 'Заявка на кредит',
    kit: input.kit ?? builtinKit(),
    rules: input.rules,
  });
}

describe('renderer.schema.json', () => {
  it('шапка проставляется, если её не было', () => {
    const json: unknown = JSON.parse(emitSchema(ctxOf()));
    expect(json).toMatchObject({ $schema: './form-schema.schema.json', version: '1.0' });
  });

  it('вывод остаётся разбираемым JSON, а не текстом с комментарием', () => {
    // Отказ был ровно здесь: строка-маркер `//` первой делала файл неразбираемым, и редактор
    // схемы открывал форму голым текстом вместо канваса. Маркер сюда не ставится (`acceptsMarker`),
    // но собственный вывод обязан оставаться JSON и без него.
    expect(() => JSON.parse(emitSchema(ctxOf()))).not.toThrow();
  });
});
