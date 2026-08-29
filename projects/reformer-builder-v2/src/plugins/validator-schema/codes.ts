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
 * @module plugins/validator-schema/codes
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
  /** `$component(X)`, которого нет в каталоге активного кита. */
  UNKNOWN_COMPONENT: 'schema.unknown-component',
  /** `$html(tag)` вне whitelist: разметочные теги, не `script`/`iframe`. */
  HTML_TAG_NOT_ALLOWED: 'schema.html-tag-not-allowed',
  UNKNOWN_DATA_SOURCE: 'schema.unknown-data-source',
  UNKNOWN_FN: 'schema.unknown-fn',
  UNKNOWN_LOCALE_KEY: 'schema.unknown-locale-key',
  /** Массив без `initialValue`: «Добавить» создаст пустой элемент, и его поля не отрисуются. */
  ARRAY_INITIAL_VALUE_MISSING: 'schema.array-initial-value-missing',
  /** В `initialValue` нет части ключей элемента — у этих полей не будет сигнала. */
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
  /** `{ resource, list, index }` — убрать осиротевшее правило из сайдкара. */
  REMOVE_RULE: 'rules.remove',
} as const;

/** Ключи i18n для подписей быстрых исправлений. */
export const QUICKFIX = {
  REPLACE_COMPONENT: 'quickfix.replace-component',
  RENAME_PROPERTY: 'quickfix.rename-property',
  REMOVE_ORPHAN_RULE: 'quickfix.remove-orphan-rule',
} as const;
