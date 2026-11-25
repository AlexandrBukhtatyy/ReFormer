/**
 * `FormIntent` — промежуточный контракт между «что нужно от формы» и файлами бандла.
 *
 * Зачем отдельное представление, а не сразу код. В ReFormer **JSON несёт только layout**:
 * контракт `JsonFormSchema` — это дерево узлов со строковыми операторами (`$model`,
 * `$component`, `$dataSource`), и ПОВЕДЕНИЕ в нём невыразимо by design. Валидация,
 * вычисляемые поля, условная видимость и навигация живут в отдельных TS-DSL над той же
 * моделью. Поэтому «форма» — это всегда бандл из нескольких файлов, и им нужен общий
 * источник истины, иначе они разъезжаются.
 *
 * Отсюда форма контракта: **плоский реестр сущностей** (поля, массивы, правила, поведение)
 * плюс **дерево layout**, которое ссылается на них по имени.
 *
 * Здесь — сам контракт, имена, нормализация уже канонического intent (умолчания и `warnings`) и
 * пути модели. Чтение произвольного ввода в intent сюда не входит.
 */

import type { ModelBehaviorKind, NodeBehaviorKind } from './operator-kinds.js';
import { normalizeFieldComponent, NO_UI_KIT, type UiKitComponents } from './ui-kit.js';

/**
 * Версия контракта intent: записи и их ключи, коды находок судьи, грамматика документа и то, что
 * документ держит (`./document`). Растёт при несовместимой правке любого из них. Потребитель,
 * встроивший компилятор (ассистент конструктора), сверяет её со своей: обёртки грамматики и перенос
 * в документ написаны под конкретную версию.
 */
export const INTENT_CONTRACT_VERSION = 1;

/** Тип значения поля в модели. */
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';

export interface FieldIntent {
  /** Имя поля в модели. Оно же — `selector` узла, если не задан отдельно. */
  name: string;
  /** Путь в модели; по умолчанию совпадает с `name`. */
  modelPath?: string;
  type: FieldType;
  /** Имя компонента в реестре (`Input`, `Select`, …). */
  component: string;
  componentProps?: Record<string, unknown>;
  label?: string;
  initialValue?: unknown;
  /** Имя `$dataSource(...)` для полей выбора. */
  optionsSource?: string;
  /**
   * Имя `$dataSource(...)` подсказок поля со свободным вводом: значение остаётся текстом, подсказка
   * его только подставляет. Поле рисует `InputSuggest` (проп `suggestions`).
   */
  suggestionsSource?: string;
  /** Селектор узла для render-поведения; по умолчанию — `name`. */
  selector?: string;
}

export interface ArrayIntent {
  name: string;
  modelPath?: string;
  /** Имя интерфейса элемента — попадёт в `model.ts`. */
  itemInterfaceName: string;
  itemFields: FieldIntent[];
  /**
   * Начальное значение обязательно: узел массива без него ломается на первом `add`,
   * и это ровно та ошибка, которую `validateFormSchema` поймать не может.
   */
  initialValue: unknown[];
  /** Компонент, рисующий строки (`FieldArray` из ui-kit либо свой). */
  component?: string;
  /**
   * Пропсы компонента массива: у `FieldArray` — `title`, `addButtonLabel` («+ Добавить
   * имущество»), `itemLabel`, `emptyMessage`, `reorderable`. Без них кнопка добавления — с
   * подписью по умолчанию, и пользователь (и e2e по подписи) её не узнаёт.
   */
  componentProps?: Record<string, unknown>;
}

