/**
 * Имена, производные от имени формы: каталог, тип, компонент страницы, маршрут, фабрика модели.
 *
 * Один источник — чтобы эмиттеры не расходились: `types.ts` объявляет тип, `model.ts` его
 * импортирует, `index.tsx` называет им компонент, а `README.md` печатает путь. Разъехаться
 * они могут только все сразу.
 *
 * Транслитерация и `kebab` сюда НЕ переехали: они нужны модели раньше всякого экспорта
 * (имя селектора выводится из подписи узла) и потому живут в `lib/form-model/naming`.
 *
 * @module lib/codegen/naming
 */

import { kebab } from '../form-model/naming';

export interface Names {
  /** kebab-имя папки модуля формы. */
  readonly dir: string;
  /** PascalCase-тип формы (`LoanApplicationForm`). */
  readonly TypeName: string;
  /** Экспорт-компонент страницы (`LoanApplicationPage`). */
  readonly pageComponent: string;
  /** Маршрут в приложении-хосте (`/examples/<dir>`). */
  readonly routePath: string;
  /** Идентификатор формы в реестре форм (== dir). */
  readonly exampleId: string;
  /** Человекочитаемый заголовок. */
  readonly title: string;
  /** Имя фабрики модели (`createLoanApplicationFormModel`). */
  readonly modelFactory: string;
  /** Имя константы записи реестра форм (`loanApplicationFormEntry`). */
  readonly entryConst: string;
}

/** `any-case` → `AnyCase`. */
export function pascal(s: string): string {
  return kebab(s)
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/** `loan-application` → `Loan application`. */
export function humanize(s: string): string {
  const words = kebab(s).replace(/-/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Форма';
}

/** Собрать все производные имена из свободного имени формы (имя файла или ввод человека). */
export function makeNames(formName: string): Names {
  const dir = kebab(formName) || 'form';
  const base = pascal(formName) || 'Form';
  const TypeName = base.endsWith('Form') ? base : `${base}Form`;
  return {
    dir,
    TypeName,
    pageComponent: `${base.endsWith('Form') ? base.slice(0, -4) : base}Page`,
    routePath: `/examples/${dir}`,
    exampleId: dir,
    title: humanize(formName),
    modelFactory: `create${TypeName}Model`,
    entryConst: `${TypeName.charAt(0).toLowerCase()}${TypeName.slice(1)}Entry`,
  };
}
