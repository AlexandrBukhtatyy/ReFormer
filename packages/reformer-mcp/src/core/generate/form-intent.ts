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

import { repairBehavior } from './behavior-repair.js';
import { nameIgnoringCase } from './component-names.js';
import { liftInline, rulesFromMap } from './intent-lift.js';
import {
  INTENT_RECORDS,
  nearestKey,
  recordKeys,
  type IntentRecordKind,
} from './intent-messages.js';
import {
  BEHAVIOR_KINDS_WITH_OPTIONS,
  MODEL_BEHAVIOR_KINDS,
  NODE_BEHAVIOR_KINDS,
  type ModelBehaviorKind,
  type NodeBehaviorKind,
} from './operator-catalog.js';
import { normalizeFieldComponent, NO_UI_KIT, type UiKitComponents } from './ui-kit-components.js';
import type { UiKitPropSchemas } from './ui-kit-props.js';

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
function normalizeWith(
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
 * контракте. Модель, пишущая intent «по памяти», а не по грамматике, присылает те
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

/**
 * Стабильный код проблемы чтения: по нему выбирает потребитель со своим языком и ищут тесты, а текст
 * может меняться.
 */
export type IntentProblemCode =
  /** Вход — не объект intent: строка не JSON, массив, число. */
  | 'intent-unreadable'
  /** Запись списка — не объект: поле, массив, правило, поведение, видимость, шаг, узел. */
  | 'not-an-object'
  /** Нет обязательного: имени поля, цели правила, вида поведения, ссылки узла, тела обработчика. */
  | 'missing-key'
  /** Ключ, которого у записи нет; подсказка называет ближайший допустимый. */
  | 'unknown-key'
  /** Два синонима одного ключа с разными значениями либо описание на месте против объявления. */
  | 'key-conflict'
  /** Свойство, которого у компонента нет. */
  | 'prop-unsupported'
  /** Значение не того вида: `required` не логическое, параметр замечания — объект. */
  | 'invalid-value'
  /** Вид поведения, которого контракт не знает. */
  | 'unknown-kind'
  /** Второе объявление того же пути. */
  | 'duplicate'
  /** Связь, которая собралась бы и не сработала ни разу. */
  | 'inert-behavior';

/** Запись входа, которую прочитать не удалось. */
export interface IntentProblem {
  code: IntentProblemCode;
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
  | 'rule-empty-dropped';

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
  /**
   * Каталог кита: по нему имя экспорта приводится к registry-имени, а имя компонента в `type`
   * узнаётся как компонент. Без него имена компонентов не сверяются.
   */
  uiKit?: UiKitComponents;
  /**
   * Props-схемы кита: по ним свойство компонента, записанное рядом с полем (`placeholder`, `min`,
   * `mask`), переносится в `componentProps`, а чужое называется проблемой. Без схем переносятся
   * только общеизвестные свойства.
   */
  uiKitProps?: UiKitPropSchemas;
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
  /** Каталог кита — см. {@link ReadIntentOptions.uiKit}. */
  uiKit: UiKitComponents;
  /** Props-схемы кита — см. {@link ReadIntentOptions.uiKitProps}. */
  uiKitProps: UiKitPropSchemas | undefined;
  /**
   * Ключи, которые чтение взяло, — по записи. Остаток записи либо известное не на своём месте (его
   * поднимает чтение), либо проблема `unknown-key`: молча ключ не пропадает (аудит 2026-11, B1).
   */
  used: WeakMap<object, Set<string>>;
  /** Ключи, о которых чтение спрашивало, → их канон: словарь подсказки ближайшего ключа. */
  asked: WeakMap<object, Map<string, string>>;
  /** Синонимы, чьё значение расходится со взятым ключом: `[синоним, взятый]`. */
  conflicts: WeakMap<object, Array<[string, string]>>;
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

function problem(
  ctx: ReadCtx,
  code: IntentProblemCode,
  at: string,
  message: string,
  expected: string
): void {
  ctx.problems.push({ code, at, message, expected });
}

/** Значения JSON равны: синоним, повторивший взятый ключ, конфликтом не считается. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return (
    ka.length === kb.length &&
    ka.every((key) =>
      sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    )
  );
}

function setOf<V>(map: WeakMap<object, Set<V>>, src: object): Set<V> {
  let set = map.get(src);
  if (!set) map.set(src, (set = new Set()));
  return set;
}

/** Отметить ключи, прочитанные не через {@link take}: `wizard`, `layout`, `warnings`. */
function use(ctx: ReadCtx, src: Record<string, unknown>, ...keys: string[]): void {
  const used = setOf(ctx.used, src);
  for (const key of keys) used.add(key);
}

/**
 * Значение канонического ключа либо первого из синонимов; переименование запоминается.
 *
 * Ключ берётся и в другом регистре (`Label`, `InitialValue`) — это тот же ключ. Синоним рядом со
 * взятым ключом отмечается взятым, а расхождение их значений — конфликтом: какое из двух имела в
 * виду модель, чтение не угадывает.
 */
function take(
  src: Record<string, unknown>,
  canonical: string,
  aliases: readonly string[],
  ctx: ReadCtx
): unknown {
  const group = [canonical, ...aliases];
  let asked = ctx.asked.get(src);
  if (!asked) ctx.asked.set(src, (asked = new Map()));
  for (const key of group) if (!asked.has(key)) asked.set(key, canonical);
  const used = setOf(ctx.used, src);

  const present = group.filter((key) => src[key] !== undefined);
  if (present.length === 0) {
    const lower = new Set(group.map((key) => key.toLowerCase()));
    const loose = Object.keys(src).find(
      (key) =>
        src[key] !== undefined && !used.has(key) && !asked.has(key) && lower.has(key.toLowerCase())
    );
    if (loose === undefined) return undefined;
    used.add(loose);
    ctx.renames.add(`${loose} → ${canonical}`);
    return src[loose];
  }
  const [first, ...others] = present;
  used.add(first);
  if (first !== canonical) ctx.renames.add(`${first} → ${canonical}`);
  for (const other of others) {
    used.add(other);
    if (!sameValue(src[other], src[first])) {
      let list = ctx.conflicts.get(src);
      if (!list) ctx.conflicts.set(src, (list = []));
      list.push([other, first]);
    }
  }
  return src[first];
}

/**
 * Строка ключа: непустая строка как есть, отсутствие, `null` и пустая строка — `null`. Значение
 * другого вида — проблема: раньше `label: { ru: … }` и `selector: 7` пропадали молча.
 */
function takeName(
  src: Record<string, unknown>,
  canonical: string,
  aliases: readonly string[],
  ctx: ReadCtx,
  at: string
): string | null {
  const value = take(src, canonical, aliases, ctx);
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value.trim() || null;
  problem(
    ctx,
    'invalid-value',
    `${at}.${canonical}`,
    `\`${canonical}\` is ${Array.isArray(value) ? 'an array' : typeof value}`,
    `a string`
  );
  return null;
}

/** Словарь ключа (`componentProps`, `options`): не словарь — проблема, а не тихая потеря. */
function takeRecord(
  src: Record<string, unknown>,
  canonical: string,
  aliases: readonly string[],
  ctx: ReadCtx,
  at: string
): Record<string, unknown> | undefined {
  const value = take(src, canonical, aliases, ctx);
  if (value === undefined || value === null) return undefined;
  if (isRecord(value)) return value;
  problem(
    ctx,
    'invalid-value',
    `${at}.${canonical}`,
    `\`${canonical}\` is ${Array.isArray(value) ? 'an array' : typeof value}`,
    `an object: { "${canonical}": { … } }`
  );
  return undefined;
}

/**
 * Остаток записи после чтения: конфликты синонимов и ключи, которых чтение не взяло.
 *
 * `lift` получает ключ остатка и решает, известное ли это не на своём месте (свойство компонента
 * рядом с полем — его переносит в пропсы); не поднятое — проблема `unknown-key` с ближайшим
 * допустимым ключом.
 */
function finish(
  ctx: ReadCtx,
  src: Record<string, unknown>,
  at: string,
  kind: IntentRecordKind,
  lift?: (key: string, value: unknown) => boolean
): void {
  for (const [other, first] of ctx.conflicts.get(src) ?? []) {
    problem(
      ctx,
      'key-conflict',
      `${at}.${other}`,
      `\`${other}\` and \`${first}\` mean the same key and hold different values`,
      `one of them: \`${first}\` is read`
    );
  }
  const used = ctx.used.get(src) ?? new Set<string>();
  for (const key of Object.keys(src)) {
    if (src[key] === undefined || used.has(key)) continue;
    if (lift?.(key, src[key])) continue;
    const near = nearestKey(key, ctx.asked.get(src) ?? new Map());
    problem(
      ctx,
      'unknown-key',
      `${at}.${key}`,
      `unknown key \`${key}\` on ${INTENT_RECORDS[kind].label}` +
        (near ? ` — did you mean \`${near}\`?` : ''),
      recordKeys(kind)
    );
  }
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

/** Как запись словаря становится записью списка. */
interface MapKeying {
  /** Ключ, под который ложится имя записи: `name` у полей, `target` у правил, `selector` у видимости. */
  key: string;
  /**
   * Ключ, под который ложится значение-не-объект: `fields: { email: "string" }` → `type`,
   * `validation: { price: ["required()"] }` → `rules`. Без него такое значение — проблема записи.
   */
  value?: string;
}

/**
 * Записи списка с местом каждой: `fields[2]` у списка, `fields.email` у словаря. Значение словаря,
 * которое не объект и не сокращение {@link MapKeying.value}, остаётся как есть — чтение записи
 * назовёт его «не объект», а не потеряет, как прежний `asList`.
 */
function entriesOf(
  value: unknown,
  base: string,
  keying: MapKeying,
  ctx: ReadCtx
): Array<{ at: string; item: unknown }> {
  if (Array.isArray(value)) return value.map((item, i) => ({ at: `${base}[${i}]`, item }));
  if (value === undefined || value === null) return [];
  if (!isRecord(value)) return [{ at: base, item: value }];
  const entries = Object.entries(value);
  if (entries.length > 0) {
    warn(
      ctx,
      'list-as-map',
      `\`${base}\` is a map — read as a list: the key of each entry is its ${keying.key}.`
    );
  }
  return entries.map(([name, v]) => ({
    at: `${base}.${name}`,
    item: isRecord(v)
      ? { [keying.key]: name, ...v }
      : keying.value !== undefined
        ? { [keying.key]: name, [keying.value]: v }
        : v,
  }));
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

/**
 * Поле кита, чьё имя пришло в `type` (в любом регистре); `null` — это тип значения, неизвестное
 * имя или каталога кита нет.
 */
function componentOfType(value: unknown, uiKit: UiKitComponents): string | null {
  const key = asName(value)?.toLowerCase();
  if (!key) return null;
  return Object.keys(uiKit.fields).find((name) => name.toLowerCase() === key) ?? null;
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
  if (value !== undefined && value !== null && typeof value !== 'string') {
    problem(
      ctx,
      'invalid-value',
      `${at}.type`,
      `\`type\` is ${typeof value}`,
      'string | number | boolean | date | array | object'
    );
    return 'string';
  }
  const raw = asName(value);
  if (!raw) {
    warn(ctx, 'type-default', `${at}: no type — \`string\` taken.`, at);
    return 'string';
  }
  const hit = FIELD_TYPE_ALIASES[raw.toLowerCase()];
  if (hit) return hit;
  warn(
    ctx,
    'type-unknown',
    `${at}: type \`${raw}\` is unknown — \`string\` taken ` +
      '(string | number | boolean | date | array | object).',
    at
  );
  return 'string';
}

/**
 * Свойства, которые модели пишут рядом с записью, а не в `componentProps`. Без props-схем кита
 * поднимаются только они: что ещё принимает компонент, чтение не знает.
 */
const COMMON_FIELD_PROPS: ReadonlySet<string> = new Set([
  'placeholder',
  'hint',
  'description',
  'min',
  'max',
  'step',
  'mask',
  'testId',
  'maxLength',
  'rows',
  'disabled',
  'readOnly',
  'autoComplete',
  'prefix',
  'suffix',
]);
const COMMON_ARRAY_PROPS: ReadonlySet<string> = new Set([
  'title',
  'addButtonLabel',
  'itemLabel',
  'emptyMessage',
  'reorderable',
  'minItems',
  'maxItems',
  'testId',
]);
const COMMON_CONTAINER_PROPS: ReadonlySet<string> = new Set([
  'title',
  'description',
  'submitLabel',
  'testId',
  'className',
]);

/**
 * Свойства компонента по props-схеме кита. `strict` — схема закрыта (`additionalProperties: false`):
 * чего в ней нет, того у компонента нет. Открытая схема лишь добавляет свои свойства к общеизвестным.
 */
function propsOf(
  ctx: ReadCtx,
  component: string
): { names: ReadonlySet<string>; strict: boolean } | null {
  const schema = ctx.uiKitProps?.defaults[component];
  if (!schema) return null;
  const properties = isRecord(schema.properties) ? Object.keys(schema.properties) : [];
  return { names: new Set(properties), strict: schema.additionalProperties === false };
}

/**
 * Поднять ключ остатка записи в `componentProps`, если это свойство её компонента: `placeholder`,
 * `min`, `mask` у поля, `title` у секции, `submitLabel` у мастера. Решает props-схема кита, без неё —
 * общеизвестные свойства (`common`).
 *
 * Общеизвестное свойство, которого у компонента по закрытой схеме нет, — проблема с перечнем того,
 * что есть: это не опечатка ключа, а не тот компонент или не то место.
 */
function liftProp(
  ctx: ReadCtx,
  at: string,
  key: string,
  value: unknown,
  component: string,
  props: Record<string, unknown>,
  common: ReadonlySet<string>
): boolean {
  const schema = propsOf(ctx, component);
  const isProp = schema
    ? schema.names.has(key) || (!schema.strict && common.has(key))
    : common.has(key);
  if (!isProp) {
    if (!schema?.strict || !common.has(key)) return false;
    problem(
      ctx,
      'prop-unsupported',
      `${at}.${key}`,
      `\`${key}\` is not a key of this record, and \`${component}\` has no \`${key}\` prop`,
      `\`${component}\` props: ${[...schema.names].join(', ')}`
    );
    return true;
  }
  if (props[key] !== undefined && !sameValue(props[key], value)) {
    problem(
      ctx,
      'key-conflict',
      `${at}.${key}`,
      `\`${key}\` is set both here and in componentProps, with different values`,
      `one place: componentProps.${key}`
    );
    return true;
  }
  props[key] = value;
  warn(
    ctx,
    'prop-lifted',
    `${at}.${key}: moved into componentProps — it is a \`${component}\` prop.` +
      (key === 'min' || key === 'max'
        ? ` It bounds the input only; a validation error needs a rule: ${key}(…).`
        : ''),
    at
  );
  return true;
}

/**
 * `required` поля: логическое, а строка `"true"`/`"false"` — с заметкой. Прочее — проблема: раньше
 * всё, кроме `true`, молча значило «необязательно».
 */
function readRequired(value: unknown, at: string, ctx: ReadCtx): boolean {
  if (value === undefined || value === null || typeof value === 'boolean') return value === true;
  if (typeof value === 'string' && /^(true|false)$/i.test(value.trim())) {
    const flag = value.trim().toLowerCase() === 'true';
    warn(ctx, 'value-coerced', `${at}.required: "${value}" read as ${flag}.`, at);
    return flag;
  }
  problem(
    ctx,
    'invalid-value',
    `${at}.required`,
    `\`required\` is ${JSON.stringify(value)}`,
    'true or false; conditional and custom checks are rules in `validation`'
  );
  return false;
}

function readField(
  raw: unknown,
  at: string,
  ctx: ReadCtx
): { field: FieldIntent; required: boolean } | null {
  if (!isRecord(raw)) {
    problem(ctx, 'not-an-object', at, 'a field is not an object', INTENT_RECORDS.field.sample);
    return null;
  }

  const modelPath = takeName(raw, 'modelPath', ['path', 'model', 'binding'], ctx, at);
  const name = takeName(raw, 'name', ['field', 'key', 'id'], ctx, at) ?? modelPath;
  if (!name) {
    problem(
      ctx,
      'missing-key',
      `${at}.name`,
      'a field has no name',
      'a non-empty `name` (or `modelPath` — the path in the model, it becomes the name)'
    );
    return null;
  }

  const rawType = take(raw, 'type', ['fieldType', 'valueType', 'dataType'], ctx);
  const named = takeName(raw, 'component', ['componentName', 'widget', 'control'], ctx, at);
  // `type: "Select"` — имя компонента, а не тип значения. По типу `select` → `string` поле
  // рисовал `Input`, и выбор из вариантов пропадал с ✓ (ReFormer-j356.5).
  const typeComponent = named ? null : componentOfType(rawType, ctx.uiKit);
  const type = typeComponent
    ? (FIELD_TYPE_ALIASES[typeComponent.toLowerCase()] ??
      COMPONENT_VALUE_TYPE[typeComponent] ??
      'string')
    : readFieldType(rawType, at, ctx);
  const component = named ?? typeComponent ?? DEFAULT_COMPONENT[type];
  if (typeComponent) {
    warn(
      ctx,
      'type-is-component',
      `${at}: \`type: "${String(rawType)}"\` is a component name — read as component ` +
        `\`${typeComponent}\` with value type \`${type}\`. Write the component in \`component\`.`,
      at
    );
  } else if (!named) {
    warn(
      ctx,
      'component-default',
      `${at}: no component — \`${component}\` taken for type \`${type}\`.`,
      at
    );
  }

  const componentProps: Record<string, unknown> = {
    ...takeRecord(raw, 'componentProps', ['props'], ctx, at),
  };
  // `options` — двусмысленный ключ: строка это ИМЯ справочника (`$dataSource(...)`), массив —
  // готовые значения, и им место в пропсах компонента, а не в реестре источников.
  const options = take(raw, 'optionsSource', ['dataSource', 'optionsRef', 'options'], ctx);
  if (Array.isArray(options)) componentProps.options = options;
  // Та же двусмысленность у подсказок: строка — справочник, массив — готовые подсказки.
  const suggestions = take(raw, 'suggestionsSource', ['suggestionsRef', 'suggestions'], ctx);
  if (Array.isArray(suggestions)) componentProps.suggestions = suggestions;
  for (const [key, value] of [
    ['optionsSource', options],
    ['suggestionsSource', suggestions],
  ] as const) {
    if (value === undefined || value === null || typeof value === 'string') continue;
    if (Array.isArray(value)) continue;
    problem(
      ctx,
      'invalid-value',
      `${at}.${key}`,
      `\`${key}\` is ${typeof value}`,
      'the name of a data source ("LOAN_TYPES") or a list of options'
    );
  }

  const label = takeName(raw, 'label', ['title', 'caption'], ctx, at);
  const selector = takeName(raw, 'selector', ['nodeSelector'], ctx, at);
  const optionsSource = asName(options);
  const suggestionsSource = asName(suggestions);
  const initialValue = take(raw, 'initialValue', ['defaultValue', 'default'], ctx);
  const required = readRequired(take(raw, 'required', ['isRequired', 'mandatory'], ctx), at, ctx);
  finish(ctx, raw, at, 'field', (key, value) =>
    liftProp(ctx, at, key, value, component, componentProps, COMMON_FIELD_PROPS)
  );

  return {
    field: {
      name,
      modelPath: modelPath ?? name,
      type,
      component,
      ...(label ? { label } : {}),
      ...(selector ? { selector } : {}),
      ...(optionsSource ? { optionsSource } : {}),
      ...(suggestionsSource ? { suggestionsSource } : {}),
      ...(Object.keys(componentProps).length > 0 ? { componentProps } : {}),
      ...(initialValue !== undefined ? { initialValue } : {}),
    },
    required,
  };
}

/** Синонимы `itemFields`: так строки массива называют и в `arrays`, и в записи поля. */
const ITEM_FIELDS_ALIASES = ['fields', 'columns', 'items'] as const;

/** Поля словарём: `{ email: { … } }` либо сокращение `{ email: "string" }` — тип значения. */
const FIELD_KEYING: MapKeying = { key: 'name', value: 'type' };
/** Поля строки массива словарём — как поля формы. */
const ROW_KEYING: MapKeying = FIELD_KEYING;
/** Правила словарём: ключ — цель правила, значение-не-объект — сами правила. */
const RULE_KEYING: MapKeying = { key: 'target', value: 'rules' };

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
    problem(ctx, 'not-an-object', at, 'an array is not an object', INTENT_RECORDS.array.sample);
    return null;
  }

  const modelPath = takeName(raw, 'modelPath', ['path'], ctx, at);
  const name = takeName(raw, 'name', ['field', 'key', 'id'], ctx, at) ?? modelPath;
  if (!name) {
    problem(
      ctx,
      'missing-key',
      `${at}.name`,
      'an array has no name',
      'a non-empty `name` (or `modelPath` — the path in the model)'
    );
    return null;
  }

  // Массив, записанный полем, несёт `type: "array"` — это и есть признак массива, а не потеря.
  const declaredType = take(raw, 'type', ['fieldType', 'valueType', 'dataType'], ctx);
  if (
    declaredType !== undefined &&
    FIELD_TYPE_ALIASES[String(asName(declaredType)).toLowerCase()] !== 'array'
  ) {
    problem(
      ctx,
      'invalid-value',
      `${at}.type`,
      `an array has \`type: ${JSON.stringify(declaredType)}\``,
      'no `type` on an array (or `"array"`); the row fields are `itemFields`'
    );
  }

  const itemFields: FieldIntent[] = [];
  const required: string[] = [];
  const rows = take(raw, 'itemFields', ITEM_FIELDS_ALIASES, ctx);
  for (const { at: rowAt, item } of entriesOf(rows, `${at}.itemFields`, ROW_KEYING, ctx)) {
    const read = readField(item, rowAt, ctx);
    if (!read) continue;
    itemFields.push(read.field);
    if (read.required) required.push(read.field.modelPath ?? read.field.name);
  }

  const itemInterfaceName = takeName(
    raw,
    'itemInterfaceName',
    ['itemType', 'itemInterface', 'itemName'],
    ctx,
    at
  );
  const initialValue = take(raw, 'initialValue', ['initialRows', 'rows', 'defaultValue'], ctx);
  const component = takeName(raw, 'component', ['componentName'], ctx, at);
  const props = takeRecord(raw, 'componentProps', ['props'], ctx, at);
  const componentProps: Record<string, unknown> = { ...props };
  // Подпись массива — заголовок `FieldArray`. У своего компонента её некуда положить, не угадывая
  // его пропсы, — и молча её не теряем.
  const label = takeName(raw, 'label', ['title', 'caption'], ctx, at);
  const fieldArray = (component ?? 'FieldArray') === 'FieldArray';
  if (label && fieldArray && componentProps.title === undefined) {
    componentProps.title = label;
  } else if (label && !fieldArray) {
    problem(
      ctx,
      'prop-unsupported',
      `${at}.label`,
      `the label of an array is the title of FieldArray, and this array is drawn by \`${component}\``,
      `the prop of \`${component}\` in componentProps`
    );
  }
  finish(ctx, raw, at, 'array', (key, value) =>
    liftProp(ctx, at, key, value, component ?? 'FieldArray', componentProps, COMMON_ARRAY_PROPS)
  );

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
      ...(props !== undefined || Object.keys(componentProps).length > 0 ? { componentProps } : {}),
    },
    required,
  };
}