/** Правило валидации над одним путём модели. */
export interface ValidationRuleIntent {
  /** Путь в модели. Для правил внутри массива — `items.field`. */
  target: string;
  /** Правило применяется к каждому элементу массива с этим именем. */
  each?: string;
  /** Условие активности правила → `validateWhen`. */
  when?: string;
  /** Имена валидаторов: `required`, `email`, `minLength(2)`, … */
  rules: string[];
  /**
   * Асинхронная проверка: имя функции, которую напишет разработчик, либо сама функция
   * выражением `async (value, { signal }) => issue | null` — печатается как есть.
   */
  async?: string;
  /**
   * Кросс-полевая проверка → `cross(target, (values) => …)`: выражение над снимком формы
   * `values` (у правила строки массива — снимком строки), которое должно быть ИСТИННЫМ; ложное
   * даёт замечание {@link code}. Пример: `values.confirmPassword === values.password`.
   */
  cross?: string;
  /**
   * Вызов своего оператора валидации — печатается в схему как есть:
   * `phoneOrEmail(model.$.phone, model.$.email)`. Оператор объявлен в {@link FormIntent.operators};
   * у правила строки массива строку читают как `item`.
   */
  call?: string;
  /** Код замечания кросс-полевой или асинхронной проверки. По умолчанию у `cross` — `cross`. */
  code?: string;
  /** Текст замечания с кодом {@link code} — для словаря формы (`defineIssueMessages`). */
  message?: string;
  /**
   * Замечание `cross` — предупреждение: показывается, но отправку не блокирует. По умолчанию —
   * ошибка.
   */
  severity?: 'error' | 'warning';
  /**
   * Параметры замечания `cross`: имя → выражение над снимком `values`. Текст словаря подставляет
   * их по имени: `{max}` в «не больше {max}».
   */
  params?: Record<string, string>;
}

/**
 * Реактивная связь над моделью: оператор ядра (`kind` — его имя) либо вызов своего оператора
 * (`kind: 'call'`, вызов — в `expr`, оператор объявлен в {@link FormIntent.operators}).
 */
export interface BehaviorIntent {
  kind: ModelBehaviorKind | 'call';
  /**
   * Поле, которое поведение ПИШЕТ. У `exclusiveFlag` — флаг строки (`contacts.primary`), у
   * `aggregateInto` — сам массив, в строки которого пишется итог, у `call` — поле, которое меняет
   * свой оператор.
   */
  target: string;
  /**
   * Поведение КАЖДОЙ строки массива с этим путём → `applyEach(model.$.<each>, ({ model: item }) => …)`.
   * Цель и источники — поля строки полным путём (`items.lineTotal`) или от строки (`lineTotal`);
   * выражение читает строку как `item`, форму — как `model`. У `exclusiveFlag` обязателен.
   */
  each?: string;
  /** Поля, которые оно ЧИТАЕТ. Из них строится проверка циклов. */
  sources: string[];
  /**
   * Тело выражения на TS — вставляется как есть. У `copyFrom` — условие копирования
   * (`{ when: () => expr }`), например `model.sameEmail === true`.
   */
  expr?: string;
  /**
   * Условие вычисления у `compute` и `computeFrom` → `{ when: () => … }`: пока оно ложно, поле не
   * пересчитывается и хранит то, что в нём есть. Пример: первоначальный взнос считается только
   * для ипотеки — `model.loanType === 'mortgage'`.
   */
  when?: string;
  options?: Record<string, unknown>;
}

/**
 * Правило узла схемы: событие компонента, реактивный эффект или хук жизненного цикла. В
 * `form.intent.json` пишется записью `behavior` со своим `kind`; узел — по `selector` из
 * `layoutRoot`. Исполняет рендерер, поэтому на таргете `core` правило не печатается.
 */
export interface NodeRuleIntent {
  kind: NodeBehaviorKind;
  /** Узел схемы. У `renderEffect` его нет: эффект живёт, пока смонтирована схема. */
  selector?: string;
  /** Проп-событие компонента у `onComponentEvent`: `onSubmit`, `onChange`, … */
  event?: string;
  /**
   * Тело обработчика на TS — вставляется как есть. `await` делает обработчик асинхронным; у
   * `onComponentEvent` аргументы события — `args`, у `onMount` и `renderEffect` тело может
   * вернуть очистку: `return () => clearInterval(timer);`.
   */
  expr: string;
}

/** Правило видимости в render-слое. */
export interface VisibilityIntent {
  /** Селектор узла в схеме. */
  selector: string;
  /** Условие, при котором узел СКРЫТ. */
  condition: string;
}

export interface DataSourceIntent {
  name: string;
  /** Комментарий-подсказка, откуда берутся значения. */
  note?: string;
  /**
   * Значения справочника — варианты поля выбора: `{ value, label }` либо примитивы (станут
   * `{ value: x, label: String(x) }`). Печатаются в `data-sources.ts`; без них справочник —
   * пустой массив с пометкой, и поле выбора рисуется без вариантов.
   */
  values?: unknown[];
}

