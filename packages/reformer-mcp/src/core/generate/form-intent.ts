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
 * плюс **дерево layout**, которое ссылается на них по имени. Именно это разделение делает
 * согласованность проверяемой: `cross-check` сверяет, что каждый `$model(path)` из JSON
 * существует в модели, каждый `$component(Name)` — в реестре, каждая цель правила — реальный
 * путь. Если бы layout и поведение описывались одной вложенной структурой, такую проверку
 * пришлось бы заменить надеждой.
 */

import { liftInline } from './intent-lift.js';
import {
  MODEL_BEHAVIOR_KINDS,
  NODE_BEHAVIOR_KINDS,
  type ModelBehaviorKind,
  type NodeBehaviorKind,
} from './operator-catalog.js';
import { normalizeFieldComponent, UI_KIT_FIELD_EXPORTS } from './ui-kit-components.js';

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
  steps: Array<{ title: string; icon?: string; fields: string[] }>;
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
  | { kind: 'step'; title: string; icon?: string; selector?: string; children: LayoutNode[] };

export type ReformerTargetStack = 'core' | 'renderer-react' | 'renderer-json';

export interface FormIntent {
  formName: string;
  /** Имя интерфейса модели, PascalCase. */
  interfaceName: string;
  target: ReformerTargetStack;
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
 */
export function normalizeIntent(partial: Partial<FormIntent>): FormIntent {
  const notices: IntentWarning[] = [];
  const intent = normalizeWith(partial, notices);
  return {
    ...intent,
    warnings: [...(partial.warnings ?? []), ...notices.map((notice) => notice.message)],
  };
}

/** Нормализация, которая пишет свои предупреждения с кодами в `notices`. */
function normalizeWith(partial: Partial<FormIntent>, notices: IntentWarning[]): FormIntent {
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

  // Компонент поля — к актуальному registry-имени ui-kit: удалённые `*Field`, `Input` для
  // числа (`InputNumber`), `FileUpload` + `variant`. Исправление видно в warnings.
  const withComponent = <T extends FieldIntent>(f: T, label: string, at: string): T => {
    if (typeof f.component !== 'string') return f;
    // Подсказки из справочника (`suggestionsSource`) — тот же признак `InputSuggest`, что и
    // `componentProps.suggestions`: проп появится в схеме, а нормализации его покажет заглушка.
    const stub = f.suggestionsSource !== undefined && f.componentProps?.suggestions === undefined;
    const fixed = normalizeFieldComponent(
      f.component,
      f.type,
      stub ? { ...f.componentProps, suggestions: [] } : f.componentProps
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

  const fields = named(partial.fields ?? [], 'поле').map((f) => {
    const name = usableName(f) as string;
    return withComponent(
      { ...f, name, modelPath: f.modelPath ?? name, selector: f.selector ?? name },
      `Поле \`${name}\``,
      name
    );
  });

  const arrays = named(partial.arrays ?? [], 'массив').map((a) => {
    const name = usableName(a) as string;
    const declared = typeof a.itemInterfaceName === 'string' ? a.itemInterfaceName.trim() : '';
    if (!declared) {
      warnings.add(
        'item-interface-default',
        `Массив \`${name}\` без itemInterfaceName — интерфейс элемента назван по умолчанию.`,
        name
      );
    }
    return {
      ...a,
      name,
      modelPath: a.modelPath ?? name,
      itemInterfaceName: declared || `${toPascal(name.split('.').pop() ?? name) || 'Array'}Item`,
      itemFields: named(a.itemFields ?? [], `поле массива \`${name}\``).map((f) => {
        const fieldName = usableName(f) as string;
        return withComponent(
          {
            ...f,
            name: fieldName,
            modelPath: f.modelPath ?? fieldName,
            selector: f.selector ?? fieldName,
          },
          `Поле \`${name}[].${fieldName}\``,
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
      `Без имени, поэтому выброшено (${what}): ${count}. У записи обязателен \`name\`.`
    );
  }
  for (const a of arrays) {
    // Сверяем по тому же имени, что дала нормализация: исходная запись могла прийти вообще
    // без `name` (только `modelPath`), и поиск по `x.name` объявлял бы её «без initialValue».
    const source = (partial.arrays ?? []).find((x) => x && usableName(x) === a.name);
    if (!Array.isArray(source?.initialValue)) {
      warnings.add(
        'initial-value-default',
        `Массив \`${a.name}\` без initialValue — подставлен пустой массив.`,
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

  if (fields.length === 0 && arrays.length === 0) {
    warnings.add('no-fields', 'В intent нет ни одного поля — бандл будет пустым каркасом.');
  }

  return {
    formName,
    interfaceName: partial.interfaceName?.trim() || deriveInterfaceName(formName),
    target: partial.target ?? 'core',
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

// ---------------------------------------------------------------------------
// Чтение «интуитивного» intent
// ---------------------------------------------------------------------------

/**
 * Почему между аргументом инструмента и `normalizeIntent` стоит отдельный слой.
 *
 * `normalizeIntent` принимает `Partial<FormIntent>` — то есть уже ТЕ ЖЕ имена ключей, что в
 * контракте. Модель, зовущая `generate_form` не после `plan_form`, а «по памяти», присылает те
 * же сущности под интуитивными именами: `path` вместо `name`, `reads` вместо `sources`,
 * `behaviors` вместо `behavior`, шаги отдельным списком `steps`. Такой вход не нормализовался
 * и не отвергался — он доезжал до билдера и падал внутренней ошибкой MCP `-32603` («Cannot read
 * properties of undefined (reading 'split')»), не назвав ни поля, ни того, что делать дальше.
 * Описание инструмента при этом обещало «Partial input is normalised with warnings».
 *
 * Слой делает ровно две вещи: приводит синонимы к контракту (и говорит, что переименовал) и
 * ВЫБРАСЫВАЕТ записи, которые прочитать нельзя, называя каждую поимённо и с ожидаемым видом.
 * Догадок о смысле здесь нет: неизвестный вид поведения — это проблема входа, а не повод
 * придумать оператор, которого консумент не просил.
 */

/** Запись входа, которую прочитать не удалось. */
export interface IntentProblem {
  /** Место в присланном объекте: `fields[2].name`. */
  at: string;
  /** Что не так. */
  message: string;
  /** Какой вид ожидается вместо этого. */
  expected: string;
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
  | 'bare-refs';

export interface IntentWarning {
  code: IntentWarningCode;
  /** Текст, тот же, что в `FormIntent.warnings`. */
  message: string;
  /** Место в присланном объекте (`fields[2]`) или имя сущности, когда оно есть. */
  at?: string;
}

/**
 * Предупреждения о печати модуля: интерфейсы модели, начальные значения, тип значения, таргет,
 * а также подстановки, сделанные как надо. Документу формы (ассистент билдера хранит JSON-схему,
 * а не модуль) они не нужны, и модель принимала их за сбой (замер 2026-11-03).
 */
export const MODULE_ONLY_WARNINGS: ReadonlySet<IntentWarningCode> = new Set<IntentWarningCode>([
  'intent-string',
  'keys-renamed',
  'target-unknown',
  'type-default',
  'component-default',
  'required-lifted',
  'item-interface-default',
  'initial-value-default',
  'no-fields',
]);

export interface ReadIntentOptions {
  /**
   * Intent читается для документа формы, а не для модуля: предупреждения
   * {@link MODULE_ONLY_WARNINGS} не попадают ни в `notices`, ни в `intent.warnings`.
   */
  forDocument?: boolean;
}

export interface IntentReading {
  /** Нормализованный intent из того, что прочитать удалось. */
  intent: FormIntent;
  /** Выброшенные записи. Пусто — вход прочитан целиком. */
  problems: IntentProblem[];
  /** Предупреждения с кодами, в порядке `intent.warnings`. */
  notices: IntentWarning[];
}

interface ReadCtx {
  warnings: IntentWarning[];
  problems: IntentProblem[];
  /** `path → name`: печатается одной строкой, а не по разу на каждое поле. */
  renames: Set<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withoutKey(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const { [key]: _drop, ...rest } = record;
  void _drop;
  return rest;
}

function warn(ctx: ReadCtx, code: IntentWarningCode, message: string, at?: string): void {
  ctx.warnings.push({ code, message, ...(at === undefined ? {} : { at }) });
}

/** Значение канонического ключа либо первого из синонимов; переименование запоминается. */
function take(
  src: Record<string, unknown>,
  canonical: string,
  aliases: readonly string[],
  ctx: ReadCtx
): unknown {
  if (src[canonical] !== undefined) return src[canonical];
  for (const alias of aliases) {
    if (src[alias] !== undefined) {
      ctx.renames.add(`${alias} → ${canonical}`);
      return src[alias];
    }
  }
  return undefined;
}

/** Непустая строка либо `null`. */
function asName(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Список из значения. Одиночка заворачивается (`rules: 'required'`), а объект-карта
 * разворачивается в записи (`fields: { lastName: { type } }` → `[{ name: 'lastName', … }]`) —
 * обе записи встречаются у моделей и обе читаются однозначно.
 */
function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  if (isRecord(value)) {
    return Object.entries(value).map(([name, v]) => (isRecord(v) ? { name, ...v } : { name }));
  }
  return [value];
}

/** Имена из списка: строки как есть, объекты — по `name` / `ref` / `path` / `field`. */
function asNames(value: unknown): string[] {
  return asList(value)
    .map((v) => asName(isRecord(v) ? (v.name ?? v.ref ?? v.path ?? v.field) : v))
    .filter((v): v is string => v !== null);
}

/** Как тип поля называют в спеках и в головах — против того, что понимает модель. */
const FIELD_TYPE_ALIASES: Record<string, FieldType> = {
  string: 'string',
  str: 'string',
  text: 'string',
  email: 'string',
  phone: 'string',
  enum: 'string',
  select: 'string',
  number: 'number',
  int: 'number',
  integer: 'number',
  float: 'number',
  decimal: 'number',
  money: 'number',
  boolean: 'boolean',
  bool: 'boolean',
  flag: 'boolean',
  checkbox: 'boolean',
  date: 'date',
  datetime: 'date',
  timestamp: 'date',
  array: 'array',
  list: 'array',
  object: 'object',
  record: 'object',
  group: 'object',
};

/** Компонент по умолчанию — по типу значения; подставляется, только если своего не назвали. */
const DEFAULT_COMPONENT: Record<FieldType, string> = {
  string: 'Input',
  number: 'InputNumber',
  boolean: 'Checkbox',
  date: 'DatePicker',
  array: 'FieldArray',
  object: 'Input',
};

/** Тип значения компонента, когда его имя пришло в `type`; не названный здесь — `string`. */
const COMPONENT_VALUE_TYPE: Readonly<Record<string, FieldType>> = {
  Calendar: 'date',
  Checkbox: 'boolean',
  ComboboxMulti: 'array',
  ComboboxTreeMulti: 'array',
  DatePicker: 'date',
  DatePickerMulti: 'array',
  InputNumber: 'number',
  NativeSelectMulti: 'array',
  SelectMulti: 'array',
  Slider: 'number',
  Switch: 'boolean',
  Toggle: 'boolean',
  ToggleGroupMulti: 'array',
};

const COMPONENT_BY_KEY = new Map(
  Object.keys(UI_KIT_FIELD_EXPORTS).map((name) => [name.toLowerCase(), name])
);

/** Компонент ui-kit, чьё имя пришло в `type`; `null` — это тип значения или неизвестное имя. */
function componentOfType(value: unknown): string | null {
  const raw = asName(value);
  return raw ? (COMPONENT_BY_KEY.get(raw.toLowerCase()) ?? null) : null;
}

const BEHAVIOR_KINDS: ReadonlyArray<BehaviorIntent['kind'] | NodeRuleIntent['kind']> = [
  ...MODEL_BEHAVIOR_KINDS,
  'call',
  ...NODE_BEHAVIOR_KINDS,
];

const BEHAVIOR_BY_KEY = new Map(BEHAVIOR_KINDS.map((kind) => [kind.toLowerCase(), kind]));

const isNodeKind = (kind: string): kind is NodeRuleIntent['kind'] =>
  (NODE_BEHAVIOR_KINDS as readonly string[]).includes(kind);

/**
 * Целевой стек по любому написанию: `react`, `renderer_react`, `@reformer/renderer-react`.
 *
 * `null` вместо тихого `core` — намеренно: «неизвестный таргет молча стал core» означает бандл
 * не того стека, и об этом консументу надо сказать, а не подставить.
 */
export function readTargetStack(value: unknown): ReformerTargetStack | null {
  const key = typeof value === 'string' ? value.toLowerCase().replace(/[^a-z]/g, '') : '';
  if (!key) return null;
  if (key.includes('json')) return 'renderer-json';
  if (key.includes('react')) return 'renderer-react';
  if (key.includes('core')) return 'core';
  return null;
}

function readFieldType(value: unknown, at: string, ctx: ReadCtx): FieldType {
  const raw = asName(value);
  if (!raw) {
    warn(ctx, 'type-default', `${at}: тип не указан — принят \`string\`.`, at);
    return 'string';
  }
  const hit = FIELD_TYPE_ALIASES[raw.toLowerCase()];
  if (hit) return hit;
  warn(
    ctx,
    'type-unknown',
    `${at}: тип \`${raw}\` контракту неизвестен — принят \`string\` ` +
      '(допустимы string | number | boolean | date | array | object).',
    at
  );
  return 'string';
}

function readField(
  raw: unknown,
  at: string,
  ctx: ReadCtx
): { field: FieldIntent; required: boolean } | null {
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'запись поля не объект',
      expected: '{ "name": "lastName", "type": "string", "component": "Input" }',
    });
    return null;
  }

  const modelPath = asName(take(raw, 'modelPath', ['path', 'model', 'binding'], ctx));
  const name = asName(take(raw, 'name', ['field', 'key', 'id'], ctx)) ?? modelPath;
  if (!name) {
    ctx.problems.push({
      at: `${at}.name`,
      message: 'у поля нет имени',
      expected: 'непустая строка `name` (либо `path` — путь в модели, он же станет именем)',
    });
    return null;
  }

  const rawType = take(raw, 'type', ['fieldType', 'valueType', 'dataType'], ctx);
  const named = asName(take(raw, 'component', ['componentName', 'widget', 'control'], ctx));
  // `type: "Select"` — имя компонента, а не тип значения. По типу `select` → `string` поле
  // рисовал `Input`, и выбор из вариантов пропадал с ✓ (ReFormer-j356.5).
  const typeComponent = named ? null : componentOfType(rawType);
  const type = typeComponent
    ? (FIELD_TYPE_ALIASES[typeComponent.toLowerCase()] ??
      COMPONENT_VALUE_TYPE[typeComponent] ??
      'string')
    : readFieldType(rawType, at, ctx);
  const component = named ?? typeComponent;
  if (typeComponent) {
    warn(
      ctx,
      'type-is-component',
      `${at}: \`type: "${String(rawType)}"\` — имя компонента: принят компонент ` +
        `\`${typeComponent}\`, тип значения \`${type}\`. Компонент пиши в \`component\`.`,
      at
    );
  } else if (!component) {
    warn(
      ctx,
      'component-default',
      `${at}: компонент не указан — принят \`${DEFAULT_COMPONENT[type]}\` по типу \`${type}\`.`,
      at
    );
  }

  const props = take(raw, 'componentProps', ['props'], ctx);
  const componentProps: Record<string, unknown> = isRecord(props) ? { ...props } : {};
  // `options` — двусмысленный ключ: строка это ИМЯ справочника (`$dataSource(...)`), массив —
  // готовые значения, и им место в пропсах компонента, а не в реестре источников.
  const options = take(raw, 'optionsSource', ['dataSource', 'optionsRef', 'options'], ctx);
  if (Array.isArray(options)) componentProps.options = options;
  // Та же двусмысленность у подсказок: строка — справочник, массив — готовые подсказки.
  const suggestions = take(raw, 'suggestionsSource', ['suggestionsRef', 'suggestions'], ctx);
  if (Array.isArray(suggestions)) componentProps.suggestions = suggestions;

  const label = asName(take(raw, 'label', ['title', 'caption'], ctx));
  const selector = asName(take(raw, 'selector', ['nodeSelector'], ctx));
  const optionsSource = asName(options);
  const suggestionsSource = asName(suggestions);
  const initialValue = take(raw, 'initialValue', ['defaultValue', 'default'], ctx);

  return {
    field: {
      name,
      modelPath: modelPath ?? name,
      type,
      component: component ?? DEFAULT_COMPONENT[type],
      ...(label ? { label } : {}),
      ...(selector ? { selector } : {}),
      ...(optionsSource ? { optionsSource } : {}),
      ...(suggestionsSource ? { suggestionsSource } : {}),
      ...(Object.keys(componentProps).length > 0 ? { componentProps } : {}),
      ...(initialValue !== undefined ? { initialValue } : {}),
    },
    required: take(raw, 'required', ['isRequired', 'mandatory'], ctx) === true,
  };
}

/** Синонимы `itemFields`: так строки массива называют и в `arrays`, и в записи поля. */
const ITEM_FIELDS_ALIASES = ['fields', 'columns', 'items'] as const;

/**
 * Массив, записанный полем: со строками `itemFields` либо с типом `array` и строками под
 * синонимом. Полем `readField` его читал без строк и без отказа: модуль собирался с пустым
 * массивом и ✓ (ReFormer-gxv6, форма на 82 поля: три массива без строк). Тип `array` без строк —
 * обычное поле: атомарное значение у `FileUpload*`, `*Multi`.
 */
function isArrayAsField(raw: unknown): raw is Record<string, unknown> {
  if (!isRecord(raw)) return false;
  if (raw.itemFields !== undefined) return true;
  const type = asName(raw.type ?? raw.fieldType ?? raw.valueType ?? raw.dataType);
  return (
    type !== null &&
    FIELD_TYPE_ALIASES[type.toLowerCase()] === 'array' &&
    ITEM_FIELDS_ALIASES.some((key) => Array.isArray(raw[key]) || isRecord(raw[key]))
  );
}

/**
 * Ссылки раскладки на поле, которые называют массив, — узлами массива. Строка в `children`
 * читается ссылкой на поле, а массив, записанный полем, раскладка и ставит строкой; без этого
 * сборка отказывала бы «такого поля нет» (C11) за запись, смысл которой однозначен. Обходится
 * только `layoutRoot`: в частях ссылки относительны группы, и имя верхнего уровня там не то.
 */
function refArrays(
  node: LayoutNode,
  arrays: ReadonlySet<string>,
  fields: ReadonlySet<string>
): LayoutNode {
  if (node.kind === 'field') {
    return arrays.has(node.ref) && !fields.has(node.ref) ? { kind: 'array', ref: node.ref } : node;
  }
  if (node.kind === 'container' || node.kind === 'step') {
    return { ...node, children: node.children.map((child) => refArrays(child, arrays, fields)) };
  }
  return node;
}

function readArray(
  raw: unknown,
  at: string,
  ctx: ReadCtx
): { array: ArrayIntent; required: string[] } | null {
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'запись массива не объект',
      expected: '{ "name": "items", "itemInterfaceName": "OrderItem", "itemFields": [ … ] }',
    });
    return null;
  }

  const modelPath = asName(take(raw, 'modelPath', ['path'], ctx));
  const name = asName(take(raw, 'name', ['field', 'key', 'id'], ctx)) ?? modelPath;
  if (!name) {
    ctx.problems.push({
      at: `${at}.name`,
      message: 'у массива нет имени',
      expected: 'непустая строка `name` (либо `path` — путь в модели)',
    });
    return null;
  }

  const itemFields: FieldIntent[] = [];
  const required: string[] = [];
  asList(take(raw, 'itemFields', ITEM_FIELDS_ALIASES, ctx)).forEach((item, i) => {
    const read = readField(item, `${at}.itemFields[${i}]`, ctx);
    if (!read) return;
    itemFields.push(read.field);
    if (read.required) required.push(read.field.modelPath ?? read.field.name);
  });

  const itemInterfaceName = asName(
    take(raw, 'itemInterfaceName', ['itemType', 'itemInterface', 'itemName'], ctx)
  );
  const initialValue = take(raw, 'initialValue', ['initialRows', 'rows', 'defaultValue'], ctx);
  const component = asName(take(raw, 'component', ['componentName'], ctx));
  const props = take(raw, 'componentProps', ['props'], ctx);
  const componentProps: Record<string, unknown> = isRecord(props) ? { ...props } : {};
  // Подпись массива, записанного как поле, — заголовок `FieldArray`; у своего компонента её
  // некуда положить, не угадывая его пропсы.
  const label = asName(take(raw, 'label', ['title', 'caption'], ctx));
  if (label && (component ?? 'FieldArray') === 'FieldArray' && componentProps.title === undefined) {
    componentProps.title = label;
  }

  // `itemInterfaceName` и `initialValue` доводит до контракта `normalizeIntent` — она же и
  // предупреждает о подстановке, поэтому здесь они передаются как пришли.
  return {
    array: {
      name,
      modelPath: modelPath ?? name,
      itemInterfaceName: itemInterfaceName as string,
      itemFields,
      initialValue: initialValue as unknown[],
      ...(component ? { component } : {}),
      ...(isRecord(props) || label ? { componentProps } : {}),
    },
    required,
  };
}

function readValidationRule(raw: unknown, at: string, ctx: ReadCtx): ValidationRuleIntent | null {
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'правило валидации не объект',
      expected: '{ "target": "price", "rules": ["required()", "min(1)"] }',
    });
    return null;
  }

  const target = asName(take(raw, 'target', ['field', 'path', 'name', 'for'], ctx));
  if (!target) {
    ctx.problems.push({
      at: `${at}.target`,
      message: 'правило не говорит, к какому полю относится',
      expected: '`target` — путь в модели, например `personal.lastName`',
    });
    return null;
  }

  const rules = asNames(take(raw, 'rules', ['rule', 'validators', 'checks'], ctx));
  const async = asName(take(raw, 'async', ['asyncValidator', 'asyncRule'], ctx));
  const cross = asName(take(raw, 'cross', ['crossCheck', 'check'], ctx));
  const call = asName(take(raw, 'call', ['operator', 'invoke'], ctx));
  if (rules.length === 0 && !async && !cross && !call) {
    ctx.problems.push({
      at: `${at}.rules`,
      message: `у правила на \`${target}\` нет ни одного валидатора`,
      expected:
        '`rules`: ["required()", "minLength(2)"] — фабрики из `@reformer/core/validators` ' +
        'или свои из `operators`',
    });
    return null;
  }

  const when = asName(take(raw, 'when', ['condition'], ctx));
  const each = asName(take(raw, 'each', ['array', 'arrayPath'], ctx));
  const code = asName(take(raw, 'code', ['issue', 'errorCode'], ctx));
  const message = asName(take(raw, 'message', ['text', 'errorMessage'], ctx));
  const level = asName(take(raw, 'severity', ['level'], ctx))?.toLowerCase();
  const severity = level === 'warning' || level === 'warn' ? 'warning' : undefined;
  const paramsRaw = take(raw, 'params', ['messageParams', 'issueParams'], ctx);
  const params = isRecord(paramsRaw)
    ? Object.fromEntries(
        Object.entries(paramsRaw).filter((entry): entry is [string, string] => {
          return typeof entry[1] === 'string' && entry[1].trim() !== '';
        })
      )
    : undefined;
  return {
    target,
    rules,
    ...(async ? { async } : {}),
    ...(cross ? { cross } : {}),
    ...(call ? { call } : {}),
    ...(code ? { code } : {}),
    ...(message ? { message } : {}),
    ...(severity ? { severity } : {}),
    ...(params && Object.keys(params).length > 0 ? { params } : {}),
    ...(when ? { when } : {}),
    ...(each ? { each } : {}),
  };
}

/**
 * Правило узла схемы из записи `behavior`. Узел — `selector` из `layoutRoot` (его пишут и в
 * `target`, как у связей над моделью); у `renderEffect` узла нет.
 */
function readNodeRule(
  raw: Record<string, unknown>,
  kind: NodeRuleIntent['kind'],
  at: string,
  ctx: ReadCtx
): NodeRuleIntent | null {
  const selector = asName(take(raw, 'selector', ['node', 'target'], ctx));
  if (kind !== 'renderEffect' && !selector) {
    ctx.problems.push({
      at: `${at}.selector`,
      message: `\`${kind}\` не говорит, к какому узлу схемы относится`,
      expected:
        '`selector` узла из layoutRoot: { "kind": "onMount", "selector": "wizard", "expr": "…" }',
    });
    return null;
  }
  const event = asName(take(raw, 'event', ['prop', 'eventName'], ctx));
  if (kind === 'onComponentEvent' && !event) {
    ctx.problems.push({
      at: `${at}.event`,
      message: '`onComponentEvent` не называет событие компонента',
      expected: '`event` — проп-событие компонента узла: "onSubmit"',
    });
    return null;
  }
  const expr = asName(take(raw, 'expr', ['expression', 'code', 'handler', 'body'], ctx));
  if (!expr) {
    ctx.problems.push({
      at: `${at}.expr`,
      message: `у \`${kind}\` нет тела обработчика`,
      expected: '`expr` — тело на TS, вставляется как есть',
    });
    return null;
  }
  return {
    kind,
    ...(selector && kind !== 'renderEffect' ? { selector } : {}),
    ...(event && kind === 'onComponentEvent' ? { event } : {}),
    expr,
  };
}

function readBehavior(
  raw: unknown,
  at: string,
  ctx: ReadCtx
): BehaviorIntent | NodeRuleIntent | null {
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'запись поведения не объект',
      expected: '{ "kind": "computeFrom", "target": "total", "sources": ["price"], "expr": "…" }',
    });
    return null;
  }

  const declared = asName(take(raw, 'kind', ['type', 'op', 'operator'], ctx));
  const kind = declared
    ? BEHAVIOR_BY_KEY.get(declared.toLowerCase().replace(/[^a-z]/g, ''))
    : undefined;
  if (!kind) {
    ctx.problems.push({
      at: `${at}.kind`,
      message: declared
        ? `вид поведения \`${declared}\` контракту неизвестен`
        : 'у поведения не указан вид',
      expected: `${BEHAVIOR_KINDS.join(' | ')} — подобрать под требование помогает \`choose_api\``,
    });
    return null;
  }
  if (isNodeKind(kind)) return readNodeRule(raw, kind, at, ctx);

  const target = asName(take(raw, 'target', ['field', 'path', 'to', 'writes'], ctx));
  if (!target) {
    ctx.problems.push({
      at: `${at}.target`,
      message: `поведение \`${kind}\` не говорит, какое поле оно пишет`,
      expected: '`target` — путь в модели',
    });
    return null;
  }

  // У вычисления `when` — своё условие рядом с формулой (A8 калибровки), а не формула: читать его
  // синонимом `expr` значило бы посчитать поле условием.
  const computed = kind === 'compute' || kind === 'computeFrom';
  const expr = asName(
    take(
      raw,
      'expr',
      computed
        ? ['expression', 'formula', 'code']
        : ['expression', 'formula', 'code', 'when', 'condition'],
      ctx
    )
  );
  if (kind === 'call' && !expr) {
    ctx.problems.push({
      at: `${at}.expr`,
      message: '`call` не называет вызов своего оператора',
      expected: '`expr` — вызов оператора из `operators`: "roundTo(model.$.price, 100)"',
    });
    return null;
  }
  const options = take(raw, 'options', ['opts'], ctx);
  // Условие вычисления — ключом `when` или внутри `options` (так оно выглядит в коде ядра).
  const optionWhen = isRecord(options) ? asName(options.when) : null;
  const when = computed ? (asName(take(raw, 'when', ['condition'], ctx)) ?? optionWhen) : null;
  const rest = isRecord(options) && optionWhen && computed ? withoutKey(options, 'when') : options;
  const each = asName(take(raw, 'each', ['array', 'arrayPath', 'row'], ctx));
  return {
    kind,
    target,
    ...(each ? { each } : {}),
    sources: asNames(take(raw, 'sources', ['reads', 'deps', 'dependsOn', 'from', 'source'], ctx)),
    ...(expr ? { expr } : {}),
    ...(when ? { when } : {}),
    // Пустые `options` после снятия `when` не печатаются; присланные пустыми — как были.
    ...(isRecord(rest) && (rest === options || Object.keys(rest).length > 0)
      ? { options: rest }
      : {}),
  };
}

/** Модуль своих операторов по умолчанию — файл `operators.ts` каталога формы. */
export const DEFAULT_OPERATORS_MODULE = './operators';

/**
 * Свои операторы: словарь `{ "имя": "модуль" }`; список имён — все из
 * {@link DEFAULT_OPERATORS_MODULE}, запись списка — `{ "name": "…", "from": "…" }`.
 */
function readOperators(raw: unknown, ctx: ReadCtx): Record<string, string> {
  const operators: Record<string, string> = {};
  if (raw === undefined || raw === null) return operators;
  const moduleOf = (value: unknown): unknown =>
    isRecord(value) ? (value.from ?? value.module) : value;
  const entries: Array<[string, unknown, unknown]> = isRecord(raw)
    ? Object.entries(raw).map(([name, value]) => [`operators.${name}`, name, moduleOf(value)])
    : asList(raw).map((item, i) => [
        `operators[${i}]`,
        isRecord(item) ? item.name : item,
        isRecord(item) ? moduleOf(item) : undefined,
      ]);
  for (const [at, name, module] of entries) {
    if (typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name.trim())) {
      ctx.problems.push({
        at,
        message: `имя оператора \`${String(name)}\` не идентификатор TS`,
        expected: '{ "operators": { "innChecksum": "./operators" } }',
      });
      continue;
    }
    if (module !== undefined && module !== null && typeof module !== 'string') {
      ctx.problems.push({
        at,
        message: `модуль оператора \`${name}\` не строка`,
        expected: 'путь модуля, как в import: "./operators", "@/shared/validators"',
      });
      continue;
    }
    operators[name.trim()] = asName(module) ?? DEFAULT_OPERATORS_MODULE;
  }
  return operators;
}

function readVisibility(raw: unknown, at: string, ctx: ReadCtx): VisibilityIntent | null {
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'правило видимости не объект',
      expected: '{ "selector": "spouseIncome", "condition": "model.married === false" }',
    });
    return null;
  }
  const selector = asName(take(raw, 'selector', ['node', 'target', 'field', 'ref'], ctx));
  const condition = asName(take(raw, 'condition', ['when', 'expr', 'hideWhen'], ctx));
  if (!selector || !condition) {
    ctx.problems.push({
      at,
      message: selector ? `у правила видимости \`${selector}\` нет условия` : 'нет selector узла',
      expected:
        '`selector` — selector узла из разметки, `condition` — выражение, при котором узел СКРЫТ',
    });
    return null;
  }
  return { selector, condition };
}

