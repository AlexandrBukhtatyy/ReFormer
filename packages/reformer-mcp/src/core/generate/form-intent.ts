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
  /** Компонент, рисующий строки (`FormArray` из ui-kit либо свой). */
  component?: string;
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
  /** Асинхронная проверка: имя функции, которую напишет разработчик. */
  async?: string;
}

/** Реактивная связь над моделью. */
export interface BehaviorIntent {
  kind:
    | 'compute'
    | 'computeFrom'
    | 'copyFrom'
    | 'syncFields'
    | 'onChange'
    | 'enableWhen'
    | 'disableWhen'
    | 'resetWhen'
    | 'transformValue'
    | 'revalidateWhen';
  /** Поле, которое поведение ПИШЕТ. */
  target: string;
  /** Поля, которые оно ЧИТАЕТ. Из них строится проверка циклов. */
  sources: string[];
  /** Тело выражения на TS — вставляется как есть. */
  expr?: string;
  options?: Record<string, unknown>;
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
}

export interface WizardIntent {
  steps: Array<{ title: string; fields: string[] }>;
}

/** Узел layout-дерева. Листья ссылаются на поля/массивы ПО ИМЕНИ, не встраивают их. */
export type LayoutNode =
  | { kind: 'field'; ref: string }
  | { kind: 'array'; ref: string }
  | {
      kind: 'container';
      component: string;
      htmlTag?: string;
      componentProps?: Record<string, unknown>;
      selector?: string;
      children: LayoutNode[];
    }
  | { kind: 'step'; title: string; selector?: string; children: LayoutNode[] };

export type ReformerTargetStack = 'core' | 'renderer-react' | 'renderer-json';

export interface FormIntent {
  formName: string;
  /** Имя интерфейса модели, PascalCase. */
  interfaceName: string;
  target: ReformerTargetStack;
  layout: 'minimalist' | 'folders';
  layoutRoot: LayoutNode;
  fields: FieldIntent[];
  arrays: ArrayIntent[];
  validation: ValidationRuleIntent[];
  behavior: BehaviorIntent[];
  visibility: VisibilityIntent[];
  dataSources: DataSourceIntent[];
  wizard?: WizardIntent;
  /** Всё, чего не хватило для полного бандла, — видно потребителю. */
  warnings: string[];
}

/** `Заявка на кредит` → `CreditApplicationForm`-подобное имя интерфейса. */
export function deriveInterfaceName(formName: string): string {
  const words = String(formName)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const pascal = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
    .replace(/[^A-Za-z0-9]/g, '');
  // Кириллическое имя формы даёт пустой идентификатор — тогда честный дефолт лучше огрызка.
  return pascal.length >= 2 ? `${pascal}Shape` : 'FormShape';
}

/**
 * Довести частичный intent до полного: расставить умолчания и собрать `warnings`.
 *
 * Ничего не выдумывает сверх умолчаний, которые нельзя не иметь (`selector = name`,
 * `modelPath = name`). Всё остальное недостающее попадает в `warnings` — генератор обязан
 * сказать, чего у формы не хватает, а не молча выдать полуфабрикат как готовый результат.
 */
export function normalizeIntent(partial: Partial<FormIntent>): FormIntent {
  const warnings = [...(partial.warnings ?? [])];
  const formName = partial.formName?.trim() || 'Form';

  const fields = (partial.fields ?? []).map((f) => ({
    ...f,
    modelPath: f.modelPath ?? f.name,
    selector: f.selector ?? f.name,
  }));

  const arrays = (partial.arrays ?? []).map((a) => ({
    ...a,
    modelPath: a.modelPath ?? a.name,
    itemFields: (a.itemFields ?? []).map((f) => ({
      ...f,
      modelPath: f.modelPath ?? f.name,
      selector: f.selector ?? f.name,
    })),
    // Массив без начального значения падает на первом добавлении строки.
    initialValue: Array.isArray(a.initialValue) ? a.initialValue : [],
  }));
  for (const a of arrays) {
    if (!Array.isArray(partial.arrays?.find((x) => x.name === a.name)?.initialValue)) {
      warnings.push(`Массив \`${a.name}\` без initialValue — подставлен пустой массив.`);
    }
  }

  // Дедупликация источников данных: одно имя — одна регистрация в реестре.
  const dataSources = [...new Map((partial.dataSources ?? []).map((d) => [d.name, d])).values()];

  if (fields.length === 0 && arrays.length === 0) {
    warnings.push('В intent нет ни одного поля — бандл будет пустым каркасом.');
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
    fields,
    arrays,
    validation: partial.validation ?? [],
    behavior: partial.behavior ?? [],
    visibility: partial.visibility ?? [],
    dataSources,
    wizard: partial.wizard,
    warnings,
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