/**
 * Строки списка (`rules`, `sources`): строка как есть, запись — по одному ключу имени. Запись с
 * чем-то ещё (`{ "name": "minLength", "args": [2] }`) — проблема: имя из неё взялось бы, а
 * аргументы пропали бы молча.
 */
function readStrings(value: unknown, at: string, ctx: ReadCtx, sample: string): string[] {
  const out: string[] = [];
  asList(value).forEach((item, i) => {
    if (typeof item === 'string') {
      if (item.trim()) out.push(item.trim());
      return;
    }
    if (isRecord(item)) {
      const keys = Object.keys(item);
      const key = keys.length === 1 ? keys[0] : undefined;
      const name = key && ['name', 'ref', 'path', 'field'].includes(key) ? asName(item[key]) : null;
      if (name) {
        out.push(name);
        return;
      }
    }
    problem(
      ctx,
      'invalid-value',
      Array.isArray(value) ? `${at}[${i}]` : at,
      `${JSON.stringify(item)} is not a string`,
      sample
    );
  });
  return out;
}

/**
 * Параметры замечания: имя → выражение над `values`. Число и логическое — то же выражение, записанное
 * без кавычек; объект и список выражением не прочитать.
 */
function readParams(value: unknown, at: string, ctx: ReadCtx): Record<string, string> | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    problem(
      ctx,
      'invalid-value',
      `${at}.params`,
      `\`params\` is ${Array.isArray(value) ? 'an array' : typeof value}`,
      '{ "max": "values.limit" } — name → expression over `values`'
    );
    return undefined;
  }
  const params: Record<string, string> = {};
  for (const [name, expr] of Object.entries(value)) {
    if (typeof expr === 'string' && expr.trim()) {
      params[name] = expr.trim();
    } else if (typeof expr === 'number' || typeof expr === 'boolean') {
      params[name] = String(expr);
      warn(
        ctx,
        'value-coerced',
        `${at}.params.${name}: ${expr} read as the expression "${expr}".`,
        at
      );
    } else {
      problem(
        ctx,
        'invalid-value',
        `${at}.params.${name}`,
        `the param \`${name}\` is ${JSON.stringify(expr)}`,
        'an expression over `values`: "values.limit"'
      );
    }
  }
  return params;
}

