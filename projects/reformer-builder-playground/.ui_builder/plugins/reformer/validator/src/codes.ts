/**
 * Коды диагностик валидатора схемы — и объяснение, почему их не заменяют готовые фразы.
 *
 * В v1 проверки возвращают `string[]` с русским (и английским) текстом прямо в месте
 * возникновения: `«Правило валидации на "loanAmount": такого поля в форме нет.»`. Здесь
 * то же самое становится `{ code: 'rules.validation-target-missing', params: { target } }`,
 * а текст собирается при показе по ключу `errors.<code>`. Причины — три, и каждая
 * закрывает конкретную поломку v1:
 *
 * 1. **По коду ассистент чинится сам, по переведённой фразе — не может.** Разбирать
 *    `«такого поля в форме нет»` регулярным выражением, чтобы понять, что делать, — это
 *    и есть определение хрупкости: смена формулировки (или локали!) молча ломает
 *    самопочинку. Код — стабильный контракт, `params` — уже разобранные данные, а
 *    {@link QUICKFIX} довершает картину: ассистенту сообщают не только «что не так»,
 *    но и «чем чинить».
 * 2. **Одна ошибка выглядит одинаково в интерфейсе, в логе и в тесте.** Тест утверждает
 *    про `code`, а не про фразу, поэтому правка формулировки не трогает тесты; лог несёт
 *    код, поэтому по логу с чужой машины ошибка ищется поиском по коду, а не по переводу.
 * 3. **Перевод не привязан к месту возникновения.** Проверке незачем знать про локаль
 *    и про то, что показывать надо в мужском роде: словарь живёт в
 *    `host/services/i18n/locales`, а проверка остаётся чистой функцией без i18n в зависимостях.
 *
 * Цена, которую это стоило (записана честно, потому что она повторится в следующем
 * переносе): исходные проверки `@reformer/renderer-json` отдают ГОТОВЫЕ строки, а не
 * структуру, поэтому часть кодов добывается разбором сообщений — см. `./translate`.
 *
 * @module plugins/reformer/validator/codes
 */

/**
 * Идентификатор валидатора. Он же — имя источника в службе диагностик, по которому
 * замещаются прошлые находки (`validator.schema` для быстрого уровня).
 */
export const SCHEMA_VALIDATOR_ID = 'validator.schema';

/**
 * Коды диагностик. Ключ i18n — `errors.<code>`.
 *
 * Три семейства по происхождению, и это не косметика: `schema.*` — ошибка (форма не соберётся
 * или соберётся не той), `structure.*` и `rules.*` — предупреждения (форма соберётся,
 * но часть её мертва). Разделение унаследовано от v1 сознательно: применение хода ассистента
 * требует полной валидности, и ошибка на чужой изначально кривой форме заблокировала бы
 * ассистенту любую работу — включая ту, которая эту форму чинит.
 */
