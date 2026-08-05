/**
 * Имена, производные от имени формы, для сгенерированного примера: каталог, TS-тип, компонент
 * страницы, маршрут. Один источник — чтобы эмиттеры не расходились.
 *
 * @module reformer-builder/codegen/naming
 */

export interface Names {
  /** kebab-имя папки примера. */
  dir: string;
  /** PascalCase-тип формы (`LoanApplicationForm`). */
  TypeName: string;
  /** Экспорт-компонент страницы (`LoanApplicationPage`). */
  pageComponent: string;
  /** Маршрут в react-playground (`/examples/<dir>`). */
  routePath: string;
  /** Идентификатор примера (== dir). */
  exampleId: string;
  /** Человекочитаемый заголовок. */
  title: string;
  /** Имя фабрики модели (`createLoanApplicationFormModel`). */
  modelFactory: string;
  /** Имя константы записи реестра форм (`loanApplicationFormEntry`). */
  entryConst: string;
}

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/** Кириллица → латиница (для имён папок/типов/selector-ов). Прочее — без изменений. */
export function translit(s: string): string {
  return s.replace(/[а-яё]/gi, (ch) => {
    const lower = ch.toLowerCase();
    const mapped = TRANSLIT[lower] ?? ch;
    return ch === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
  });
}

/** `AnyCase Строка` → `any-case-stroka` (транслит кириллицы; латиница/цифры; разделитель — дефис). */
export function kebab(s: string): string {
  return translit(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
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

/** Собрать все производные имена из свободного имени формы (имя файла/ввод пользователя). */
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
    // Запись реестра: camelCase от типа + Entry (`loanApplicationFormEntry`).
    entryConst: `${TypeName.charAt(0).toLowerCase()}${TypeName.slice(1)}Entry`,
  };
}