function readValidationRule(raw: unknown, at: string, ctx: ReadCtx): ValidationRuleIntent | null {
  if (!isRecord(raw)) {
    problem(
      ctx,
      'not-an-object',
      at,
      'a validation rule is not an object',
      INTENT_RECORDS.rule.sample
    );
    return null;
  }

  const target = takeName(raw, 'target', ['field', 'path', 'name', 'for'], ctx, at);
  if (!target) {
    problem(
      ctx,
      'missing-key',
      `${at}.target`,
      'the rule does not say which field it checks',
      '`target` — the path in the model, e.g. `personal.lastName`'
    );
    return null;
  }

  const written = take(raw, 'rules', ['rule', 'validators', 'checks'], ctx);
  const rules = readStrings(written, `${at}.rules`, ctx, 'a validator call: "minLength(2)"');
  const async = takeName(raw, 'async', ['asyncValidator', 'asyncRule'], ctx, at);
  const cross = takeName(raw, 'cross', ['crossCheck', 'check'], ctx, at);
  const call = takeName(raw, 'call', ['operator', 'invoke'], ctx, at);
  if (rules.length === 0 && !async && !cross && !call) {
    // `"rules": []` — так модель пишет «у этого поля правил нет» (замер ассистента конструктора
    // 2026-11-03, сценарий 21.4). Отказ стоил ей хода и ничего не спасал: записи нечего проверять.
    if (Array.isArray(written) && written.length === 0) {
      warn(
        ctx,
        'rule-empty-dropped',
        `${at}: the rule on \`${target}\` has no checks ("rules": []) — dropped.`,
        at
      );
      return null;
    }
    problem(
      ctx,
      'missing-key',
      `${at}.rules`,
      `the rule on \`${target}\` has no validator`,
      '`rules`: ["required()", "minLength(2)"] — factories of `@reformer/core/validators` or ' +
        'your own from `operators`; or `cross`, `async`, `call`'
    );
    return null;
  }

  const when = takeName(raw, 'when', ['condition'], ctx, at);
  const each = takeName(raw, 'each', ['array', 'arrayPath'], ctx, at);
  const code = takeName(raw, 'code', ['issue', 'errorCode'], ctx, at);
  const message = takeName(raw, 'message', ['text', 'errorMessage'], ctx, at);
  const level = takeName(raw, 'severity', ['level'], ctx, at)?.toLowerCase();
  const severity = level === 'warning' || level === 'warn' ? 'warning' : undefined;
  if (level && level !== 'error' && !severity) {
    problem(
      ctx,
      'invalid-value',
      `${at}.severity`,
      `\`severity\` is "${level}"`,
      '"error" (the default) or "warning"'
    );
  }
  const params = readParams(take(raw, 'params', ['messageParams', 'issueParams'], ctx), at, ctx);
  finish(ctx, raw, at, 'rule');
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
  const selector = takeName(raw, 'selector', ['node', 'target'], ctx, at);
  if (kind !== 'renderEffect' && !selector) {
    problem(
      ctx,
      'missing-key',
      `${at}.selector`,
      `\`${kind}\` does not say which schema node it handles`,
      'the `selector` of a layoutRoot node: { "kind": "onMount", "selector": "wizard", "expr": "…" }'
    );
    return null;
  }
  const event = takeName(raw, 'event', ['prop', 'eventName'], ctx, at);
  if (kind === 'onComponentEvent' && !event) {
    problem(
      ctx,
      'missing-key',
      `${at}.event`,
      '`onComponentEvent` does not name the component event',
      '`event` — the event prop of the node component: "onSubmit"'
    );
    return null;
  }
  const expr = takeName(raw, 'expr', ['expression', 'code', 'handler', 'body'], ctx, at);
  if (!expr) {
    problem(
      ctx,
      'missing-key',
      `${at}.expr`,
      `\`${kind}\` has no handler body`,
      '`expr` — the TS body, printed as is'
    );
    return null;
  }
  // У `renderEffect` узла нет, у остальных правил — нет события: такие ключи правило не исполнит.
  finish(
    ctx,
    raw,
    at,
    'node-rule',
    (key) =>
      // `sources: []` — привычка записей поведения; пустой список ничего не теряет.
      key === 'sources' && Array.isArray(raw.sources) && raw.sources.length === 0
  );
  if (kind === 'renderEffect' && selector) {
    problem(
      ctx,
      'invalid-value',
      `${at}.selector`,
      '`renderEffect` belongs to the whole schema, not to a node',
      'no `selector` on `renderEffect`; a node hook is `onInit`/`onMount`/`onUnmount`'
    );
  }
  if (kind !== 'onComponentEvent' && event) {
    problem(
      ctx,
      'invalid-value',
      `${at}.event`,
      `\`${kind}\` has no event`,
      'a component event is `onComponentEvent` with `event`'
    );
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
    problem(
      ctx,
      'not-an-object',
      at,
      'a behavior is not an object',
      INTENT_RECORDS.behavior.sample
    );
    return null;
  }

  const declared = takeName(raw, 'kind', ['type', 'op', 'operator'], ctx, at);
  const kind = declared
    ? BEHAVIOR_BY_KEY.get(declared.toLowerCase().replace(/[^a-z]/g, ''))
    : undefined;
  if (!kind) {
    problem(
      ctx,
      declared ? 'unknown-kind' : 'missing-key',
      `${at}.kind`,
      declared ? `unknown behavior kind \`${declared}\`` : 'a behavior has no kind',
      `${BEHAVIOR_KINDS.join(' | ')} — \`choose_api\` picks one for a requirement`
    );
    return null;
  }
  if (isNodeKind(kind)) return readNodeRule(raw, kind, at, ctx);

  const target = takeName(raw, 'target', ['field', 'path', 'to', 'writes'], ctx, at);
  if (!target) {
    problem(
      ctx,
      'missing-key',
      `${at}.target`,
      `\`${kind}\` does not say which field it writes`,
      '`target` — the path in the model'
    );
    return null;
  }

  // У вычисления `when` — своё условие рядом с формулой (A8 калибровки), а не формула: читать его
  // синонимом `expr` значило бы посчитать поле условием.
  const computed = kind === 'compute' || kind === 'computeFrom';
  const expr = takeName(
    raw,
    'expr',
    computed
      ? ['expression', 'formula', 'code']
      : ['expression', 'formula', 'code', 'when', 'condition'],
    ctx,
    at
  );
  if (kind === 'call' && !expr) {
    problem(
      ctx,
      'missing-key',
      `${at}.expr`,
      '`call` does not name the call of your operator',
      '`expr` — a call of an operator from `operators`: "roundTo(model.$.price, 100)"'
    );
    return null;
  }
  const options = takeRecord(raw, 'options', ['opts'], ctx, at);
  // Условие вычисления — ключом `when` или внутри `options` (так оно выглядит в коде ядра).
  const optionWhen = options ? asName(options.when) : null;
  const when = computed ? (takeName(raw, 'when', ['condition'], ctx, at) ?? optionWhen) : null;
  const kept = options && optionWhen && computed ? withoutKey(options, 'when') : options;
  const lost =
    kept !== undefined &&
    Object.keys(kept).length > 0 &&
    !(BEHAVIOR_KINDS_WITH_OPTIONS as readonly string[]).includes(kind);
  // Запись читается дальше: остальные её ошибки попадут в тот же отказ.
  const rest = lost ? undefined : kept;
  if (lost) {
    // Сборка печатает `options` не у всех видов: у остальных их молча не было бы (ReFormer-11oe.11).
    problem(
      ctx,
      'unknown-key',
      `${at}.options`,
      `\`${kind}\` takes no options${computed ? ' besides `when`' : ''} — ` +
        `${Object.keys(kept)
          .map((key) => `\`${key}\``)
          .join(', ')} would be lost`,
      computed
        ? 'only the condition: "when":"model.a > 0" (or options: { "when": … })'
        : `drop \`options\`; they are kept by ${BEHAVIOR_KINDS_WITH_OPTIONS.join(', ')}`
    );
  }
  const each = takeName(raw, 'each', ['array', 'arrayPath', 'row'], ctx, at);
  const sources = readStrings(
    take(raw, 'sources', ['reads', 'deps', 'dependsOn', 'from', 'source'], ctx),
    `${at}.sources`,
    ctx,
    'a path in the model: "price"'
  );
  finish(ctx, raw, at, 'behavior');
  return {
    kind,
    target,
    ...(each ? { each } : {}),
    sources,
    ...(expr ? { expr } : {}),
    ...(when ? { when } : {}),
    // Пустые `options` после снятия `when` не печатаются; присланные пустыми — как были.
    ...(rest && (rest === options || Object.keys(rest).length > 0) ? { options: rest } : {}),
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
  // Запись оператора — `{ name, from }`; у записи словаря имя — её ключ.
  const fromRecord = (rec: Record<string, unknown>, at: string, key?: string) => {
    const own = take(rec, 'name', ['id'], ctx);
    if (key !== undefined && own !== undefined && own !== key) {
      problem(
        ctx,
        'key-conflict',
        `${at}.name`,
        `the operator is listed under \`${key}\` and named \`${String(own)}\``,
        'one name: the key of the map'
      );
    }
    const module = take(rec, 'from', ['module', 'path', 'import'], ctx);
    finish(ctx, rec, at, 'operator');
    return { at, name: key ?? own, module };
  };
  const entries: Array<{ at: string; name: unknown; module: unknown }> = isRecord(raw)
    ? Object.entries(raw).map(([name, value]) => {
        const at = `operators.${name}`;
        return isRecord(value) ? fromRecord(value, at, name) : { at, name, module: value };
      })
    : asList(raw).map((item, i) => {
        const at = `operators[${i}]`;
        return isRecord(item) ? fromRecord(item, at) : { at, name: item, module: undefined };
      });
  for (const { at, name, module } of entries) {
    if (typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name.trim())) {
      problem(
        ctx,
        'invalid-value',
        at,
        `the operator name \`${String(name)}\` is not a TS identifier`,
        INTENT_RECORDS.operator.sample
      );
      continue;
    }
    if (module !== undefined && module !== null && typeof module !== 'string') {
      problem(
        ctx,
        'invalid-value',
        at,
        `the module of the operator \`${name}\` is not a string`,
        'a module path, as in import: "./operators", "@/shared/validators"'
      );
      continue;
    }
    operators[name.trim()] = asName(module) ?? DEFAULT_OPERATORS_MODULE;
  }
  return operators;
}

