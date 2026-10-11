/**
 * Имена, производные от имени формы: каталог, тип, компонент страницы, маршрут, фабрики.
 *
 * Один источник — чтобы файлы модуля не расходились: `types/<dir>.ts` объявляет тип,
 * `model/model.ts` его импортирует, страница `<Type>.tsx` называется им же, а `README.md`
 * печатает путь. Разъехаться они могут только все сразу.
 *
 * Транслитерация и `kebab` сюда НЕ переехали: они нужны модели раньше всякого экспорта
 * (имя селектора выводится из подписи узла) и потому живут в `lib/form-model/naming`.
 *
 * @module plugins/reformer/core/codegen/naming
 */

import { kebab } from '@reformer/builder-toolkit';

export interface Names {
  /** kebab-имя формы: папка модуля и имя файлов ролей (`types/<dir>.ts`). */
  readonly dir: string;
  /** PascalCase-тип формы (`LoanApplicationForm`). */
  readonly TypeName: string;
  /**
   * Компонент страницы — он же имя её файла (`LoanApplicationForm.tsx`). Совпадает с
   * {@link Names.TypeName}: тип формы в файл страницы не импортируется, и столкнуться им негде.
   */
  readonly pageComponent: string;
  /** Маршрут в приложении-хосте (`/examples/<dir>`). */
  readonly routePath: string;
  /** Идентификатор формы в реестре форм (== dir). */
  readonly exampleId: string;
  /** Человекочитаемый заголовок. */
  readonly title: string;
  /** Имя фабрики модели (`createLoanApplicationFormModel`). */
  readonly modelFactory: string;
  /** Имя сборки формы (`createLoanApplicationForm`). */
  readonly formFactory: string;
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

/** `any-case` → `anyCase`. */
export function camel(s: string): string {
  const name = pascal(s);
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/** `loan-application` → `Loan application`. */
export function humanize(s: string): string {
  const words = kebab(s).replace(/-/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Форма';
}

/**
 * Псевдоним правил шага в потоке: camelCase имени шага и `Rules` — `kontakty-2` → `kontakty2Rules`.
 *
 * Имя, начинающееся не с буквы (`2024-god`), идентификатором быть не может — ему достаётся
 * приставка `step`. Совпадения разводит вызывающий: имена шагов уникальны, а их camelCase — нет
 * (`a-1` и `a1`).
 */
export function stepRulesAlias(stepName: string): string {
  const base = camel(stepName);
  return `${/^[A-Za-z_$]/.test(base) ? base : `step${pascal(stepName)}`}Rules`;
}

/** Собрать все производные имена из свободного имени формы (имя файла или ввод человека). */
export function makeNames(formName: string): Names {
  const dir = kebab(formName) || 'form';
  const base = pascal(formName) || 'Form';
  const TypeName = base.endsWith('Form') ? base : `${base}Form`;
  return {
    dir,
    TypeName,
    pageComponent: TypeName,
    routePath: `/examples/${dir}`,
    exampleId: dir,
    title: humanize(formName),
    modelFactory: `create${TypeName}Model`,
    formFactory: `create${TypeName}`,
    entryConst: `${TypeName.charAt(0).toLowerCase()}${TypeName.slice(1)}Entry`,
  };
}