export const CODES = {
  /** Текст не разбирается как JSON. Единственный код, адресуемый ДИАПАЗОНОМ: узла ещё нет. */
  PARSE_FAILED: 'schema.parse-failed',
  /** Разобралось, но это не схема формы: нет `root` или `root` — не узел. */
  NOT_A_FORM: 'schema.not-a-form',

  /**
   * В файле были узлы с одинаковым `$nodeId`, и разбор их починил перевыдачей.
   *
   * Предупреждение, а не ошибка: модель после разбора исправна, редактор работает.
   * Но сказать надо — починка молчалива до первого сохранения (меняется модель,
   * не буфер), и человек, не сохранив, унесёт файл с двойниками дальше. А двойник
   * означает, что правка уйдёт не в тот узел, диагностика встанет не на тот,
   * и превью подсветит не то.
   */
  DUPLICATE_NODE_ID: 'schema.duplicate-node-id',

  /** Узлу не хватает обязательного поля (`must have required property`). */
  MISSING_PROPERTY: 'schema.missing-property',
  /** Опечатка в имени пропа: `componentProps` несёт то, чего у компонента нет. */
  UNKNOWN_PROPERTY: 'schema.unknown-property',
  /** Значение не того типа (`must be boolean`). */
  WRONG_TYPE: 'schema.wrong-type',

  /**
   * Значение не из перечисления (`enum`, `const`).
   *
   * Самый частый вид ошибки значения после типа: в схемах пропсов встроенного кита `enum`
   * стоит 110 раз — варианты, размеры, направления, тип поля ввода. Список допустимого ajv
   * в сообщении НЕ передаёт, но он восстановим из той же схемы каталога и попадает в
   * `params.allowed` (`check.allowedValuesAt`); когда восстановить не вышло, `params.list`
   * переводит фразу на короткую ветку без списка.
   */
  VALUE_NOT_ALLOWED: 'schema.value-not-allowed',
  /** Число вне границ (`must be >= 1`): `params` несёт знак и предел раздельно. */
  OUT_OF_RANGE: 'schema.out-of-range',
  /**
   * Значение записано не в той форме (`pattern` мета-схемы).
   *
   * В `params.expected` не сама регулярка, а форма, которой она требует (`$model(...)`), —
   * `^\$model\(.+\)$` не подсказывает человеку написать `$model(price)`.
   */
  PATTERN_MISMATCH: 'schema.pattern-mismatch',
  /** `$component(X)`, которого нет в каталоге активного кита. */
  UNKNOWN_COMPONENT: 'schema.unknown-component',
  /** `$html(tag)` вне whitelist: разметочные теги, не `script`/`iframe`. */
  HTML_TAG_NOT_ALLOWED: 'schema.html-tag-not-allowed',
  UNKNOWN_DATA_SOURCE: 'schema.unknown-data-source',
  UNKNOWN_FN: 'schema.unknown-fn',
  UNKNOWN_LOCALE_KEY: 'schema.unknown-locale-key',
  /**
   * `$part(имя)` — у подформы (`part`) или в шаблоне строки массива (`item`), — а части с таким
   * именем в `parts` документа нет: рендерер на таком узле бросает.
   */
  UNKNOWN_PART: 'schema.unknown-part',
  /**
   * `$model(...)` в текстовой части или пропе читает путь, который ни одно поле, ни один массив
   * и ни одна подформа в этой области не объявляют: сигнала не будет, в рантайме — пустота.
   * `params.hint` выбирает ветку фразы, `params.suggestion` — ближайший объявленный путь.
   */
  MODEL_PATH_UNBOUND: 'schema.model-path-unbound',
  /**
   * В `initialValue` массива нет части ключей элемента — у этих полей не будет сигнала.
   *
   * Самого `initialValue` формат 2 не требует: шаблон нового элемента живёт в модели, а ключ
   * узла — запасной. Поэтому кода «у массива нет `initialValue`» больше нет; спрашивается
   * только полнота заданного.
   */
  ARRAY_INITIAL_VALUE_INCOMPLETE: 'schema.array-initial-value-incomplete',
  /**
   * Сообщение, которому не нашлось кода, — с исходным текстом в `params.message`.
   *
   * Существует нарочно и не считается временным: проверки живут в чужом пакете, и новое
   * сообщение там не должно приводить к ПОТЕРЕ находки. Ассистент по такой диагностике
   * не чинится (нечего разбирать), человек — вполне.
   */
  INVALID: 'schema.invalid',

  /** Кнопка вкладки без `value`: она не откроет ни одной панели. */
  TAB_WITHOUT_VALUE: 'structure.tab-without-value',
  /** Панель без `value`: до неё нельзя добраться. */
  PANEL_WITHOUT_VALUE: 'structure.panel-without-value',
  /** Панель, на которую не ведёт ни одна кнопка. */
  PANEL_WITHOUT_TAB: 'structure.panel-without-tab',
  /** Кнопка, которой не соответствует ни одна панель. */
  TAB_WITHOUT_PANEL: 'structure.tab-without-panel',
  /** `defaultValue` не совпадает ни с одной вкладкой: при открытии не выбрано ничего. */
  TABS_DEFAULT_VALUE_UNKNOWN: 'structure.tabs-default-value-unknown',
  /** Шагом мастера стоит не-контейнер: полям некуда ложиться. */
  STEP_NOT_CONTAINER: 'structure.step-not-container',

  /** Правило валидации на поле, которого в форме нет. */
  RULE_VALIDATION_TARGET_MISSING: 'rules.validation-target-missing',
  /** Поведение ссылается на поле, которого в форме нет. */
  RULE_BEHAVIOR_TARGET_MISSING: 'rules.behavior-target-missing',
  /** Render-правило адресует узел по `selector`, которого в схеме нет. */
  RULE_RENDER_SELECTOR_MISSING: 'rules.render-selector-missing',
} as const;

export type DiagnosticCode = (typeof CODES)[keyof typeof CODES];

