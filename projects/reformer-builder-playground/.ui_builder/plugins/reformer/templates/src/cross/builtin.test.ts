/**
 * Встроенные шаблоны стека ReFormer, разложенные хозяином под имя формы: пути и тексты — те же,
 * что напечатала бы генерация кода.
 *
 * Тест обеих сторон: шаблон даёт стек, раскладывает (подстановка токенов модуля, печать под имя)
 * хозяин.
 *
 * @module plugins/reformer/templates/cross/builtin.test
 */

import { describe, expect, it, vi } from 'vitest';
import { isGenerated } from '@reformer/builder-toolkit';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { makeNames, moduleFilesOf } from '../../../core/codegen';
import type { TemplateFile } from '../contract';
import { applyTemplate, materializeFiles, type MaterializeOptions } from '../content/files';
import {
  BUILTIN_BASE_NAME,
  createBuiltinStore,
  type ModulePrinter,
  type SeedExtras,
} from '../stack/builtin';
import { simpleSeed } from '../stack/seeds';
import {
  BASE,
  emitted,
  FORM_NAMES,
  modulePaths,
  realPrinter,
  reformerStack,
} from '../stack/testing';

/** Стек ReFormer у хозяина: токены имён модуля и документ формы. */
const OPTIONS: MaterializeOptions = { stacks: [reformerStack()] };

describe('встроенный шаблон, разложенный под имя формы', () => {
  it.each(FORM_NAMES)('«%s»: пути шаблона — те же, что напечатал бы кодоген', async (formName) => {
    const [simple] = await createBuiltinStore({ print: realPrinter }).list();

    // Пути — ПОДСТАНОВКОЙ в пути шаблона: по ним окно создания формы показывает состав, и по
    // ним же текст, напечатанный под имя, находит своё место.
    const files = materializeFiles(simple, modulePaths(simple), formName, OPTIONS);

    // Расхождение здесь — это сироты после первой же генерации из билдера: шаблон положил бы
    // `types/myForm.ts`, а кодоген рядом — `types/my-form.ts`.
    const expected = emitted(simpleSeed(), formName);
    expect(files.map((f) => f.path)).toEqual(expected.map((f) => f.path));
    const layout = moduleFilesOf(makeNames(formName));
    expect(files.map((f) => f.path)).toContain(layout.page);
    expect(files.map((f) => f.path)).toContain(layout.types);
  });

  it.each(FORM_NAMES)('«%s»: и тексты те же — байт в байт, вместе с маркером', async (formName) => {
    const [simple] = await createBuiltinStore({ print: realPrinter }).list();

    // Так форму создаёт операция: шаблон печатается под её имя (`applyTemplate`).
    const files = await applyTemplate(simple, modulePaths(simple), formName, OPTIONS);

    // Имена, импорты, заголовок, РАСКЛАДКА СТРОК — всё, что кодоген выводит из имени формы,
    // шаблон обязан вывести так же. Сравнение целиком, а не по списку имён: список всегда короче
    // того, что напечатано.
    expect(files).toEqual(emitted(simpleSeed(), formName));
    // Файл обязан остаться «сгенерированным»: «правленный руками» билдер не перегенерирует из
    // правил формы. Авторские файлы (запросы, словарь замечаний) маркера не несут.
    const layout = moduleFilesOf(makeNames(formName));
    const authored = new Set([layout.api, layout.messages]);
    for (const file of files.filter((f) => !authored.has(f.path))) {
      expect(isGenerated(file.content), file.path).toBe(true);
    }
  });

  it('раскладку строк подстановка не переносит — поэтому под имя шаблон печатается', async () => {
    const [simple] = await createBuiltinStore({ print: realPrinter }).list();
    const model = moduleFilesOf(makeNames('my form')).model;
    const textOf = (files: readonly TemplateFile[]): string =>
      files.find((f) => f.path === model)?.content ?? '';
    const oneLine =
      'export function createMyFormModel(initial?: Partial<MyForm>): FormModel<MyForm> {';

    // Под базовое имя сигнатура фабрики модели в строку не помещается и порвана; под короткое
    // имя формы помещается — и кодоген её не рвёт. Подстановка переносит имена, но не перенос.
    const substituted = textOf(materializeFiles(simple, modulePaths(simple), 'my form', OPTIONS));
    expect(substituted).toContain('export function createMyFormModel(\n');
    expect(substituted).not.toContain(oneLine);

    const printed = textOf(await applyTemplate(simple, modulePaths(simple), 'my form', OPTIONS));
    expect(printed).toContain(oneLine);
  });

  it('под имя формы печатается та же затравка тем же печатником', async () => {
    const calls: { name: string; schema: JsonFormSchema; seed: SeedExtras | undefined }[] = [];
    const capturing: ModulePrinter = (schema, formName, seed) => {
      calls.push({ name: formName, schema, seed });
      return realPrinter(schema, formName, seed);
    };
    const [simple] = await createBuiltinStore({ print: capturing }).list();
    const listed = calls.find((call) => call.name === BUILTIN_BASE_NAME);
    calls.length = 0;

    await applyTemplate(simple, modulePaths(simple), 'Профиль пользователя', OPTIONS);

    // Один вызов — под имя формы; схема, правила и данные — те, из которых напечатан список.
    // Другая затравка дала бы форму, состав которой расходится с показанным в окне создания.
    expect(calls.map((call) => call.name)).toEqual(['Профиль пользователя']);
    expect(calls[0].schema).toBe(listed?.schema);
    expect(calls[0].seed).toBe(listed?.seed);
  });

  it('печатник отказал под имя формы — форма раскладывается подстановкой, а не пропадает', async () => {
    // Плагин генерации выгрузили между показом списка и созданием формы: печатать под имя нечем.
    // Имена в подстановочном тексте верны — модуль собирается; раскладку поправит форматтер.
    const fading: ModulePrinter = async (schema, formName, seed) => {
      if (formName !== BUILTIN_BASE_NAME) throw new Error('печатника больше нет');
      return realPrinter(schema, formName, seed);
    };
    const [simple] = await createBuiltinStore({ print: fading }).list();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const files = await applyTemplate(simple, modulePaths(simple), 'my form', OPTIONS);

    expect(files).toEqual(materializeFiles(simple, modulePaths(simple), 'my form', OPTIONS));
    expect(files.map((f) => f.path)).toEqual(emitted(simpleSeed(), 'my form').map((f) => f.path));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('ни одного следа базового имени не остаётся', async () => {
    const [simple] = await createBuiltinStore({ print: realPrinter }).list();
    const files = materializeFiles(
      simple,
      simple.files.map((f) => f.path),
      'Профиль пользователя',
      OPTIONS
    );
    const text = files.map((f) => `${f.path}\n${f.content}`).join('\n');

    for (const trace of [BASE.TypeName, BASE.entryConst, BASE.dir, BASE.title, 'TemplateSeed']) {
      expect(text, trace).not.toContain(trace);
    }
    expect(text.toLowerCase()).not.toContain('template seed');
    expect(text.toLowerCase()).not.toContain('templateseed');
  });
});