function readVisibility(raw: unknown, at: string, ctx: ReadCtx): VisibilityIntent | null {
  if (!isRecord(raw)) {
    problem(
      ctx,
      'not-an-object',
      at,
      'a visibility rule is not an object',
      INTENT_RECORDS.visibility.sample
    );
    return null;
  }
  const selector = takeName(raw, 'selector', ['node', 'target', 'field', 'ref'], ctx, at);
  const condition = takeName(raw, 'condition', ['when', 'expr', 'hideWhen'], ctx, at);
  if (!selector || !condition) {
    problem(
      ctx,
      'missing-key',
      `${at}.${selector ? 'condition' : 'selector'}`,
      selector
        ? `the visibility rule of \`${selector}\` has no condition`
        : 'a visibility rule has no node selector',
      '`selector` — the selector of a layout node, `condition` — the expression under which the ' +
        'node is HIDDEN'
    );
    return null;
  }
  finish(ctx, raw, at, 'visibility');
  return { selector, condition };
}

/**
 * Значения справочника: список как есть, словарь `{ значение: подпись }` — списком `{ value, label }`.
 * Прочее — проблема: справочник без значений рисует поле выбора пустым.
 */
function readValues(value: unknown, at: string, ctx: ReadCtx): unknown[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    warn(ctx, 'value-coerced', `${at}.values: a map read as { value, label } options.`, at);
    return Object.entries(value).map(([key, label]) => ({ value: key, label: String(label) }));
  }
  problem(
    ctx,
    'invalid-value',
    `${at}.values`,
    `\`values\` is ${typeof value}`,
    '[{ "value": "usd", "label": "USD" }] or a list of primitives'
  );
  return undefined;
}

