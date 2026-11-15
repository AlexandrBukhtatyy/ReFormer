/**
 * Кнопка отправки формы: подпись и функция отправки, которые называет текст (задание, спека), узел
 * кнопки в раскладке и обработчик её нажатия в поведении формы.
 *
 * Одно место на трёх потребителей: черновик по спеке (`plan_form`), правка `submit` профиля guided и
 * разметка core от сервера. Иначе кнопка спеки, кнопка правки и кнопка разметки разошлись бы в
 * подписи и в том, что делает нажатие.
 *
 * Нажатие на рендерерах — правило узла `onComponentEvent`. Кнопка вне мастера сама проверяет всю
 * форму (`validateModel` со схемой `formValidation`, замечания показываются) и только потом зовёт
 * функцию отправки. Кнопку мастера проверяет `FormWizard` через `bundle.submission` — его событие
 * `onSubmit` приходит уже после проверки. На core правил узлов нет: функцию зовёт разметка, через
 * `bundle.submission.submit`.
 *
 * @module reformer-mcp/core/generate/submit
 */

import type { LayoutNode, NodeRuleIntent } from './form-intent.js';

/** Селектор узла кнопки отправки в раскладке. */
export const SUBMIT_SELECTOR = 'submit';

/** Модуль функции отправки — `api.ts` каталога формы: заглушку пишет сборка. */
export const SUBMIT_MODULE = './api';

/** Функция отправки, когда текст её не называет. */
export const DEFAULT_SUBMIT_HANDLER = 'submitForm';

/** Имя функции: идентификатор JS. */
export const isHandlerName = (name: string): boolean => /^[A-Za-z_$][\w$]*$/.test(name);

/**
 * Подпись кнопки отправки, названная текстом: «кнопка «Зарегистрироваться»», «кнопка мастера
 * «Оформить заказ»». Между кнопкой и подписью — только эти слова: «кнопка добавления «+ Добавить
 * товар»» — кнопка массива, а не отправки. Текст кнопки не называет — `null`.
 */
export function namedSubmitLabel(text: string | undefined): string | null {
  const named =
    /(?:кнопк[а-яё]*|button)(?:\s+(?:мастера|отправки|формы|wizard|submit))?\s*[«"“]([^»"”\n]{1,40})[»"”]/i.exec(
      text ?? ''
    )?.[1];
  return named?.trim() ? named.trim() : null;
}

/**
 * Функция отправки, названная текстом: «Отправляет значения формы функцией `submitOrder(values)` из
 * `./api`». Строка должна говорить о кнопке или отправке: функция загрузки справочника — не она.
 */
export function namedSubmitHandler(text: string | undefined): string | null {
  for (const line of (text ?? '').split('\n')) {
    if (!/кнопк|button|отправ|submit/i.test(line)) continue;
    const name = /`([A-Za-z_$][\w$]*)\([^)`]*\)`\s*(?:из|from)\s*`\.\/api(?:\.ts)?`/i.exec(
      line
    )?.[1];
    if (name) return name;
  }
  return null;
}

/** Узел кнопки отправки: `Button` с селектором `submit`; `type: "button"` — формы-тега у рендерера нет. */
export function submitButtonNode(label: string): LayoutNode {
  return {
    kind: 'container',
    component: 'Button',
    selector: SUBMIT_SELECTOR,
    componentProps: { type: 'button' },
    children: [{ kind: 'text', text: label }],
  };
}

/**
 * Обработчик отправки — правило узла. `wizard` — селектор мастера: его событие `onSubmit` приходит
 * после проверки формы. Без него — нажатие кнопки (`selector`, по умолчанию `submit`): проверка всей
 * формы с показом замечаний, потом отправка.
 */
export function submitEventRule(
  handler: string,
  wizard?: string,
  selector: string = SUBMIT_SELECTOR
): NodeRuleIntent {
  return wizard
    ? {
        kind: 'onComponentEvent',
        selector: wizard,
        event: 'onSubmit',
        expr: `await ${handler}(model.get())`,
      }
    : {
        kind: 'onComponentEvent',
        selector,
        event: 'onClick',
        expr: `if (await validateModel(model, formValidation, { touch: true })) await ${handler}(model.get());`,
      };
}

/** Вызов функции отправки со значениями формы: `submitOrder(model.get())`. */
const callRe = (name: string): RegExp =>
  new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, '\\$')}\\s*\\(\\s*model\\.get\\(\\)\\s*\\)`, 'g');

/**
 * Код зовёт функцию только как отправку — `name(model.get())` — или не зовёт вовсе. Такая функция —
 * отправка формы: её заготовка принимает значения формы.
 */
export function onlySubmits(code: readonly string[], name: string): boolean {
  const mention = new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`);
  return code.every((part) => !mention.test(part.replace(callRe(name), '$1')));
}