export interface WizardIntent {
  steps: Array<{ title: string; icon?: string; selector?: string; fields: string[] }>;
}

/** Узел layout-дерева. Листья ссылаются на поля/массивы ПО ИМЕНИ, не встраивают их. */
export type LayoutNode =
  | { kind: 'field'; ref: string }
  // `selector` у массива — точка адресации для behavior/visibility. Без него генератор
  // подставлял имя массива, и правило, ссылавшееся на собственный selector из intent,
  // адресовало узел, которого в разметке нет.
  | { kind: 'array'; ref: string; selector?: string }
  // Подформа: именованная часть (`FormIntent.parts`), подключённая к группе модели. `ref` — путь
  // группы в области узла. Листья части ссылаются на поля ОТНОСИТЕЛЬНО группы (`city`, а не
  // `registrationAddress.city`), поэтому одна часть подключается к нескольким группам.
  | { kind: 'part'; ref: string; part: string; selector?: string }
  | {
      kind: 'container';
      component: string;
      htmlTag?: string;
      componentProps?: Record<string, unknown>;
      selector?: string;
      children: LayoutNode[];
    }
  | { kind: 'step'; title: string; icon?: string; selector?: string; children: LayoutNode[] }
  // Текст среди детей: заголовок, абзац, подпись кнопки — страница, а не только форма. Строка в
  // `children` — ссылка на поле, поэтому текст — запись `{ "text": … }` (ReFormer-11oe.16).
  | { kind: 'text'; text: string };

export type ReformerTargetStack = 'core' | 'renderer-react' | 'renderer-json';

/**
 * Фреймворк формы на `renderer-json`: реестр и документ у трёх одни, различаются кит и вход
 * формы. Фреймворк — свойство кита (`kit.framework` его каталога); в intent его пишут, чтобы
 * пересборка не зависела от того, откуда её запустили.
 */
export type ReformerFramework = 'react' | 'vue' | 'angular';

export interface FormIntent {
  formName: string;
  /** Имя интерфейса модели, PascalCase. */
  interfaceName: string;
  target: ReformerTargetStack;
  /**
   * Фреймворк формы на `renderer-json`. Нет — фреймворк кита приложения (`kit.framework`), без
   * кита — `react`. У `core` и `renderer-react` — только `react`.
   */
  framework?: ReformerFramework;
  layout: 'minimalist' | 'folders';
  layoutRoot: LayoutNode;
  /**
   * Именованные части разметки — подформы. Подключаются узлом `{ kind: 'part', ref, part }`.
   * Листья части ссылаются на поля относительно группы подключения. Строки массивов сюда не
   * входят: их часть генератор строит сам из `ArrayIntent.itemFields`.
   */
  parts?: Record<string, LayoutNode>;
  fields: FieldIntent[];
  arrays: ArrayIntent[];
  validation: ValidationRuleIntent[];
  behavior: BehaviorIntent[];
  /** Правила узлов схемы: события компонентов, эффекты рендера, хуки жизненного цикла. */
  nodes?: NodeRuleIntent[];
  visibility: VisibilityIntent[];
  dataSources: DataSourceIntent[];
  /**
   * Свои операторы: имя → модуль, из которого его импортирует сборка (`./operators` — файл
   * `operators.ts` каталога формы). Так подключаются свои правила (`rules`), свои операторы
   * валидации (`call` правила), свои операторы поведения (`kind: 'call'`) и функции, которые
   * читают выражения. Модулю каталога формы `form_build` пишет заготовку, пока её не правили.
   */
  operators?: Record<string, string>;
  wizard?: WizardIntent;
  /** Всё, чего не хватило для полного бандла, — видно потребителю. */
  warnings: string[];
}

/** Слова произвольной строки → `PascalCase`-идентификатор (нелатиница отбрасывается). */
/**
 * Транслитерация кириллицы — та же таблица, что у кодогенерации конструктора
 * (`@reformer/builder-toolkit`, `naming.ts`): «Заявка на кредит» даёт `ZayavkaNaKredit…` и здесь,
 * и там. Без неё кириллическое имя формы вырезалось в пустую строку, и интерфейс получал
 * безликое `FormShape`, а компонент сборки — `FormShapeForm` (калибровка, трек T2).
 */