function readDataSource(raw: unknown, at: string, ctx: ReadCtx): DataSourceIntent | null {
  const plain = asName(raw);
  if (plain) return { name: plain };
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'источник данных не объект и не имя',
      expected: '"CURRENCIES" либо { "name": "CURRENCIES", "note": "откуда значения" }',
    });
    return null;
  }
  const name = asName(take(raw, 'name', ['id', 'key', 'source'], ctx));
  if (!name) {
    ctx.problems.push({
      at: `${at}.name`,
      message: 'у источника данных нет имени',
      expected: '`name` — то же имя, что в `$dataSource(...)` разметки',
    });
    return null;
  }
  const note = asName(take(raw, 'note', ['description', 'comment'], ctx));
  const values = take(raw, 'values', ['options', 'items', 'data'], ctx);
  return { name, ...(note ? { note } : {}), ...(Array.isArray(values) ? { values } : {}) };
}

function readStep(
  raw: unknown,
  at: string,
  ctx: ReadCtx
): { title: string; icon?: string; fields: string[] } | null {
  const plain = asName(raw);
  if (plain) return { title: plain, fields: [] };
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'шаг не объект и не заголовок',
      expected: '{ "title": "Личные данные", "fields": ["lastName", "firstName"] }',
    });
    return null;
  }
  const icon = asName(take(raw, 'icon', ['emoji'], ctx));
  return {
    title: asName(take(raw, 'title', ['label', 'name', 'caption'], ctx)) ?? at,
    ...(icon ? { icon } : {}),
    fields: asNames(take(raw, 'fields', ['fieldNames', 'items', 'refs'], ctx)),
  };
}