/**
 * Суффикс кода находки, сделанной в разметке ИМЕНОВАННОЙ ЧАСТИ документа (`parts`).
 *
 * Узлам частей идентификаторы не выдаются (части в билдере не редактируются), поэтому находка
 * внутри части адресуется ресурсом — то есть первой строкой файла, — и без имени части человеку
 * неоткуда узнать, где искать. Имя приезжает в `params.part`, а фраза его называет:
 * `«Часть «address»: компонента «Inpit» нет в каталоге кита.»`.
 *
 * Отдельный КОД, а не один лишь параметр: текст находки собирается по ключу `errors.<код>`, и у
 * ключа одна фраза. Параметр, которого у находки нет, фраза показала бы маркером пропуска — так
 * что «часть» нельзя сделать необязательной вставкой в прежнюю фразу. Вариант кода к тому же
 * честен перед тем, кто чинится по коду: `schema.unknown-component` чинится командой над узлом,
 * `schema.unknown-component.in-part` — нет, узла с адресом у неё нет.
 */
export const IN_PART_SUFFIX = '.in-part';

/** Код находки внутри части документа: тот же код с {@link IN_PART_SUFFIX}. */
export type PartDiagnosticCode = `${DiagnosticCode}${typeof IN_PART_SUFFIX}`;

/** Любой код, которым валидатор публикует находку. */
export type AnyDiagnosticCode = DiagnosticCode | PartDiagnosticCode;

/**
 * Коды, с которыми находка бывает внутри части: всё, что говорит об узле разметки.
 *
 * Не входят коды о файле целиком (`parse-failed`, `not-a-form`), о двойниках `$nodeId` (у узлов
 * частей идентификаторов нет) и о правилах-сайдкаре (они адресуют приложенный файл).
 */
export const PART_CODES: readonly DiagnosticCode[] = [
  CODES.MISSING_PROPERTY,
  CODES.UNKNOWN_PROPERTY,
  CODES.WRONG_TYPE,
  CODES.VALUE_NOT_ALLOWED,
  CODES.OUT_OF_RANGE,
  CODES.PATTERN_MISMATCH,
  CODES.UNKNOWN_COMPONENT,
  CODES.HTML_TAG_NOT_ALLOWED,
  CODES.UNKNOWN_DATA_SOURCE,
  CODES.UNKNOWN_FN,
  CODES.UNKNOWN_LOCALE_KEY,
  CODES.UNKNOWN_PART,
  CODES.MODEL_PATH_UNBOUND,
  CODES.ARRAY_INITIAL_VALUE_INCOMPLETE,
  CODES.INVALID,
  CODES.TAB_WITHOUT_VALUE,
  CODES.PANEL_WITHOUT_VALUE,
  CODES.PANEL_WITHOUT_TAB,
  CODES.TAB_WITHOUT_PANEL,
  CODES.TABS_DEFAULT_VALUE_UNKNOWN,
  CODES.STEP_NOT_CONTAINER,
];

/**
 * Код той же находки, сделанной внутри части документа.
 *
 * Код, которого в {@link PART_CODES} нет, возвращается как есть: фразы с именем части у него нет,
 * и находка с несуществующим ключом показала бы человеку сам код вместо текста.
 */
export function inPart(code: DiagnosticCode): AnyDiagnosticCode {
  return PART_CODES.includes(code) ? `${code}${IN_PART_SUFFIX}` : code;
}

/**
 * Команды, которыми чинят.
 *
 * **Валидатор их не регистрирует.** `QuickFix` — это намерение («заменить компонент на такой-то»),
 * а исполняет его тот, кто вообще умеет править документ, — редактор схемы. В этом весь смысл
 * пары «код + команда»: ассистент чинится ТОЙ ЖЕ командой, которой чинит человек из палитры,
 * а не вторым, только для машин написанным путём. Валидатору, чтобы назвать команду, знать
 * её реализацию не требуется — только имя и форму аргументов.
 */
export const COMMANDS = {
  /** `{ resource, nodeId, name }` — поставить узлу другой компонент. */
  SET_COMPONENT: 'schema.set-component',
  /** `{ resource, nodeId, from, to }` — переименовать проп в `componentProps`. */
  RENAME_PROP: 'schema.rename-prop',
  /** `{ resource, nodeId, within, from, to }` — заменить путь в `$model(...)` на месте чтения. */
  SET_MODEL_READ: 'schema.set-model-read',
  /** `{ resource, list, index }` — убрать осиротевшее правило из сайдкара. */
  REMOVE_RULE: 'rules.remove',
} as const;

/** Ключи i18n для подписей быстрых исправлений. */
export const QUICKFIX = {
  REPLACE_COMPONENT: 'quickfix.replace-component',
  RENAME_PROPERTY: 'quickfix.rename-property',
  REPLACE_MODEL_PATH: 'quickfix.replace-model-path',
  REMOVE_ORPHAN_RULE: 'quickfix.remove-orphan-rule',
} as const;
