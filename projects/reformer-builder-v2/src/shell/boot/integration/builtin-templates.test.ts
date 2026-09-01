/**
 * Встроенные шаблоны — против настоящего печатника и настоящего предиката редактора схемы.
 *
 * Проверяется стык, который не виден ни одному из тестов по отдельности: шаблоны печатает
 * КОДОГЕН, а открывает напечатанное РЕДАКТОР СХЕМЫ, и плагины друг друга не импортируют —
 * встретиться они могут только здесь, в композиции. Разошлись они молча: `renderer.schema.json`
 * уезжал со строкой-маркером `//` первой, переставал быть JSON, и форма, созданная по шаблону,
 * открывалась голым текстом вместо канваса.
 *
 * @module shell/boot/integration/builtin-templates.test
 */

import { describe, expect, it } from 'vitest';
import { builtinKit } from '@/lib/codegen/__fixtures__/kit';
import { BUILTIN_TARGETS, generateModule } from '@/plugins/codegen';
import { looksLikeFormSchema } from '@/plugins/editor-schema/provider';
import {
  createBuiltinStore,
  materializeFiles,
  TOKENS,
  type ModulePrinter,
} from '@/plugins/templates';

/** Тот же переходник к кодогену, что собирает композиция в `./boot`. */
function printer(): ModulePrinter {
  const view = builtinKit();
  return async (schema, formName, seed) => {
    const built = await generateModule(BUILTIN_TARGETS, {
      schema,
      formName,
      rules: seed?.rules,
      mock: seed?.mock,
      kit: { kit: view.kit, catalog: view.catalog },
    });
    return built.files.map(({ path, content }) => ({ path, content }));
  };
}

describe('форма по встроенному шаблону открывается редактором схемы', () => {
  it('напечатанная схема — разбираемый json, который берёт редактор', async () => {
    const templates = await createBuiltinStore({ print: printer() }).list();
    expect(templates.length).toBeGreaterThan(0);

    for (const template of templates) {
      const files = materializeFiles(
        template,
        template.files.map((file) => file.path),
        'test'
      );
      const schema = files.find((file) => file.path === 'renderer.schema.json');

      expect(schema, `шаблон «${template.name}» без схемы`).toBeDefined();
      // Предикат ТОТ ЖЕ, по которому оболочка выбирает редактор: два разных ответа на этот
      // вопрос означали бы вкладку с текстом там, где ожидается канвас.
      expect(looksLikeFormSchema(schema?.content ?? ''), template.name).toBe(true);
    }
  });
});

/**
 * Проверка, переживающая переформатирование.
 *
 * Заведена под перевод печати на шаблонизатор: golden-снимки ловят СДВИГ вывода, но молчат про
 * два отказа, которые от раскладки не зависят вовсе, — недоподставленный токен и пустой файл.
 * Первый уезжает пользователю буквально строкой `__FormName__` в коде, второй выглядит как
 * успешно созданная форма, у которой нечего открыть.
 *
 * Транспиляция сюда сознательно НЕ добавляется: она тянет чанк `typescript` на 3.5 МБ и снесла
 * бы бюджет node-прогона в 7-8 секунд ради проверки, которую делает сборка примера.
 */
describe('встроенный шаблон материализуется без следов затравки', () => {
  it('ни один токен имени не выжил и ни один файл не пуст', async () => {
    const templates = await createBuiltinStore({ print: printer() }).list();
    expect(templates.length).toBeGreaterThan(0);

    for (const template of templates) {
      const files = materializeFiles(
        template,
        template.files.map((file) => file.path),
        // Кириллица с пробелом: транслитерация участвует в каждом файле, а базовое имя
        // затравки (`sample`) обязано исчезнуть и из путей, и из текстов.
        'Профиль пользователя'
      );
      expect(files.length, template.name).toBeGreaterThan(0);

      for (const file of files) {
        const where = `${template.name} → ${file.path}`;
        expect(file.content.trim(), where).not.toBe('');
        for (const token of Object.values(TOKENS)) {
          expect(file.path, where).not.toContain(token);
          expect(file.content, where).not.toContain(token);
        }
      }
    }
  });
});
