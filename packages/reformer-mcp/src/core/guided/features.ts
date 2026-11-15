/**
 * Признаки задачи для плана профиля guided: какие этапы сборки нужны форме.
 *
 * Определяются детерминированно — по словам задания и по разбору спеки, без модели. Это и есть
 * роль планировщика: малая модель сама не держит маршрут (бросает путь сборки, переписывает intent
 * целиком), поэтому этапы называет сервер, а модель их исполняет (план
 * `docs/plans/lucky-popping-wall.md`).
 *
 * Ошибка в признаке не тупик. Лишний этап модель пропускает (`form_status` с `skip`), а
 * недостающий не мешает добавлять правки любого вида на любом этапе.
 *
 * @module reformer-mcp/core/guided/features
 */

import type { SpecAnalysis } from '../spec/analyze.js';

/** Что, кроме полей, есть в задаче. */
export interface TaskFeatures {
  /** Повторяющиеся строки: список контактов, позиций. */
  readonly arrays: boolean;
  /** Шаги мастера. */
  readonly wizard: boolean;
  /** Ограничения значений: обязательность, формат, диапазоны. */
  readonly validation: boolean;
  /** Проверка над несколькими полями: подтверждение пароля, «не раньше чем». */
  readonly cross: boolean;
  /** Реакции: вычисляемые поля, условные поля, копирование. */
  readonly behavior: boolean;
}

// `\b` в регулярках JS знает только латиницу: у русских слов граница — `(?<![а-яё])`.
// «password repeat» (повтор пароля) — не строки: голое «repeat» давало этап массивов
// (L2-registration-lite, 20261113T191026Z-aaee).
// «Из списка», «выпадающий список» — выбор из вариантов, а не строки: «город из списка» давал этап
// массивов, которого в задаче нет (L2-profile-json).
const ARRAYS =
  /(несколько|(?<!(?:из|выпадающ[а-яё]*)\s+)спис(?:к|о)|строк[аиу]?(?![а-яё])|массив|повторя|добавить ещ|добавля|(?<![а-яё])от\s+\d+\s+до\s+\d+\s+(строк|запис|контакт|позиц|участник|элемент|телефон|адрес)|\brows?\b|\blist of\b|\brepeat(?:ing|able)\b|\brepeat\s+(?:rows?|items?|entries)\b|\badd (another|more)\b|\bmultiple\b)/i;
const WIZARD = /(шаг|этап|мастер|wizard|\bsteps?\b|\bpages?\b|страниц)/i;
const VALIDATION =
  /(обязател|required|не (менее|более|короче|длиннее|пуст)|минимум|максимум|(?<![а-яё])от\s+\d+\s+до\s+\d+|формат|e-?mail|почт|длин|\bmin\b|\bmax\b|маск|valid|целое|положительн|больше|меньше|\bat least\b|\bat most\b)/i;
const CROSS =
  /(совпада|подтвержд|повтор\S*\s+парол|не (позже|раньше)|раньше чем|позже чем|\bmatch|\bconfirm)/i;
// «При доставке … видны; при самовывозе не видно» — видимость по условию (L3-delivery).
const BEHAVIOR =
  /(видн[ыао]?(?![а-яё])|не видно|скрыт|станов[ия]тся|станут|\bvisible\b|\bhidden\b|\bbecomes?\b|только (если|когда|для|при)|если выбран|при выборе|показыва|скрыва|появля|зависит|считается|вычисл|рассчит|автоматически|итог|сумм|умнож|скидк|только для чтения|копир|\bonly (if|when)\b|\bshow\b|\bhide\b|comput|calculat|\btotal\b|\bdepends\b)/i;

/**
 * Слово задания, которое называет проверку («обязательными», «формат», «от 2 до 100»). Валидацию с
 * таким словом не пропускают: модель уходила через `skip`, и «при доставке обязательны адрес и
 * дата» оставалось без правил (L3-delivery, 20261113T220710Z-1415).
 */
export function validationWord(text: string): string | undefined {
  return VALIDATION.exec(text)?.[0];
}

/**
 * Слово задания, которое однозначно требует поведения: формула, «считается сам», видимость по
 * условию. Уже, чем признак этапа: «сумма» и «итог» бывают и простыми полями. Этап с таким словом не
 * пропускают — модель снимала его через `skip`, и формула и видимость терялись (L3-refund,
 * 20261113T220710Z-1415).
 */
const BEHAVIOR_STRONG =
  /(\s=\s|считает(?:ся)?\s+сам|вычисля|рассчитыва|видн[ыао]?(?![а-яё])|виден|скрыт|показыва|появля|\bcomputed?\b|\bcalculated\b|\bvisible\b|\bhidden\b|\bshown\b)/i;

export function behaviorWord(text: string): string | undefined {
  return BEHAVIOR_STRONG.exec(withoutHiddenInput(text))?.[0].trim();
}

/**
 * Скрытый ввод пароля — вид поля, а не видимость: «пароль … ввод скрыт» давал этап поведения, его
 * нельзя было снять, а пример предлагал чужие `total` и `address` — модель на core ушла писать
 * index.tsx руками (батч 20261114T200104Z-358f, registration-create).
 */
export function withoutHiddenInput(text: string): string {
  return text.replace(
    /ввод\p{L}*\s+скрыт\p{L}*|скрыт\p{L}*\s+ввод\p{L}*|\bhidden\s+input\b|\binput\s+(?:is\s+)?hidden\b|\bmasked\b/giu,
    ' '
  );
}

/**
 * Слово задания про правило между полями («должен совпадать с паролем»). Этап с ним не пропускают:
 * модель снимала `cross`, и повтор пароля ничего не проверял (L2-registration-lite,
 * 20261113T230859Z-f59e).
 */
export function crossWord(text: string): string | undefined {
  return CROSS.exec(text)?.[0].trim();
}

/** Признаки по словам задания. */
export function featuresFromText(text: string): TaskFeatures {
  return {
    arrays: ARRAYS.test(text),
    wizard: WIZARD.test(text),
    validation: VALIDATION.test(text),
    cross: CROSS.test(text),
    behavior: BEHAVIOR.test(withoutHiddenInput(text)),
  };
}

/**
 * Признаки по спеке: разбор знает шаги, массивы, вычисляемые и условные поля; слова спеки
 * добавляют то, чего разбор не извлекает (проверки над несколькими полями).
 */
export function featuresFromSpec(analysis: SpecAnalysis, text: string): TaskFeatures {
  const words = featuresFromText(text);
  return {
    arrays: analysis.arrays.length > 0,
    wizard: analysis.steps > 0,
    validation: true,
    cross: words.cross,
    behavior:
      analysis.computedFields.length > 0 ||
      analysis.conditionalFields.length > 0 ||
      analysis.dependencies.length > 0,
  };
}

/**
 * Признаки задания поверх спецификации: «по spec.md, но пошаговую — мастер вместо одной страницы».
 * План брал признаки одной спеки, и этапа мастера не было (wizard-create, батч
 * 20261114T235104Z-4e30, ReFormer-f2fs.23).
 */
export function mergeFeatures(first: TaskFeatures, second: TaskFeatures): TaskFeatures {
  return {
    arrays: first.arrays || second.arrays,
    wizard: first.wizard || second.wizard,
    validation: first.validation || second.validation,
    cross: first.cross || second.cross,
    behavior: first.behavior || second.behavior,
  };
}