function readDataSource(raw: unknown, at: string, ctx: ReadCtx): DataSourceIntent | null {
  const plain = asName(raw);
  if (plain) return { name: plain };
  if (!isRecord(raw)) {
    problem(
      ctx,
      'not-an-object',
      at,
      'a data source is neither an object nor a name',
      `"CURRENCIES" or ${INTENT_RECORDS['data-source'].sample}`
    );
    return null;
  }
  const name = takeName(raw, 'name', ['id', 'key', 'source'], ctx, at);
  if (!name) {
    problem(
      ctx,
      'missing-key',
      `${at}.name`,
      'a data source has no name',
      '`name` — the same name as in `optionsSource` of the field'
    );
    return null;
  }
  const note = takeName(raw, 'note', ['description', 'comment'], ctx, at);
  const values = readValues(take(raw, 'values', ['options', 'items', 'data'], ctx), at, ctx);
  finish(ctx, raw, at, 'data-source');
  return { name, ...(note ? { note } : {}), ...(values ? { values } : {}) };
}

/** Шаг сокращённой записи `steps`: заголовок, значок, селектор и имена его полей. */
interface StepRead {
  title: string;
  icon?: string;
  selector?: string;
  fields: string[];
}

function readStep(raw: unknown, at: string, ctx: ReadCtx): StepRead | null {
  const plain = asName(raw);
  if (plain) return { title: plain, fields: [] };
  if (!isRecord(raw)) {
    problem(
      ctx,
      'not-an-object',
      at,
      'a step is neither an object nor a title',
      INTENT_RECORDS.step.sample
    );
    return null;
  }
  const icon = takeName(raw, 'icon', ['emoji'], ctx, at);
  const selector = takeName(raw, 'selector', [], ctx, at);
  const title = takeName(raw, 'title', ['label', 'name', 'caption'], ctx, at);
  if (!title) {
    problem(
      ctx,
      'missing-key',
      `${at}.title`,
      'a step has no title — the wizard shows it in the step indicator',
      INTENT_RECORDS.step.sample
    );
    return null;
  }
  const fields = readStrings(
    take(raw, 'fields', ['fieldNames', 'items', 'refs'], ctx),
    `${at}.fields`,
    ctx,
    'a field name: "lastName"'
  );
  finish(ctx, raw, at, 'step');
  return { title, ...(icon ? { icon } : {}), ...(selector ? { selector } : {}), fields };
}

/**
 * Корень мастера из сокращённой записи шагов: контейнер `wizard` (его рисует `FormWizard`) с узлом
 * шага на каждый шаг и ссылками на его поля. Поле, не названное ни в одном шаге, остаётся вне
 * раскладки — это видит проверка размещения, а не догадка, в какой шаг его поставить.
 *
 * @param props - Свойства мастера из записи `wizard` (`submitLabel`).
 */