/**
 * Корень мастера из сокращённой записи шагов: контейнер `wizard` (его рисует `FormWizard`) с узлом
 * шага на каждый шаг и ссылками на его поля. Поле, не названное ни в одном шаге, остаётся вне
 * раскладки — это видит проверка размещения, а не догадка, в какой шаг его поставить.
 */
function stepsLayout(
  steps: ReadonlyArray<{ title: string; icon?: string; fields: string[] }>,
  arrays: ReadonlySet<string>
): LayoutNode {
  return {
    kind: 'container',
    component: 'Box',
    selector: 'wizard',
    children: steps.map((step) => ({
      kind: 'step' as const,
      title: step.title,
      ...(step.icon ? { icon: step.icon } : {}),
      children: step.fields.map(
        (ref): LayoutNode => (arrays.has(ref) ? { kind: 'array', ref } : { kind: 'field', ref })
      ),
    })),
  };
}

function readLayoutNode(raw: unknown, at: string, ctx: ReadCtx): LayoutNode | null {
  if (raw === undefined || raw === null) return null;
  // Строка среди детей — ссылка на поле по имени: самая частая сокращённая запись.
  const plain = asName(raw);
  if (plain) return { kind: 'field', ref: plain };
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'узел разметки не объект',
      expected: '{ "kind": "container", "component": "Box", "children": [ … ] }',
    });
    return null;
  }

  const kind = (asName(take(raw, 'kind', ['type'], ctx)) ?? '').toLowerCase();
  const selector = asName(take(raw, 'selector', [], ctx));

  if (kind === 'field' || kind === 'array') {
    const ref = asName(take(raw, 'ref', ['name', 'field', 'path'], ctx));
    if (!ref) {
      ctx.problems.push({
        at: `${at}.ref`,
        message: `узел \`${kind}\` не ссылается ни на что`,
        expected: '`ref` — имя поля или массива, объявленного в intent',
      });
      return null;
    }
    // selector осмыслен только у массива: у поля точка адресации — путь модели.
    return kind === 'array' && selector ? { kind, ref, selector } : { kind, ref };
  }

  if (kind === 'part' || kind === 'subform') {
    const ref = asName(take(raw, 'ref', ['group', 'model', 'path'], ctx));
    const part = asName(take(raw, 'part', ['name', 'partName'], ctx));
    if (!ref || !part) {
      ctx.problems.push({
        at: `${at}.${ref ? 'part' : 'ref'}`,
        message: 'узел подформы без группы или без имени части',
        expected: '{ "kind": "part", "ref": "registrationAddress", "part": "address" }',
      });
      return null;
    }
    return { kind: 'part', ref, part, ...(selector ? { selector } : {}) };
  }

  const children = asList(take(raw, 'children', ['items', 'nodes', 'fields'], ctx))
    .map((child, i) => readLayoutNode(child, `${at}.children[${i}]`, ctx))
    .filter((child): child is LayoutNode => child !== null);

  if (kind === 'step') {
    const icon = asName(take(raw, 'icon', ['emoji'], ctx));
    return {
      kind: 'step',
      title: asName(take(raw, 'title', ['label'], ctx)) ?? 'Шаг',
      ...(icon ? { icon } : {}),
      ...(selector ? { selector } : {}),
      children,
    };
  }

  if (kind && kind !== 'container' && kind !== 'group') {
    warn(
      ctx,
      'layout-kind-unknown',
      `${at}: вид узла \`${kind}\` контракту неизвестен — прочитан как контейнер ` +
        '(допустимы field | array | part | container | step).',
      at
    );
  }
  const htmlTag = asName(take(raw, 'htmlTag', ['tag', 'html'], ctx));
  const component = asName(take(raw, 'component', ['componentName'], ctx));
  const props = take(raw, 'componentProps', ['props'], ctx);
  return {
    kind: 'container',
    component: component ?? (htmlTag ? 'div' : 'Box'),
    ...(htmlTag ? { htmlTag } : {}),
    ...(isRecord(props) ? { componentProps: props } : {}),
    ...(selector ? { selector } : {}),
    children,
  };
}

