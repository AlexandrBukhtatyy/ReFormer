/**
 * Двойники стека шаблонов: печатники встроенных шаблонов и стек ReFormer с китом.
 *
 * Отдельным модулем, а не в файле теста: печатники нужны и тестам встроенного хранилища, и тестам
 * обеих сторон (`../cross`) — там шаблон раскладывается хозяином.
 *
 * @module plugins/reformer/templates/testing
 */

import type { FormTemplate, FormTemplateFile, TemplateStack } from '@reformer/builder-plugin-api';
import { renderTemplate, withMarker } from '@reformer/builder-toolkit';
import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  apiTemplate,
  barrelTemplate,
  buildView,
  createTemplate,
  entryTemplate,
  makeNames,
  messagesTemplate,
  modelTemplate,
  moduleFilesOf,
  pageTemplate,
  prepare,
  typesTemplate,
  type KitView,
} from '../../core/codegen';
import { builtinKit } from '../../core/testing';
import { BUILTIN_BASE_NAME, type ModulePrinter } from './builtin';
import { createTemplateStack } from './stack';

/** Имена и пути модуля под базовое имя — то, что печатник получает и по чему печатает. */
export const BASE = makeNames(BUILTIN_BASE_NAME);
export const LAYOUT = moduleFilesOf(BASE);

/**
 * Печатник-двойник: шесть файлов в раскладке кодогена, с именами модуля в путях и текстах.
 *
 * Состав подобран по ролям: страница, две части ядра (модель и тип), запись реестра форм,
 * реэкспорты и README — на них и держатся зависимости файлов шаблона.
 */
export const fakePrinter: ModulePrinter = async () => [
  { path: LAYOUT.page, content: `export default function ${BASE.TypeName}() {}` },
  { path: LAYOUT.model, content: `export const ${BASE.modelFactory} = 1;` },
  { path: LAYOUT.types, content: `export type ${BASE.TypeName} = {};` },
  { path: LAYOUT.entry, content: `export const ${BASE.entryConst} = '${BASE.exampleId}';` },
  { path: LAYOUT.barrel, content: `export { default } from './${BASE.TypeName}';` },
  { path: LAYOUT.readme, content: `# ${BASE.title}` },
];

/** Файлы модуля, как их напечатал бы кодоген для формы с таким именем — НАСТОЯЩИМИ эмиттерами. */
export function emitted(schema: JsonFormSchema, formName: string): FormTemplateFile[] {
  const view = buildView(prepare({ schema, formName, kit: builtinKit() }));
  const files = view.layout.files;
  const stamped = (path: string, key: string, body: string): FormTemplateFile => ({
    path,
    // Производные файлы кодоген метит маркером происхождения; авторские (`api`) — нет.
    content: withMarker(renderTemplate(`test.builtin.${key}`, body, view)),
  });
  return [
    stamped(files.types, 'types', typesTemplate),
    stamped(files.model, 'model', modelTemplate),
    stamped(files.create, 'create', createTemplate),
    stamped(files.entry, 'entry', entryTemplate),
    stamped(files.page, 'page', pageTemplate),
    stamped(files.barrel, 'barrel', barrelTemplate),
    { path: files.api, content: renderTemplate('test.builtin.api', apiTemplate, view) },
    // Словарь замечаний — авторский, как и запросы: маркера не несёт и не регенерируется.
    {
      path: files.messages,
      content: renderTemplate('test.builtin.messages', messagesTemplate, view),
    },
  ];
}

/**
 * Печатник на НАСТОЯЩИХ эмиттерах домена.
 *
 * Ради него встроенные шаблоны и переписаны: пока это были «рыбы», проверить, что шаблон
 * совпадает с выводом кодогена, было нечем — совпадение держалось на внимательности автора.
 */
export const realPrinter: ModulePrinter = async (schema, formName) => emitted(schema, formName);

/** Пути файлов МОДУЛЯ шаблона: всё, кроме фикстуры, — её кодоген не печатает. */
export const modulePaths = (template: FormTemplate): string[] =>
  template.files.filter((f) => (f.scope ?? 'form') === 'form').map((f) => f.path);

/** Имена форм, на которых написания имени расходятся с именами кодогена. */
export const FORM_NAMES = [
  // Несколько слов: каталог — kebab, тип — PascalCase, запись реестра — camelCase.
  'my form',
  // Кириллица с пробелом: транслитерация участвует в каждом имени.
  'Профиль пользователя',
  // Имя уже оканчивается на `Form`: суффикс типа не удваивается.
  'contact form',
  // Заглавные подряд: `kebab` билдера слова не разбивает.
  'ABCForm',
  'loan-request-2',
];

/** Стек ReFormer с китом; `kit: null` — кита нет. По умолчанию — встроенный кит. */
export function reformerStack(options: { readonly kit?: KitView | null } = {}): TemplateStack {
  const view = options.kit === undefined ? builtinKit() : options.kit;
  return createTemplateStack({ kit: () => view });
}