function stepsLayout(
  steps: readonly StepRead[],
  arrays: ReadonlySet<string>,
  props: Record<string, unknown>
): LayoutNode {
  return {
    kind: 'container',
    component: 'FormWizard',
    selector: 'wizard',
    ...(Object.keys(props).length > 0 ? { componentProps: props } : {}),
    children: steps.map((step) => ({
      kind: 'step' as const,
      title: step.title,
      ...(step.icon ? { icon: step.icon } : {}),
      ...(step.selector ? { selector: step.selector } : {}),
      children: step.fields.map(
        (ref): LayoutNode => (arrays.has(ref) ? { kind: 'array', ref } : { kind: 'field', ref })
      ),
    })),
  };
}

/**
 * Корень раскладки или части — узел, а не текст: текст у корня печать документа подменила бы пустым
 * `div`, и он пропал бы молча.
 */
function containerRoot(node: LayoutNode | null, at: string, ctx: ReadCtx): LayoutNode | null {
  if (node?.kind !== 'text') return node;
  problem(
    ctx,
    'invalid-value',
    at,
    `\`${at}\` is a text, not a container`,
    `a container around it: { "kind": "container", "component": "Box", "children": [{ "text": "${node.text}" }] }`
  );
  return null;
}

/** Есть ли в раскладке текст — у страницы без полей. */
function hasText(node: LayoutNode | undefined): boolean {
  if (!node) return false;
  if (node.kind === 'text') return true;
  return (node.kind === 'container' || node.kind === 'step') && node.children.some(hasText);
}

/** Запись без вида — текст, если у неё есть `text` и нет того, что делает её узлом. */
function isTextRecord(raw: Record<string, unknown>): boolean {
  return (
    'text' in raw && !['component', 'children', 'ref', 'htmlTag', 'title'].some((key) => key in raw)
  );
}

/**
 * Текстовая часть детей: `{ "text": "Sign in" }`. Адреса у неё нет — рендерер не адресует
 * текстовые части, — поэтому `selector` — проблема с советом обернуть текст в контейнер.
 */
function readTextNode(raw: Record<string, unknown>, at: string, ctx: ReadCtx): LayoutNode | null {
  const value = take(raw, 'text', ['content', 'value'], ctx);
  const selector = takeName(raw, 'selector', [], ctx, at);
  if (selector) {
    problem(
      ctx,
      'invalid-value',
      `${at}.selector`,
      'a text has no selector of its own',
      `a container with the selector around it: { "kind": "container", "component": "Box", "selector": "${selector}", "children": [{ "text": "…" }] }`
    );
  }
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || text.trim() === '') {
    problem(
      ctx,
      typeof text === 'string' || text === undefined ? 'missing-key' : 'invalid-value',
      `${at}.text`,
      'a text node without text',
      INTENT_RECORDS['text-node'].sample
    );
    return null;
  }
  finish(ctx, raw, at, 'text-node');
  return { kind: 'text', text };
}

function readLayoutNode(raw: unknown, at: string, ctx: ReadCtx): LayoutNode | null {
  if (raw === undefined || raw === null) return null;
  // Строка среди детей — ссылка на поле по имени: самая частая сокращённая запись.
  const plain = asName(raw);
  if (plain) return { kind: 'field', ref: plain };
  if (!isRecord(raw)) {
    problem(
      ctx,
      'not-an-object',
      at,
      'a layout node is not an object',
      INTENT_RECORDS['container-node'].sample
    );
    return null;
  }

  const kind = (takeName(raw, 'kind', ['type'], ctx, at) ?? '').toLowerCase();
  if (kind === 'text' || (kind === '' && isTextRecord(raw))) return readTextNode(raw, at, ctx);
  const selector = takeName(raw, 'selector', [], ctx, at);

  if (kind === 'field' || kind === 'array') {
    const ref = takeName(raw, 'ref', ['name', 'field', 'path'], ctx, at);
    if (!ref) {
      problem(
        ctx,
        'missing-key',
        `${at}.ref`,
        `a \`${kind}\` node refers to nothing`,
        '`ref` — the name of a field or an array declared in the intent'
      );
      return null;
    }
    // selector осмыслен только у массива: у поля точка адресации — путь модели, а свой селектор
    // поле несёт в объявлении.
    if (kind === 'field' && selector) {
      problem(
        ctx,
        'invalid-value',
        `${at}.selector`,
        'a field node has no selector of its own',
        `the \`selector\` of the field \`${ref}\` in \`fields\``
      );
    }
    finish(ctx, raw, at, kind === 'field' ? 'field-node' : 'array-node');
    return kind === 'array' && selector ? { kind, ref, selector } : { kind, ref };
  }

  if (kind === 'part' || kind === 'subform') {
    const ref = takeName(raw, 'ref', ['group', 'model', 'path'], ctx, at);
    const part = takeName(raw, 'part', ['name', 'partName'], ctx, at);
    if (!ref || !part) {
      problem(
        ctx,
        'missing-key',
        `${at}.${ref ? 'part' : 'ref'}`,
        'a part node without the group or the part name',
        INTENT_RECORDS['part-node'].sample
      );
      return null;
    }
    finish(ctx, raw, at, 'part-node');
    return { kind: 'part', ref, part, ...(selector ? { selector } : {}) };
  }

  const children = asList(take(raw, 'children', ['items', 'nodes', 'fields'], ctx))
    .map((child, i) => readLayoutNode(child, `${at}.children[${i}]`, ctx))
    .filter((child): child is LayoutNode => child !== null);

  if (kind === 'step') {
    const icon = takeName(raw, 'icon', ['emoji'], ctx, at);
    const title = takeName(raw, 'title', ['label'], ctx, at);
    if (!title) {
      problem(
        ctx,
        'missing-key',
        `${at}.title`,
        'a step has no title — the wizard shows it in the step indicator',
        INTENT_RECORDS['step-node'].sample
      );
      return null;
    }
    finish(ctx, raw, at, 'step-node');
    return {
      kind: 'step',
      title,
      ...(icon ? { icon } : {}),
      ...(selector ? { selector } : {}),
      children,
    };
  }

  const htmlTag = takeName(raw, 'htmlTag', ['tag', 'html'], ctx, at);
  const named = takeName(raw, 'component', ['componentName'], ctx, at);
  // `kind: "section"` — имя контейнера кита, а не вид узла: им и рисуется, как `type: "Select"` у поля.
  const kindComponent =
    !named && kind && kind !== 'container' && kind !== 'group'
      ? containerOfKind(kind, ctx.uiKit)
      : null;
  if (kindComponent) {
    warn(
      ctx,
      'layout-kind-unknown',
      `${at}: \`kind: "${kind}"\` is a component name — read as a container drawn by ` +
        `\`${kindComponent}\`. Write { "kind": "container", "component": "${kindComponent}" }.`,
      at
    );
  } else if (kind && kind !== 'container' && kind !== 'group') {
    warn(
      ctx,
      'layout-kind-unknown',
      `${at}: unknown node kind \`${kind}\` — read as a container ` +
        '(field | array | part | container | step).',
      at
    );
  }
  // `card` вместо `Card`: имя однозначно, как у поля в `normalizeFieldComponent` (ReFormer-11oe.19).
  const inCase =
    named && !(named in ctx.uiKit.exports)
      ? nameIgnoringCase(named, Object.keys(ctx.uiKit.exports))
      : null;
  if (inCase) {
    warn(
      ctx,
      'component-normalized',
      `${at}: \`${named}\` is \`${inCase}\` — component names are case-sensitive.`,
      at
    );
  }
  const component = inCase ?? named ?? kindComponent ?? (htmlTag ? 'div' : 'Box');
  const props = takeRecord(raw, 'componentProps', ['props'], ctx, at);
  const componentProps: Record<string, unknown> = { ...props };
  finish(ctx, raw, at, 'container-node', (key, value) =>
    liftProp(ctx, at, key, value, component, componentProps, COMMON_CONTAINER_PROPS)
  );
  return {
    kind: 'container',
    component,
    ...(htmlTag ? { htmlTag } : {}),
    ...(props !== undefined || Object.keys(componentProps).length > 0 ? { componentProps } : {}),
    ...(selector ? { selector } : {}),
    children,
  };
}

