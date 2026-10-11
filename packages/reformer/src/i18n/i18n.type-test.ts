/**
 * Compile-time тест локализации `@reformer/core/i18n`. Проверяется `tsc` (файл под `src`,
 * `include: ["src"]`); vitest его НЕ запускает — нет суффикса `.test.`.
 *
 * Убеждается, что:
 *  - `defineIssueMessages` выводит коды словаря литералами и проверяет значения как `IssueMessage` —
 *    шаблон либо функцию `(params, i18n) => string`, где `params` — `unknown`-значения;
 *  - `resolveIssueMessage` принимает замечание без текста и отдаёт строку;
 *  - `msg` создаёт описатель, а `defineMessages` проверяет ключ при компиляции;
 *  - `createI18n`, `extendLocale` и `FormLocale` — данные только для чтения с типизированными полями.
 *
 * Дефекты типов размечены `[ReFormer-xxxx]`: строка под `@ts-expect-error` с меткой обязана
 * компилироваться после исправления, строка с меткой в комментарии — перестать компилироваться.
 */

import { msg, defineMessages, type LocalizableText, type MessageDescriptor } from './descriptor';
import { DEFAULT_LOCALE, extendLocale, type FormLocale, type Messages } from './locale';
import { resolveLocalized } from './resolve-localized';
import { createI18n, type I18nHandle } from './translator';
import {
  defineIssueMessages,
  resolveIssueMessage,
  type IssueMessage,
  type IssueMessages,
} from './validation-message';

/** Словарь формы: свои коды, шаблон ICU и функция с разрядами числа. */
export const loanMessages = defineIssueMessages({
  'loan.amount.required': 'Укажите сумму кредита',
  'loan.purpose.minLength': 'Минимум {minLength, plural, one{# символ} other{# символов}}',
  'loan.amount.min': (params, i18n) => `Не меньше ${i18n.number(Number(params.min))} ₽`,
});

/** Код словаря формы. */
type LoanCode = keyof typeof loanMessages;

export function issueMessageTypeChecks(i18n: I18nHandle): void {
  // Ключи словаря — литералы: опечатка в коде ловится при компиляции.
  const code: LoanCode = 'loan.amount.required';
  // @ts-expect-error — такого кода в словаре нет
  const unknownCode: LoanCode = 'loan.amount.max';
  // Значение-шаблон тоже остаётся литералом.
  const template: 'Укажите сумму кредита' = loanMessages['loan.amount.required'];
  // Словарь подходит туда, где ждут словарь формы.
  const messages: IssueMessages = loanMessages;

  // IssueMessage — шаблон или функция `(params, i18n) => string`.
  const byTemplate: IssueMessage = 'Не меньше {min}';
  const byFunction: IssueMessage = (params, handle) => handle.t('loan.min', params);
  // @ts-expect-error — функция словаря возвращает строку
  const returnsNumber: IssueMessage = (params) => Number(params.min);
  // @ts-expect-error — значение словаря — шаблон либо функция
  defineIssueMessages({ 'loan.amount.min': 42 });
  // @ts-expect-error — параметры замечания — `unknown`: число из них приводят явно
  defineIssueMessages({ 'loan.amount.min': (params) => params.min.toFixed() });

  // Резолвер: замечание из кода и параметров → строка.
  const builtin: string = resolveIssueMessage({ code: 'required' }, i18n);
  const own: string = resolveIssueMessage(
    { code: 'loan.amount.min', params: { min: 1 } },
    i18n,
    messages
  );
  // @ts-expect-error — у замечания нет текста: строку даёт словарь
  resolveIssueMessage({ code: 'required', message: 'Обязательное поле' }, i18n);
  // @ts-expect-error — резолвер принимает замечание, а не код строкой
  resolveIssueMessage('required', i18n);

  void [code, unknownCode, template, byTemplate, byFunction, returnsNumber, builtin, own];
}

