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
 * Искать её не нужно: стек шаблона уже находит документ формы в наборе — по нему решают, какой
 * файл открыть после генерации. Тот же ответ служит и здесь, и это не совпадение: «шаблон, у
 * которого есть схема» и «шаблон, про который есть что рассказать» — одно и то же множество.
 * Вид собирает стек (`TemplateStack.view`): что такое поля, визард и компоненты кита, знает он.
 *
 * ## Токены и движок не смешиваются
 *
 * Шаблон либо токенный, либо на Eta. Смесь дала бы два правила подстановки в одном файле и
 * вопрос «что применяется раньше», у которого нет хорошего ответа. Снимок каталога
 * по-прежнему производит токенные шаблоны — для произвольных файлов проекта (css, конфиги)
 * подстановка честнее шаблона, который их автор не писал.
 *
 * @module plugins/forms/templates/render/render
 */

import type { TemplateStack } from '@reformer/builder-plugin-api';
import { renderTemplate } from '@reformer/builder-toolkit';
import { nameVariants } from './placeholders';
import type { FormTemplate, TemplateFile } from '../contract';
import { templateStackOf } from '../content/stacks';

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
   * Вид формы от стека шаблона — когда шаблон несёт документ формы и стеку есть что рассказать
   * (у ReFormer — полный вид генерации под активный кит).
   *
   * `null`, когда рассказывать нечего, и различать причины шаблону не нужно: документа в наборе
   * нет, стека нет, кита не выбрали. Ветвление `it.form !== null` — ровно тот вопрос, который
   * автор шаблона и должен задать.
   */
  readonly form: object | null;
}

export interface TemplateViewOptions {
  /** Стеки шаблонов: вид формы собирает стек шаблона. Без них вида формы нет. */
  readonly stacks?: readonly TemplateStack[];
}

export function buildTemplateView(
  template: FormTemplate,
  formName: string,
  options: TemplateViewOptions = {}
): FormTemplateView {
  const variants = nameVariants(formName);
  const stack = templateStackOf(options.stacks ?? [], template.files);

  return {
    name: formName,
    pascal: variants.pascal,
    camel: variants.camel,
    kebab: variants.kebab,
    snake: variants.snake,
    template: { id: template.id, name: template.name },
    // Вид — по файлам шаблона ДО отрисовки: документ формы в них уже лежит.
    form: stack?.view?.(template.files, formName) ?? null,
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