const TRANSLIT: Readonly<Record<string, string>> = {
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

function translit(source: string): string {
  return source.replace(/[а-яё]/gi, (ch) => {
    const lower = ch.toLowerCase();
    const mapped = TRANSLIT[lower] ?? ch;
    return ch === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
  });
}

function toPascal(source: string): string {
  return translit(String(source))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
    .replace(/[^A-Za-z0-9]/g, '');
}

/** `Заявка на кредит` → `ZayavkaNaKreditShape`, `Credit application` → `CreditApplicationShape`. */
export function deriveInterfaceName(formName: string): string {
  const pascal = toPascal(formName);
  // Имя без букв и цифр («—», пусто) даёт пустой идентификатор — тогда дефолт лучше огрызка.
  return pascal.length >= 2 ? `${pascal}Shape` : 'FormShape';
}

/** Имя компонента формы из её названия: `Заявка на кредит` → `ZayavkaNaKreditForm`. */
export function deriveComponentName(formName: string): string | null {
  const pascal = toPascal(formName);
  if (pascal.length < 2) return null;
  return /Form$/.test(pascal) ? pascal : `${pascal}Form`;
}

/**
 * Имя, под которым сущность попадёт и в модель, и в разметку.
 *
 * `null` означает «читать нечего». Без этой проверки поле без `name` доезжало до билдера с
 * `modelPath === undefined` и падало там на `path.split('.')` — то есть внутренней ошибкой MCP
 * (`-32603`) без единого слова о том, какая именно запись не так.
 */
function usableName(entity: { name?: string; modelPath?: string }): string | null {
  const name = typeof entity?.name === 'string' ? entity.name.trim() : '';
  if (name) return name;
  const path = typeof entity?.modelPath === 'string' ? entity.modelPath.trim() : '';
  return path || null;
}

/**
 * Довести частичный intent до полного: расставить умолчания и собрать `warnings`.
 *
 * Ничего не выдумывает сверх умолчаний, которые нельзя не иметь (`selector = name`,
 * `modelPath = name`). Всё остальное недостающее попадает в `warnings` — генератор обязан
 * сказать, чего у формы не хватает, а не молча выдать полуфабрикат как готовый результат.
 *
 * `opts.uiKit` — каталог кита: по нему имя экспорта компонента приводится к registry-имени.
 */
export function normalizeIntent(
  partial: Partial<FormIntent>,
  opts: { uiKit?: UiKitComponents } = {}
): FormIntent {
  const notices: IntentWarning[] = [];
  const intent = normalizeWith(partial, notices, opts.uiKit ?? NO_UI_KIT);
  return {
    ...intent,
    warnings: [...(partial.warnings ?? []), ...notices.map((notice) => notice.message)],
  };
}

/** Нормализация, которая пишет свои предупреждения с кодами в `notices`. */
export function normalizeWith(
  partial: Partial<FormIntent>,
  notices: IntentWarning[],
  uiKit: UiKitComponents
): FormIntent {
  const warnings = {
    add(code: IntentWarningCode, message: string, at?: string): void {
      notices.push({ code, message, ...(at === undefined ? {} : { at }) });
    },
  };
  const formName = partial.formName?.trim() || 'Form';

  // Безымянная запись — единственное, чего нормализация исправить не может: под именем поле
  // объявляется в модели, по имени на него ссылается разметка. Такие записи выбрасываются
  // ЗДЕСЬ и пересчитываются в warning: дальше по конвейеру их некому обнаружить, и билдер
  // ронял на них весь вызов.
  const dropped: string[] = [];
  const named = <T extends { name?: string; modelPath?: string }>(items: T[], what: string) =>
    items.filter((item) => {
      if (item && usableName(item) !== null) return true;
      dropped.push(what);
      return false;
    });

  // Компонент поля — к актуальному registry-имени ui-kit: имя экспорта (по каталогу кита), `Input`
  // для числа (`InputNumber`), `FileUpload` + `variant`. Исправление видно в warnings.
  const withComponent = <T extends FieldIntent>(f: T, label: string, at: string): T => {
    if (typeof f.component !== 'string') return f;
    // Подсказки из справочника (`suggestionsSource`) — тот же признак `InputSuggest`, что и
    // `componentProps.suggestions`: проп появится в схеме, а нормализации его покажет заглушка.
    const stub = f.suggestionsSource !== undefined && f.componentProps?.suggestions === undefined;
    const fixed = normalizeFieldComponent(
      f.component,
      f.type,
      stub ? { ...f.componentProps, suggestions: [] } : f.componentProps,
      uiKit
    );
    if (stub) delete fixed.componentProps.suggestions;
    for (const note of fixed.notes) warnings.add('component-normalized', `${label}: ${note}`, at);
    if (fixed.notes.length === 0 && fixed.component === f.component) return f;
    const { componentProps: _drop, ...rest } = f;
    void _drop;
    return {
      ...rest,
      component: fixed.component,
      ...(Object.keys(fixed.componentProps).length > 0
        ? { componentProps: fixed.componentProps }
        : {}),
    } as T;
  };

  const fields = named(partial.fields ?? [], 'field').map((f) => {
    const name = usableName(f) as string;
    return withComponent(
      { ...f, name, modelPath: f.modelPath ?? name, selector: f.selector ?? name },
      `The field \`${name}\``,
      name
    );
  });

  const arrays = named(partial.arrays ?? [], 'array').map((a) => {
    const name = usableName(a) as string;
    const declared = typeof a.itemInterfaceName === 'string' ? a.itemInterfaceName.trim() : '';
    if (!declared) {
      warnings.add(
        'item-interface-default',
        `The array \`${name}\` has no itemInterfaceName — the row interface got a default name.`,
        name
      );
    }
    return {
      ...a,
      name,
      modelPath: a.modelPath ?? name,
      itemInterfaceName: declared || `${toPascal(name.split('.').pop() ?? name) || 'Array'}Item`,
      itemFields: named(a.itemFields ?? [], `row field of \`${name}\``).map((f) => {
        const fieldName = usableName(f) as string;
        return withComponent(
          {
            ...f,
            name: fieldName,
            modelPath: f.modelPath ?? fieldName,
            selector: f.selector ?? fieldName,
          },
          `The field \`${name}[].${fieldName}\``,
          `${name}[].${fieldName}`
        );
      }),
      // Массив без начального значения падает на первом добавлении строки.
      initialValue: Array.isArray(a.initialValue) ? a.initialValue : [],
    };
  });
  for (const what of new Set(dropped)) {
    const count = dropped.filter((d) => d === what).length;
    warnings.add(
      'unnamed-dropped',
      `Records without a name dropped (${what}): ${count}. A record needs \`name\`.`
    );
  }
  for (const a of arrays) {
    // Сверяем по тому же имени, что дала нормализация: исходная запись могла прийти вообще
    // без `name` (только `modelPath`), и поиск по `x.name` объявлял бы её «без initialValue».
    const source = (partial.arrays ?? []).find((x) => x && usableName(x) === a.name);
    if (!Array.isArray(source?.initialValue)) {
      warnings.add(
        'initial-value-default',
        `The array \`${a.name}\` has no initialValue — an empty list taken.`,
        a.name
      );
    }
  }

  // Дедупликация источников данных: одно имя — одна регистрация в реестре.
  const dataSources = [
    ...new Map(
      (partial.dataSources ?? [])
        .filter((d) => d && typeof d.name === 'string' && d.name.trim())
        .map((d) => [d.name, d])
    ).values(),
  ];

  // Страница без формы — норма: заголовки, текст, карточки. Пусто — только когда нет ни полей,
  // ни текста (ReFormer-11oe.16).
  if (fields.length === 0 && arrays.length === 0 && !hasText(partial.layoutRoot)) {
    warnings.add(
      'no-fields',
      'The intent has no field and no text — the module would be an empty shell.'
    );
  }

  return {
    formName,
    interfaceName: partial.interfaceName?.trim() || deriveInterfaceName(formName),
    target: partial.target ?? 'core',
    ...(partial.framework ? { framework: partial.framework } : {}),
    layout: partial.layout ?? 'minimalist',
    layoutRoot: partial.layoutRoot ?? {
      kind: 'container',
      component: 'Box',
      children: [
        ...fields.map((f) => ({ kind: 'field' as const, ref: f.name })),
        ...arrays.map((a) => ({ kind: 'array' as const, ref: a.name })),
      ],
    },
    // Ключ появляется, только когда части заданы: intent ходит туда-обратно и попадает в снимки
    // потребителей, пустой словарь там — шум.
    ...(partial.parts && Object.keys(partial.parts).length > 0 ? { parts: partial.parts } : {}),
    fields,
    arrays,
    validation: partial.validation ?? [],
    behavior: partial.behavior ?? [],
    // Как и `parts`: ключ — только когда в нём что-то есть.
    ...(partial.nodes && partial.nodes.length > 0 ? { nodes: partial.nodes } : {}),
    visibility: partial.visibility ?? [],
    dataSources,
    ...(partial.operators && Object.keys(partial.operators).length > 0
      ? { operators: partial.operators }
      : {}),
    wizard: partial.wizard,
    warnings: notices.map((notice) => notice.message),
  };
}

/** Все пути модели, которые intent объявляет, — база для кросс-проверок. */
export function modelPaths(intent: FormIntent): Set<string> {
  const paths = new Set<string>();
  for (const f of intent.fields) paths.add(f.modelPath ?? f.name);
  for (const a of intent.arrays) {
    const base = a.modelPath ?? a.name;
    paths.add(base);
    for (const f of a.itemFields) paths.add(`${base}.${f.modelPath ?? f.name}`);
  }
  return paths;
}

/**
 * Стабильный код предупреждения чтения. Текст предупреждения — по-русски и может меняться, а
 * потребитель со своим языком (ассистент билдера отвечает модели по-английски) выбирает и
 * переводит по коду.
 */
export type IntentWarningCode =
  /** Свои предупреждения intent (`warnings` из `plan_form`), прочитанные как есть. */
  | 'consumer'
  | 'intent-string'
  | 'keys-renamed'
  | 'target-unknown'
  | 'type-default'
  | 'type-unknown'
  | 'type-is-component'
  | 'component-default'
  | 'component-normalized'
  | 'array-as-field'
  | 'array-duplicate'
  | 'layout-kind-unknown'
  | 'required-lifted'
  | 'item-interface-default'
  | 'initial-value-default'
  | 'unnamed-dropped'
  | 'no-fields'
  | 'intent-as-node'
  | 'step-as-key'
  | 'steps-as-object'
  | 'layout-as-list'
  | 'rules-in-fields'
  | 'rules-on-fields'
  | 'inline-fields'
  | 'inline-arrays'
  | 'bare-refs'
  | 'reset-as-on-change'
  | 'computed-toggle-replaced'
  /** Свойство компонента записано рядом с полем, массивом или контейнером — перенесено в пропсы. */
  | 'prop-lifted'
  /** Значение приведено к нужному виду: `required: "true"`, число в `params`, справочник картой. */
  | 'value-coerced'
  /** Список записан словарём `{ имя: запись }` — прочитан списком. */
  | 'list-as-map'
  /** Описание поля на месте дописано в его объявление. */
  | 'inline-merged'
  /** Сокращение `steps` рядом с `layoutRoot`: раскладка — из `layoutRoot`, шаги не читаются. */
  | 'steps-ignored'
  /** Правило на путь поля строки (`contacts.phone`) прочитано правилом каждой строки (`each`). */
  | 'each-lifted'
  /** Правило без проверок (`"rules": []`) — «правил нет»: запись отброшена. */
  | 'rule-empty-dropped'
  /** Метаключи корня (`version`, `$schema`, пустой `components`) — отброшены. */
  | 'meta-dropped'
  /** Шаги мастера списком в `wizard` — прочитаны как `steps`. */
  | 'wizard-as-list'
  /** JSON Schema вместо полей — поля и правила прочитаны из её `properties`. */
  | 'json-schema-lifted';

export interface IntentWarning {
  code: IntentWarningCode;
  /** Текст, тот же, что в `FormIntent.warnings`. */
  message: string;
  /** Место в присланном объекте (`fields[2]`) или имя сущности, когда оно есть. */
  at?: string;
}

/** Есть ли в раскладке текст — у страницы без полей. */
function hasText(node: LayoutNode | undefined): boolean {
  if (!node) return false;
  if (node.kind === 'text') return true;
  return (node.kind === 'container' || node.kind === 'step') && node.children.some(hasText);
}