export function descriptorTypeChecks(i18n: I18nHandle): void {
  // Описатель подписи: ключ, значения и английский текст на случай промаха.
  const label: MessageDescriptor = msg('profile.email.label');
  const counted: MessageDescriptor = msg('cart.items', { count: 3 }, '{count} items');
  const text: LocalizableText = label;
  const plain: LocalizableText = 'Почта';
  // @ts-expect-error — описатель — не строка: текст по нему даёт локаль
  const asString: string = label;
  // @ts-expect-error — значения подстановок — объект
  msg('cart.items', 3);

  // `defineMessages` — `msg` с ключами английского словаря приложения.
  const app = defineMessages({ 'profile.email.label': 'Email', 'profile.title': 'Profile' });
  const typed: MessageDescriptor = app.msg('profile.title', { name: 'Анна' });
  // @ts-expect-error — опечатка в ключе — ошибка компиляции
  app.msg('profile.emial.label');
  // @ts-expect-error — английский текст типизированный `msg` берёт из словаря сам
  app.msg('profile.title', {}, 'Profile');
  // @ts-expect-error — английский словарь — строки
  defineMessages({ 'profile.title': 42 });

  // Без описателей значение возвращается того же типа.
  const props: { label: string; size: number } = resolveLocalized(
    { label: 'Почта', size: 3 },
    i18n
  );
  // @ts-expect-error [ReFormer-ir4n] описатель раскрывается в строку — тип результата должен быть `string`
  const resolved: string = resolveLocalized(msg('profile.email.label'), i18n);
  // [ReFormer-ir4n] сейчас компилируется, а не должно: в рантайме `label` уже строка — `key` у неё нет;
  // тип `resolveLocalized<T>(value: T): T` описатели не раскрывает.
  void resolveLocalized({ label: msg('profile.email.label') }, i18n).label.key;

  void [counted, text, plain, asString, typed, props, resolved];
}

export function localeTypeChecks(): void {
  // Локаль — данные: код языка, словарь, необязательные первый день недели и формат даты.
  const ru: FormLocale = {
    code: 'ru',
    messages: { 'cart.items': '{count, plural, one{# товар} few{# товара} other{# товаров}}' },
    weekStartsOn: 1,
    dateFormat: 'dd.MM.yyyy',
  };
  const fallback: FormLocale = DEFAULT_LOCALE;
  const dictionary: Messages = ru.messages;
  // @ts-expect-error — у локали обязателен словарь
  const withoutMessages: FormLocale = { code: 'ru' };
  // @ts-expect-error — сообщения словаря — строки ICU
  const numericMessage: FormLocale = { code: 'ru', messages: { 'cart.items': 3 } };
  // @ts-expect-error — поля локали только для чтения
  ru.code = 'en';
  // @ts-expect-error — словарь только для чтения
  ru.messages['cart.items'] = '{count} шт.';

  // extendLocale: словари сливаются, остальные поля заменяются.
  const appRu: FormLocale = extendLocale(ru, { messages: { 'profile.title': 'Профиль' } });
  const sundayFirst: FormLocale = extendLocale(appRu, { weekStartsOn: 0 });
  // @ts-expect-error — первый день недели — 0…6
  extendLocale(ru, { weekStartsOn: 7 });
  // @ts-expect-error — сообщения — строки
  extendLocale(ru, { messages: { 'profile.title': 1 } });
  // @ts-expect-error — код языка — строка
  extendLocale(ru, { code: 7 });

  // createI18n: ручка локали — перевод и форматирование строками.
  const i18n: I18nHandle = createI18n(appRu);
  const translated: string = i18n.t('cart.items', { count: 3 }, '{count} items');
  const number: string = i18n.number(1536.5, { maximumFractionDigits: 1 });
  const date: string = i18n.date(new Date(), { dateStyle: 'medium' });
  const size: string = i18n.fileSize(1536);
  const known: boolean = i18n.has('cart.items');
  const sameLocale: FormLocale = i18n.locale;
  // @ts-expect-error — ручке нужна локаль целиком, а не код языка
  createI18n('ru');
  // @ts-expect-error — подстановки — объект значений
  i18n.t('cart.items', 3);
  // @ts-expect-error — код языка ручки только для чтения
  i18n.code = 'en';

  void [fallback, dictionary, withoutMessages, numericMessage, sundayFirst, translated, number];
  void [date, size, known, sameLocale];
}
