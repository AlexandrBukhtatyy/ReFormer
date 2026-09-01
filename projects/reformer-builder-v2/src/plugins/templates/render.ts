/**
 * Шаблон формы, описанный ШАБЛОНИЗАТОРОМ, а не подстановкой имени.
 *
 * ## Что это добавляет
 *
 * Снимок каталога умеет ровно одно: заменить имя формы в четырёх написаниях. Ни условия,
 * ни цикла, ни второй переменной — поэтому две формы из одного шаблона отличаются только
 * строкой имени, и «шаблон под нашу команду» приходится доводить руками после каждой генерации.
 *
 * С `engine: "eta"` шаблон получает тот же язык, на котором написаны встроенные цели кодогена.
 * А если шаблон несёт СХЕМУ ФОРМЫ, он получает и весь вид генерации: цикл по полям, ветвление
 * по наличию визарда, имена компонентов из активного кита.
 *
 * ## Почему схема, а не отдельная настройка
 *
 * Искать её не нужно: `formSchemaFileOf` уже ищет схему в наборе — по ней решают, какой файл
 * открыть после генерации. Тот же ответ служит и здесь, и это не совпадение: «шаблон, у
 * которого есть схема» и «шаблон, про который есть что рассказать» — одно и то же множество.
 *
 * ## Токены и движок не смешиваются
 *
 * Шаблон либо токенный, либо на Eta. Смесь дала бы два правила подстановки в одном файле и
 * вопрос «что применяется раньше», у которого нет хорошего ответа. Снимок каталога
 * по-прежнему производит токенные шаблоны — для произвольных файлов проекта (css, конфиги)
 * подстановка честнее шаблона, который их автор не писал.
 *
 * @module plugins/templates/render
 */

import { buildView, prepare, renderTemplate, type CodegenView, type KitView } from '@/lib/codegen';
import { nameVariants } from './placeholders';
import type { FormTemplate, TemplateFile } from './contract';
import { formSchemaFileOf } from './files';

/** Что видит шаблон формы как `it`. */
export interface FormTemplateView {
  /** Имя формы, как его ввёл человек. */
  readonly name: string;
  /** То же имя в четырёх написаниях — прямая замена прежним токенам. */
  readonly pascal: string;
  readonly camel: string;
  readonly kebab: string;
  readonly snake: string;
  /** Про сам шаблон: подписать сгенерированное его именем — обычная нужда. */
  readonly template: { readonly id: string; readonly name: string };
  /**
   * Полный вид генерации — когда шаблон несёт схему формы и кит активен.
   *
   * `null` в двух случаях, и различать их шаблону не нужно: схемы в наборе нет либо кита
   * не выбрали. В обоих рассказывать о форме нечего, и ветвление `it.form !== null` —
   * ровно тот вопрос, который автор шаблона и должен задать.
   */
  readonly form: CodegenView | null;
}

export interface TemplateViewOptions {
  /** Активный кит. Без него вид формы не собрать — импортировать компоненты неоткуда. */
  readonly kit?: KitView | null;
}

export function buildTemplateView(
  template: FormTemplate,
  formName: string,
  options: TemplateViewOptions = {}
): FormTemplateView {
  const variants = nameVariants(formName);
  const kit = options.kit ?? null;
  const found = kit === null ? null : formSchemaFileOf(template.files);

  return {
    name: formName,
    pascal: variants.pascal,
    camel: variants.camel,
    kebab: variants.kebab,
    snake: variants.snake,
    template: { id: template.id, name: template.name },
    form:
      found === null || kit === null
        ? null
        : buildView(prepare({ schema: found.schema, formName, kit })),
  };
}

/**
 * Отрисовать путь и содержимое одного файла.
 *
 * Имя в кэше составное — шаблон плюс файл: под одним именем лежала бы то одна цель, то другая,
 * и сообщение об ошибке называло бы не тот файл.
 *
 * Бросок наружу НЕ перехватывается: у операции есть путь «отказ — это результат с ключом
 * словаря», и сообщение Eta с номером строки доедет до панели как есть.
 */
export function renderTemplateFile(
  template: FormTemplate,
  file: TemplateFile,
  view: FormTemplateView
): TemplateFile {
  const key = `template:${template.id}:${file.path}`;
  return {
    ...file,
    path: renderTemplate(`${key}:path`, file.path, view),
    content: renderTemplate(key, file.content, view),
  };
}