/**
 * Прочитать произвольный вход как `FormIntent`.
 *
 * Возвращает ВСЕГДА рабочий intent — из того, что удалось разобрать, — и отдельным списком то,
 * что пришлось выбросить. Бросать исключение здесь нельзя: у MCP оно превращается в `-32603`,
 * который консументу не сообщает ничего.
 */
export function readIntent(raw: unknown, options: ReadIntentOptions = {}): IntentReading {
  const ctx: ReadCtx = { warnings: [], problems: [], renames: new Set() };

  let source: unknown = raw;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
      warn(ctx, 'intent-string', '`intent` пришёл строкой — разобран как JSON.');
    } catch (e) {
      ctx.problems.push({
        at: 'intent',
        message: `строка не разбирается как JSON: ${(e as Error).message}`,
        expected: 'объект FormIntent — целиком его отдаёт `plan_form`',
      });
      source = {};
    }
  }
  if (!isRecord(source)) {
    ctx.problems.push({
      at: 'intent',
      message: `получен ${Array.isArray(source) ? 'массив' : typeof source}`,
      expected: 'объект FormIntent — целиком его отдаёт `plan_form`',
    });
    source = {};
  }
  const canonical = liftInline(source as Record<string, unknown>);
  const src = canonical.source;
  ctx.warnings.push(...canonical.notes);
  ctx.problems.push(...canonical.problems);

  const declaredTarget = take(src, 'target', ['stack', 'renderer'], ctx);
  const target = readTargetStack(declaredTarget);
  if (declaredTarget !== undefined && !target) {
    warn(
      ctx,
      'target-unknown',
      `Таргет \`${String(declaredTarget)}\` не распознан — принят \`core\` ` +
        '(допустимы core | renderer-react | renderer-json).'
    );
  }

  const fields: FieldIntent[] = [];
  const requiredTargets: Array<{ target: string; each?: string }> = [];
  const arraysAsFields: Array<{ raw: Record<string, unknown>; at: string }> = [];
  const declaredAt = new Map<string, number>();
  asList(take(src, 'fields', ['formFields', 'inputs'], ctx)).forEach((item, i) => {
    if (isArrayAsField(item)) {
      arraysAsFields.push({ raw: item, at: `fields[${i}]` });
      return;
    }
    const read = readField(item, `fields[${i}]`, ctx);
    if (!read) return;
    // Второе объявление того же пути — не поле: сборка отказывала про дубль testId (C10), и
    // причина терялась (так читалось правило валидации, записанное в `fields`).
    const path = read.field.modelPath ?? read.field.name;
    const first = declaredAt.get(path);
    if (first !== undefined) {
      ctx.problems.push({
        at: `fields[${i}]`,
        message: `поле \`${path}\` объявлено второй раз (первое — fields[${first}])`,
        expected: 'одно объявление на путь модели; проверки — записями `validation`',
      });
      return;
    }
    declaredAt.set(path, i);
    fields.push(read.field);
    if (read.required) requiredTargets.push({ target: read.field.modelPath ?? read.field.name });
  });

  const arrays: ArrayIntent[] = [];
  const addArray = (read: { array: ArrayIntent; required: string[] }): void => {
    arrays.push(read.array);
    for (const path of read.required) {
      requiredTargets.push({ target: path, each: read.array.name });
    }
  };
  asList(take(src, 'arrays', ['formArrays', 'collections', 'repeatables'], ctx)).forEach(
    (item, i) => {
      const read = readArray(item, `arrays[${i}]`, ctx);
      if (read) addArray(read);
    }
  );
  // Массив из `fields` — после объявленных в `arrays`: одноимённая запись там побеждает.
  for (const { raw, at } of arraysAsFields) {
    const read = readArray(raw, at, ctx);
    if (!read) continue;
    if (arrays.some((a) => a.name === read.array.name)) {
      warn(
        ctx,
        'array-duplicate',
        `${at}: массив \`${read.array.name}\` записан и в fields, и в arrays — взята запись из arrays.`,
        at
      );
      continue;
    }
    warn(
      ctx,
      'array-as-field',
      `${at}: у поля \`${read.array.name}\` есть строки — прочитано как массив. ` +
        'Массив пиши в `arrays`, в раскладке — `{"kind":"array","ref":"…"}`.',
      at
    );
    addArray(read);
  }

  const validation: ValidationRuleIntent[] = [];
  asList(take(src, 'validation', ['validations', 'validationRules', 'rules'], ctx)).forEach(
    (item, i) => {
      const rule = readValidationRule(item, `validation[${i}]`, ctx);
      if (rule) validation.push(rule);
    }
  );

  // `required: true` у поля — самая интуитивная запись обязательности, и до сих пор она молча
  // терялась: контракт держит валидацию отдельным списком. Поднимаем её в правило, но не
  // дублируем то, что консумент уже написал руками.
  const lifted = requiredTargets.filter(
    (r) =>
      !validation.some(
        (v) =>
          v.target === r.target && v.each === r.each && v.rules.some((x) => /^required\b/.test(x))
      )
  );
  for (const r of lifted) {
    validation.push({
      target: r.target,
      ...(r.each ? { each: r.each } : {}),
      rules: ['required()'],
    });
  }
  if (lifted.length > 0) {
    warn(
      ctx,
      'required-lifted',
      `Полей с \`required: true\`: ${lifted.length} — им добавлено правило \`required()\` ` +
        'в validation. Обязательность живёт там: в описании поля её держать негде.'
    );
  }

  const behavior: BehaviorIntent[] = [];
  const nodes: NodeRuleIntent[] = [];
  asList(take(src, 'behavior', ['behaviors', 'behaviours', 'behaviour', 'reactions'], ctx)).forEach(
    (item, i) => {
      const read = readBehavior(item, `behavior[${i}]`, ctx);
      if (!read) return;
      if (isNodeKind(read.kind)) nodes.push(read as NodeRuleIntent);
      else behavior.push(read as BehaviorIntent);
    }
  );

  const operators = readOperators(take(src, 'operators', ['customOperators'], ctx), ctx);

  const visibility: VisibilityIntent[] = [];
  asList(take(src, 'visibility', ['visibilityRules', 'hidden', 'hideWhen'], ctx)).forEach(
    (item, i) => {
      const read = readVisibility(item, `visibility[${i}]`, ctx);
      if (read) visibility.push(read);
    }
  );

  const dataSources: DataSourceIntent[] = [];
  asList(take(src, 'dataSources', ['datasources', 'data_sources', 'dictionaries'], ctx)).forEach(
    (item, i) => {
      const read = readDataSource(item, `dataSources[${i}]`, ctx);
      if (read) dataSources.push(read);
    }
  );

  const wizardRaw = src.wizard;
  const stepsRaw =
    (isRecord(wizardRaw) ? take(wizardRaw, 'steps', ['pages'], ctx) : undefined) ??
    take(src, 'steps', ['pages', 'wizardSteps'], ctx);
  const steps = asList(stepsRaw)
    .map((item, i) => readStep(item, `steps[${i}]`, ctx))
    .filter((step): step is { title: string; icon?: string; fields: string[] } => step !== null);

  // `layout` в контракте — режим раскладки ФАЙЛОВ (строка), но модели кладут туда и дерево.
  const declaredLayout = src.layout;
  const readRoot = readLayoutNode(
    take(src, 'layoutRoot', ['root', 'tree'], ctx) ??
      (isRecord(declaredLayout) ? declaredLayout : undefined),
    'layoutRoot',
    ctx
  );
  const namesOf = (entities: ReadonlyArray<{ name: string; modelPath?: string }>) =>
    new Set(entities.flatMap((entity) => [entity.name, entity.modelPath ?? entity.name]));
  // Сокращение `steps: [{ title, fields }]` без своей раскладки — корень мастера из узлов шагов.
  // Раньше шаги оставались в `wizard`, а форма собиралась плоской с ✓ (ReFormer-j356.5).
  const layoutRoot =
    (readRoot && refArrays(readRoot, namesOf(arrays), namesOf(fields))) ??
    (steps.length > 0 ? stepsLayout(steps, namesOf(arrays)) : null);

  // Именованные части разметки (подформы): словарь «имя → узел».
  const parts: Record<string, LayoutNode> = {};
  const partsRaw = take(src, 'parts', ['subforms', 'fragments'], ctx);
  if (isRecord(partsRaw)) {
    for (const [name, raw] of Object.entries(partsRaw)) {
      const node = readLayoutNode(raw, `parts.${name}`, ctx);
      if (node) parts[name] = node;
    }
  } else if (partsRaw !== undefined) {
    ctx.problems.push({
      at: 'parts',
      message: 'части разметки заданы не словарём',
      expected: '{ "address": { "kind": "container", "component": "Box", "children": ["city"] } }',
    });
  }

  // Свои предупреждения консумента (например, из `plan_form`) сохраняем: intent ходит
  // туда-обратно, и терять их на каждом круге — значит терять разбор спеки.
  const notes: IntentWarning[] = asNames(src.warnings).map((message) => ({
    code: 'consumer' as const,
    message,
  }));
  if (ctx.renames.size > 0) {
    notes.push({
      code: 'keys-renamed',
      message:
        `Ключи приведены к контракту FormIntent: ${[...ctx.renames].sort().join(', ')}. ` +
        'Intent без переименований отдаёт `plan_form`.',
    });
  }
  notes.push(...ctx.warnings);

  const formName = asName(take(src, 'formName', ['name', 'title', 'form', 'formTitle'], ctx));
  const interfaceName = asName(
    take(src, 'interfaceName', ['modelName', 'modelInterface', 'interface'], ctx)
  );

  const normalized: IntentWarning[] = [];
  const intent = normalizeWith(
    {
      ...(formName ? { formName } : {}),
      ...(interfaceName ? { interfaceName } : {}),
      target: target ?? 'core',
      layout: asName(declaredLayout) === 'folders' ? 'folders' : 'minimalist',
      ...(layoutRoot ? { layoutRoot } : {}),
      ...(Object.keys(parts).length > 0 ? { parts } : {}),
      fields,
      arrays,
      validation,
      behavior,
      nodes,
      visibility,
      dataSources,
      operators,
      ...(steps.length > 0 ? { wizard: { steps } } : {}),
    },
    normalized
  );

  const notices = [...notes, ...normalized].filter(
    (notice) => !options.forDocument || !MODULE_ONLY_WARNINGS.has(notice.code)
  );
  return {
    intent: { ...intent, warnings: notices.map((notice) => notice.message) },
    problems: ctx.problems,
    notices,
  };
}