/** Контейнер кита по имени вида узла в любом регистре: `section` → `Section`. */
function containerOfKind(kind: string, uiKit: UiKitComponents): string | null {
  if (!uiKit.found) return null;
  return (
    Object.keys(uiKit.exports).find(
      (name) => !(name in uiKit.fields) && name.toLowerCase() === kind
    ) ?? null
  );
}

/**
 * Прочитать произвольный вход как `FormIntent`.
 *
 * Возвращает ВСЕГДА рабочий intent — из того, что удалось разобрать, — и отдельным списком то,
 * что пришлось выбросить. Бросать исключение здесь нельзя: у MCP оно превращается в `-32603`,
 * который консументу не сообщает ничего.
 */
export function readIntent(raw: unknown, options: ReadIntentOptions = {}): IntentReading {
  const ctx: ReadCtx = {
    warnings: [],
    problems: [],
    renames: new Set(),
    uiKit: options.uiKit ?? NO_UI_KIT,
    uiKitProps: options.uiKitProps,
    used: new WeakMap(),
    asked: new WeakMap(),
    conflicts: new WeakMap(),
  };

  let source: unknown = raw;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
      warn(ctx, 'intent-string', 'The intent came as a string — parsed as JSON.');
    } catch (e) {
      problem(
        ctx,
        'intent-unreadable',
        'intent',
        `the string is not JSON: ${(e as Error).message}`,
        INTENT_RECORDS.intent.sample
      );
      source = {};
    }
  }
  if (!isRecord(source)) {
    problem(
      ctx,
      'intent-unreadable',
      'intent',
      `the intent is ${Array.isArray(source) ? 'an array' : typeof source}`,
      INTENT_RECORDS.intent.sample
    );
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
      `Target \`${String(declaredTarget)}\` is unknown — \`core\` taken ` +
        '(core | renderer-react | renderer-json).'
    );
  }

  const fields: FieldIntent[] = [];
  const requiredTargets: Array<{ target: string; each?: string }> = [];
  const arraysAsFields: Array<{ raw: Record<string, unknown>; at: string }> = [];
  const declaredAt = new Map<string, string>();
  const fieldList = take(src, 'fields', ['formFields', 'inputs'], ctx);
  for (const { at, item } of entriesOf(fieldList, 'fields', FIELD_KEYING, ctx)) {
    if (isArrayAsField(item)) {
      arraysAsFields.push({ raw: item, at });
      continue;
    }
    const read = readField(item, at, ctx);
    if (!read) continue;
    // Второе объявление того же пути — не поле: сборка отказывала про дубль testId (C10), и
    // причина терялась (так читалось правило валидации, записанное в `fields`).
    const path = read.field.modelPath ?? read.field.name;
    const first = declaredAt.get(path);
    if (first !== undefined) {
      problem(
        ctx,
        'duplicate',
        at,
        `the field \`${path}\` is declared a second time (the first is ${first})`,
        'one declaration per model path; checks are `validation` rules'
      );
      continue;
    }
    declaredAt.set(path, at);
    fields.push(read.field);
    if (read.required) requiredTargets.push({ target: read.field.modelPath ?? read.field.name });
  }

  const arrays: ArrayIntent[] = [];
  const addArray = (read: { array: ArrayIntent; required: string[] }): void => {
    arrays.push(read.array);
    for (const path of read.required) {
      requiredTargets.push({ target: path, each: read.array.name });
    }
  };
  const arrayList = take(src, 'arrays', ['formArrays', 'collections', 'repeatables'], ctx);
  for (const { at, item } of entriesOf(arrayList, 'arrays', { key: 'name' }, ctx)) {
    const read = readArray(item, at, ctx);
    if (read) addArray(read);
  }
  // Массив из `fields` — после объявленных в `arrays`: одноимённая запись там побеждает.
  for (const { raw, at } of arraysAsFields) {
    const read = readArray(raw, at, ctx);
    if (!read) continue;
    if (arrays.some((a) => a.name === read.array.name)) {
      warn(
        ctx,
        'array-duplicate',
        `${at}: the array \`${read.array.name}\` is written both in fields and in arrays — the ` +
          '`arrays` entry is used.',
        at
      );
      continue;
    }
    warn(
      ctx,
      'array-as-field',
      `${at}: the field \`${read.array.name}\` has rows — read as an array. Write arrays in ` +
        '`arrays`, and in the layout `{"kind":"array","ref":"…"}`.',
      at
    );
    addArray(read);
  }

  const validation: ValidationRuleIntent[] = [];
  const ruleList = take(src, 'validation', ['validations', 'validationRules', 'rules'], ctx);
  for (const { at, item } of ruleEntries(ruleList, ctx)) {
    const rule = readValidationRule(item, at, ctx);
    if (rule) validation.push(rule);
  }
  // Правило на путь поля строки без `each` — то же правило каждой строки: смысл однозначен, а сборка
  // отказывала C4 «такого пути нет» (ReFormer-j356.11).
  const rowRules: string[] = [];
  validation.forEach((rule, index) => {
    if (rule.each !== undefined) return;
    for (const array of arrays) {
      const base = array.modelPath ?? array.name;
      const rest = rule.target.startsWith(`${base}.`) ? rule.target.slice(base.length + 1) : null;
      if (rest === null || !array.itemFields.some((f) => (f.modelPath ?? f.name) === rest))
        continue;
      validation[index] = { ...rule, target: rest, each: base };
      rowRules.push(`${rule.target} → each ${base}, target ${rest}`);
      return;
    }
  });
  if (rowRules.length > 0) {
    warn(
      ctx,
      'each-lifted',
      `Rules on a row field read as rules of every row: ${rowRules.join('; ')}. A row rule is ` +
        '{ "target": "<row field>", "each": "<array>" }.'
    );
  }

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
      `Fields with \`required: true\`: ${lifted.length} — a \`required()\` rule is added to ` +
        'validation for each. Required lives there: the field record does not keep it.'
    );
  }

  const behavior: BehaviorIntent[] = [];
  const nodes: NodeRuleIntent[] = [];
  const addBehavior = (read: BehaviorIntent | NodeRuleIntent | null): void => {
    if (!read) return;
    if (isNodeKind(read.kind)) nodes.push(read as NodeRuleIntent);
    else behavior.push(read as BehaviorIntent);
  };
  const behaviorList = take(
    src,
    'behavior',
    ['behaviors', 'behaviours', 'behaviour', 'reactions'],
    ctx
  );
  for (const { at, item } of entriesOf(behaviorList, 'behavior', { key: 'target' }, ctx)) {
    addBehavior(readBehavior(item, at, ctx));
  }
  // Правила узлов отдельным списком — так их держит сам `FormIntent`: intent ходит туда-обратно, и
  // прочитанный обратно список `nodes` раньше пропадал молча.
  const nodeList = take(src, 'nodes', ['nodeRules'], ctx);
  for (const { at, item } of entriesOf(nodeList, 'nodes', { key: 'selector' }, ctx)) {
    addBehavior(readBehavior(item, at, ctx));
  }

  const operators = readOperators(take(src, 'operators', ['customOperators'], ctx), ctx);

  const visibility: VisibilityIntent[] = [];
  const visibilityList = take(src, 'visibility', ['visibilityRules', 'hidden', 'hideWhen'], ctx);
  for (const { at, item } of entriesOf(
    visibilityList,
    'visibility',
    { key: 'selector', value: 'condition' },
    ctx
  )) {
    const read = readVisibility(item, at, ctx);
    if (read) visibility.push(read);
  }

  const dataSources: DataSourceIntent[] = [];
  const sourceList = take(src, 'dataSources', ['datasources', 'data_sources', 'dictionaries'], ctx);
  for (const { at, item } of entriesOf(
    sourceList,
    'dataSources',
    { key: 'name', value: 'values' },
    ctx
  )) {
    const read = readDataSource(item, at, ctx);
    if (read) dataSources.push(read);
  }

  // Шаги — сокращением `steps` либо записью `wizard: { steps }`; свойства мастера (`submitLabel`)
  // запись `wizard` несёт рядом со шагами.
  const wizardProps: Record<string, unknown> = {};
  const wizardRaw = take(src, 'wizard', [], ctx);
  let wizardSteps: unknown;
  if (isRecord(wizardRaw)) {
    wizardSteps = take(wizardRaw, 'steps', ['pages'], ctx);
    finish(ctx, wizardRaw, 'wizard', 'wizard', (key, value) =>
      liftProp(ctx, 'wizard', key, value, 'FormWizard', wizardProps, COMMON_CONTAINER_PROPS)
    );
  } else if (wizardRaw !== undefined && wizardRaw !== null) {
    problem(
      ctx,
      'invalid-value',
      'wizard',
      `\`wizard\` is ${Array.isArray(wizardRaw) ? 'an array' : typeof wizardRaw}`,
      INTENT_RECORDS.wizard.sample
    );
  }
  const topSteps = take(src, 'steps', ['pages', 'wizardSteps'], ctx);
  if (wizardSteps !== undefined && topSteps !== undefined && !sameValue(wizardSteps, topSteps)) {
    problem(
      ctx,
      'key-conflict',
      'steps',
      '`steps` and `wizard.steps` both list the steps, differently',
      'one list of steps'
    );
  }
  const steps: StepRead[] = [];
  for (const { at, item } of entriesOf(
    wizardSteps ?? topSteps,
    'steps',
    { key: 'title', value: 'fields' },
    ctx
  )) {
    const step = readStep(item, at, ctx);
    if (step) steps.push(step);
  }

  // `layout` в контракте — режим раскладки ФАЙЛОВ (строка), но модели кладут туда и дерево.
  const declaredLayout = take(src, 'layout', [], ctx);
  const rootRaw = take(src, 'layoutRoot', ['root', 'tree'], ctx);
  if (isRecord(declaredLayout) || Array.isArray(declaredLayout)) {
    if (rootRaw !== undefined) {
      problem(
        ctx,
        'key-conflict',
        'layout',
        '`layout` and `layoutRoot` both hold a layout tree',
        'the tree in `layoutRoot`; `layout` is the file layout of the module: minimalist | folders'
      );
    }
  } else if (
    declaredLayout !== undefined &&
    declaredLayout !== null &&
    !['minimalist', 'folders'].includes(String(declaredLayout))
  ) {
    problem(
      ctx,
      'invalid-value',
      'layout',
      `\`layout\` is ${JSON.stringify(declaredLayout)}`,
      'the file layout of the module: "minimalist" (the default) or "folders"; the form tree is ' +
        '`layoutRoot`'
    );
  }
  const readRoot = containerRoot(
    readLayoutNode(
      rootRaw ?? (isRecord(declaredLayout) ? declaredLayout : undefined),
      'layoutRoot',
      ctx
    ),
    'layoutRoot',
    ctx
  );
  const namesOf = (entities: ReadonlyArray<{ name: string; modelPath?: string }>) =>
    new Set(entities.flatMap((entity) => [entity.name, entity.modelPath ?? entity.name]));
  // Сокращение `steps: [{ title, fields }]` без своей раскладки — корень мастера из узлов шагов.
  // Раньше шаги оставались в `wizard`, а форма собиралась плоской с ✓ (ReFormer-j356.5).
  const layoutRoot =
    (readRoot && refArrays(readRoot, namesOf(arrays), namesOf(fields))) ??
    (steps.length > 0 ? stepsLayout(steps, namesOf(arrays), wizardProps) : null);
  // Рядом с раскладкой шаги не читаются. Совпадают с её шагами — это тот же intent, прочитанный
  // обратно; расходятся — о расхождении надо сказать, а не выбрать молча.
  if (readRoot && steps.length > 0 && !sameSteps(readRoot, steps)) {
    warn(
      ctx,
      'steps-ignored',
      '`steps` and `layoutRoot` disagree — the layout is `layoutRoot`, the `steps` shorthand is ' +
        'not read. Keep one of them.'
    );
  }

  // Именованные части разметки (подформы): словарь «имя → узел».
  const parts: Record<string, LayoutNode> = {};
  const partsRaw = take(src, 'parts', ['subforms', 'fragments'], ctx);
  if (isRecord(partsRaw)) {
    for (const [name, raw] of Object.entries(partsRaw)) {
      const node = containerRoot(readLayoutNode(raw, `parts.${name}`, ctx), `parts.${name}`, ctx);
      if (node) parts[name] = node;
    }
  } else if (partsRaw !== undefined && partsRaw !== null) {
    problem(
      ctx,
      'invalid-value',
      'parts',
      'the layout parts are not a map',
      '{ "address": { "kind": "container", "component": "Box", "children": ["city"] } }'
    );
  }

  // Свои предупреждения консумента (например, из `plan_form`) сохраняем: intent ходит
  // туда-обратно, и терять их на каждом круге — значит терять разбор спеки.
  const notes: IntentWarning[] = asNames(take(src, 'warnings', [], ctx)).map((message) => ({
    code: 'consumer' as const,
    message,
  }));

  const formName = takeName(src, 'formName', ['name', 'title', 'form', 'formTitle'], ctx, 'intent');
  const interfaceName = takeName(
    src,
    'interfaceName',
    ['modelName', 'modelInterface', 'interface'],
    ctx,
    'intent'
  );
  // `$schema` — ссылка редактора на схему файла: формы она не касается.
  use(ctx, src, '$schema');
  finish(ctx, src, 'intent', 'intent');

  if (ctx.renames.size > 0) {
    notes.push({
      code: 'keys-renamed',
      message:
        `Keys brought to the FormIntent contract: ${[...ctx.renames].sort().join(', ')}. ` +
        'The grammar names them (section base).',
    });
  }
  notes.push(...ctx.warnings);

  const normalized: IntentWarning[] = [];
  const normalizedIntent = normalizeWith(
    {
      ...(formName ? { formName } : {}),
      ...(interfaceName ? { interfaceName } : {}),
      target: target ?? 'core',
      layout: declaredLayout === 'folders' ? 'folders' : 'minimalist',
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
    normalized,
    ctx.uiKit
  );
  // Связи, которые собрались бы и молча не работали, — после нормализации: начальные значения
  // полей уже проставлены, и сброс берёт их.
  const behaviorRead = repairBehavior(normalizedIntent, normalized, ctx.problems);
  const intent = { ...normalizedIntent, behavior: behaviorRead };

  const notices = [...notes, ...normalized].filter(
    (notice) => !options.forDocument || !MODULE_ONLY_WARNINGS.has(notice.code)
  );
  return {
    intent: { ...intent, warnings: notices.map((notice) => notice.message) },
    problems: ctx.problems,
    notices,
  };
}

/**
 * Правила валидации списком либо словарём `{ путь: правила }`. Значение словаря — список строк
 * (`["required()"]`), одна запись, список записей или одна строка правила.
 */
function ruleEntries(value: unknown, ctx: ReadCtx): Array<{ at: string; item: unknown }> {
  if (!isRecord(value)) return entriesOf(value, 'validation', RULE_KEYING, ctx);
  if (Object.keys(value).length > 0) {
    warn(
      ctx,
      'list-as-map',
      '`validation` is a map — read as a list: the key of each entry is its target.'
    );
  }
  return rulesFromMap(value);
}

/** Шаги раскладки совпадают с сокращением `steps`: заголовки и поля по порядку. */
function sameSteps(root: LayoutNode, steps: readonly StepRead[]): boolean {
  const own: Array<{ title: string; fields: string[] }> = [];
  const refs = (node: LayoutNode, out: string[]): void => {
    if (node.kind === 'field' || node.kind === 'array') out.push(node.ref);
    else if (node.kind === 'container' || node.kind === 'step') {
      for (const child of node.children) refs(child, out);
    }
  };
  const walk = (node: LayoutNode): void => {
    if (node.kind === 'step') {
      const fields: string[] = [];
      refs(node, fields);
      own.push({ title: node.title, fields });
    } else if (node.kind === 'container') {
      for (const child of node.children) walk(child);
    }
  };
  walk(root);
  return (
    own.length === steps.length &&
    own.every((step, i) => step.title === steps[i].title && sameValue(step.fields, steps[i].fields))
  );
}
