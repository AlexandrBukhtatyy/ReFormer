/**
 * Deterministic выбор API по требованию — «дерево решений» над ядром DSL.
 *
 * Зачем отдельный слой, если есть поиск. Полнотекстовый поиск отвечает на вопрос «где про это
 * написано», а здесь вопрос другой: «каким из ДВУХ ПОХОЖИХ операторов это делается». Замерено
 * на корпусе eval: девять задач не берутся с первой формулировки, и в каждой срабатывает лишь
 * последний запрос, буквально равный имени символа. Ни BM25, ни связка «секция → символ» этот
 * разрыв до конца не закрывают: у требования «поле B доступно, только когда A заполнено» нет
 * ни секции с таким заголовком, ни описания символа с такими словами — есть решение, которое
 * человек принимает по смыслу требования.
 *
 * Почему таблица, а не модель. Различий здесь мало и они жёсткие: «вычислить» против
 * «скопировать», «скопировать» против «синхронизировать», «заблокировать» против «спрятать»,
 * «сбросить» против «заблокировать». Ровно эти пары и перечислены в секциях `Anti-patterns`
 * самой документации («❌ resetWhen вместо enableWhen для disable-сценария», «❌ двусторонняя
 * связь через два copyFrom → ✅ syncFields»). Детерминированный ответ здесь и точнее, и
 * дешевле, и воспроизводим.
 *
 * Почему TS-файл, а не JSON: имена символов проверяются тестом против реального индекса
 * (api-decision.test.ts) — правило, рекомендующее несуществующий API, не должно дожить до
 * релиза. Тот же приём, что в scripts/check-mcp-prompts.mjs.
 */

/** Одно правило выбора. */
export interface DecisionRule {
  id: string;
  /** Что за намерение распознаём — попадает в объяснение. */
  intent: string;
  /** Сигналы в тексте требования. Русские и английские: пользователи пишут и так, и так. */
  cues: RegExp[];
  /** Сигналы, ОТМЕНЯЮЩИЕ правило — ими разводятся близкие случаи. */
  unless?: RegExp[];
  /** Рекомендуемый символ. Обязан существовать — проверяется тестом. */
  recommend: string;
  /** Почему именно он. Одна фраза, по существу требования. */
  because: string;
  /** Чем это НЕ является — самые частые подмены. */
  alternatives?: Array<{ symbol: string; when: string }>;
  /**
   * Каноничная запись вызова — печатается вместо сигнатуры и примера из индекса.
   *
   * Нужна, когда одно имя живёт в двух модулях: `apply` и `applyEach` есть и в поведении, и в
   * валидации, а индекс символов отдаёт одно объявление. Его сигнатура и пример относились бы
   * к другому слою, и ответ «каким оператором» учил бы чужому импорту.
   */
  usage?: string;
}

/**
 * Таблица правил. Порядок значения не имеет — выбор идёт по счёту совпавших сигналов.
 * Каждое правило описывает ОДНО решение; близкие решения разведены через `unless`.
 */
export const DECISION_RULES: DecisionRule[] = [
  /**
   * Агрегат по массиву. Стоит ПЕРЕД `derive-value` не по порядку (выбор идёт по счёту), а по
   * числу сигналов: конъюнкция «агрегатное слово» + «слово про массив» даёт 2 совпадения и
   * обгоняет одиночный cue соседа.
   *
   * Зачем отдельное правило: `derive-value` цеплял такие требования словом «сумма» и уверенно
   * советовал `computeFrom` с примером на фиксированных источниках. Для массива переменной
   * длины перечислить сигналы элементов нельзя — строки появляются и исчезают. Инструмент,
   * чья заявленная сила — «какой из двух похожих», отвечал похожим и неверным.
   */
  {
    id: 'aggregate-array-into-field',
    intent: 'поле собирает агрегат по элементам массива',
    // Конъюнкция, а не два независимых сигнала: по отдельности «сумма» встречается в любом
    // вычислении, а «массив» — в правилах про each/applyEach. Совпадать должно И то, И другое,
    // в любом порядке — отсюда lookahead вместо перечисления.
    cues: [
      /(?=[\s\S]*(сумм|итог|среднее|количеств|подсч[ёе]т|total|sum\b|count\b|average|aggregate))(?=[\s\S]*(масс|элемент|строк|списк|позици|array|items?\b|rows?\b|FormArray))/i,
    ],
    // Поведение на КАЖДОМ элементе — это applyEach/each, а не агрегат в одно поле.
    unless: [/кажд|each\b|per\s+item|на\s+элемент/i],
    recommend: 'compute',
    because:
      'источники — элементы массива переменной длины, перечислить их сигналы нельзя. `compute` с auto-tracking читает value-proxy: `compute(model.$.total, () => model.rows.map(r => r.amount).reduce((a, b) => a + b, 0))`. Именно value-proxy (`model.rows`), а не signals-proxy (`model.$.rows`): у второго нет `.map`, а `model.get()` не реактивен',
    alternatives: [
      {
        symbol: 'computeFrom',
        when: 'источников фиксированное число и они известны поимённо — тогда зависимости видны в сигнатуре',
      },
    ],
  },
  // --- значение поля: вычислить / скопировать / синхронизировать -------------
  {
    id: 'derive-value',
    intent: 'значение поля выводится из других полей',
    cues: [
      /вычисл|расч[ёе]т|производн|сумм|итог|total|computed?|derive|calculate|sum\b|multiply/i,
      /из\s+(других|двух|полей)|from\s+(other|another|two)\s+field/i,
    ],
    unless: [/копиру|copy\b|такой же|same as/i],
    recommend: 'computeFrom',
    because:
      'target вычисляется из ЯВНО перечисленных источников: computeFrom(sources, fn) — зависимости видны в сигнатуре и попадают в проверку циклов',
    alternatives: [
      {
        symbol: 'compute',
        when: 'источники не хочется перечислять — auto-tracking по прочитанным сигналам',
      },
      { symbol: 'copyFrom', when: 'значение не вычисляется, а копируется как есть' },
    ],
  },
  {
    id: 'copy-value',
    intent: 'поле повторяет значение другого',
    cues: [
      /копиру|скопир|copy\b|такой же|совпада[ею]т с|same as|mirror/i,
      /адрес доставки|billing|shipping/i,
    ],
    unless: [/в обе стороны|двусторон|two[- ]way|both directions|синхрон|sync\b/i],
    recommend: 'copyFrom',
    because: 'односторонний перенос значения source → target, опционально по условию `when`',
    alternatives: [
      {
        symbol: 'syncFields',
        when: 'связь нужна В ОБЕ СТОРОНЫ — два copyFrom дадут конфликт направлений',
      },
      { symbol: 'computeFrom', when: 'значение не копируется, а вычисляется' },
    ],
  },
  {
    id: 'sync-two-way',
    intent: 'два поля держатся одинаковыми в обе стороны',
    cues: [
      /в обе стороны|двусторон|two[- ]way|both directions|синхрон|keep .* in sync|sync(hroni[sz]e)?\b/i,
    ],
    recommend: 'syncFields',
    because: 'двусторонняя связь без петель; через два copyFrom получается конфликт направлений',
    alternatives: [{ symbol: 'copyFrom', when: 'связь нужна только в одну сторону' }],
  },
  {
    id: 'normalize-input',
    intent: 'вводимое значение приводится к форме',
    cues: [
      /привод|нормализ|верхн(ий|ему) регистр|нижн(ий|ему) регистр|trim|uppercase|lowercase|normali[sz]e|transform value|format(ting)? (the )?input/i,
    ],
    recommend: 'transformValue',
    because:
      'трансформация ЗНАЧЕНИЯ САМОГО поля при изменении; transformer обязан быть идемпотентным, иначе получится бесконечный цикл',
  },

  // --- доступность и видимость ----------------------------------------------
  {
    id: 'enable-disable',
    intent: 'доступность поля зависит от условия',
    cues: [
      /доступн|включ|выключ|заблокир|разблокир|enable|disable|greyed|only when|только когда|только если/i,
    ],
    unless: [
      /спрятат|скрыт|hide|hidden|не показыв|invisible/i,
      // «обязательно только когда» — это условная ВАЛИДАЦИЯ, а не доступность: поле остаётся
      // доступным, меняется набор правил. Без этой отсечки слово «только когда» уводило
      // требование в enableWhen.
      /обязательн|required|валидац|validation|validate/i,
      // «заблокировать кнопку отправки» — про submit-контракт, а не про доступность поля.
      /кнопк|button|отправ(к|и|ить)|submit/i,
    ],
    recommend: 'enableWhen',
    because:
      'state-операция: поле остаётся в модели и в разметке, но становится недоступным (и, по опции, сбрасывается)',
    alternatives: [
      { symbol: 'disableWhen', when: 'условие удобнее написать в обратной полярности' },
      { symbol: 'hideWhen', when: 'узел нужно именно СПРЯТАТЬ в разметке, а не заблокировать' },
      { symbol: 'resetWhen', when: 'нужно только очистить значение, доступность не меняется' },
    ],
  },
  {
    id: 'hide-node',
    intent: 'узел разметки скрывается по условию',
    cues: [
      /спрятат|скрыт|скрыва|hide\b|hidden|не показыв|invisible|conditional (visibility|rendering)/i,
      // «показывать X только при условии» — это то же решение с другой стороны: по
      // умолчанию узел скрыт. Без этой формулировки условный ШАГ визарда не распознавался.
      /показыва(ть|ется).{0,20}(только|если|при усл)|show .{0,20}only (when|if)|условн(ый|ого) шаг|conditional (step|wizard step)/i,
    ],
    recommend: 'hideWhen',
    because:
      "скрывает УЗЕЛ СХЕМЫ по `selector`: оператор поведения, пишется в `form.behavior.ts` — `hideWhen(schema.node('selector'), условие)` внутри `defineFormBehavior(({ model, schema }) => …)`. Правило исполняет рендерер; в разметке на JSX это обычное условие в компоненте. Поле при этом остаётся в модели и валидируется — если оно должно перестать участвовать, это enableWhen. На узле ШАГА библиотечного визарда правило прячет содержимое шага, но не сам шаг: динамическое число шагов собирается в JSX",
    alternatives: [
      { symbol: 'enableWhen', when: 'поле должно остаться видимым, но недоступным' },
      {
        // Не экспорт, а метод прокси узла — поэтому записан в вызовной форме: агент должен
        // увидеть, что искать его через get_symbol_docs бесполезно.
        symbol: 'schema.node(selector).setHidden()',
        when: 'скрыть императивно через прокси узла, а не декларативно',
      },
    ],
  },
  {
    id: 'reset-value',
    intent: 'значение поля очищается, пока держится УСЛОВИЕ',
    // `очи(ст|щ)` вместо `очист`: «поле очищается» — самая частая формулировка требования,
    // и на ней правило раньше не срабатывало вовсе (уходило в фолбэк-поиск).
    cues: [/сброс|очи(ст|щ)|обнул|reset\b|clear\b|wipe/i],
    unless: [
      /после отправки|after submit|всю форму|whole form|entire form/i,
      // «сбросить ПРИ ИЗМЕНЕНИИ другого поля» — это факт изменения, а не предикат: resetWhen
      // сработает на истинность условия и не заметит смену значения внутри него. См. reset-on-change.
      /при\s+(изменени|смене)|при\s+кажд\w*\s+измен|когда\s+(пользователь\s+)?\w*\s*(мен|измен)|как только\s+\w*\s*(мен|измен)|on\s+change\s+of|when\s+\w+\s+changes|whenever\s+\w+\s+changes/i,
      // Массив очищается методом `.clear()` из onChange — resetValue к ModelArray неприменим.
      /масс?ив|array\b|список|list\b/i,
    ],
    recommend: 'resetWhen',
    because:
      'сбрасывает значение к `resetValue` при истинном условии; для строкового поля resetValue задавать явно, иначе прилетит null',
    alternatives: [
      {
        symbol: 'enableWhen',
        when: 'поле должно ещё и стать недоступным — тогда enableWhen с resetOnDisable',
      },
      {
        symbol: 'onChange',
        when: 'сброс нужен на ФАКТ изменения управляющего поля, а не пока держится условие',
      },
    ],
  },
  {
    id: 'reset-on-change',
    intent: 'зависимое поле очищается при изменении управляющего',
    cues: [
      // Конъюнкция намеренно в одном регэкспе: по отдельности «очистить» — это resetWhen,
      // а «при изменении» — side-effect. Решение даёт только их сочетание.
      /(?=[\s\S]*(сброс|очи(ст|щ)|обнул|clear\b|reset\b))[\s\S]*(при\s+(изменени|смене)|при\s+кажд\w*\s+измен|когда\s+(пользователь\s+)?\w*\s*(мен|измен)|как только\s+\w*\s*(мен|измен)|on\s+change\s+of|when\s+\w+\s+changes|whenever\s+\w+\s+changes)/i,
      /зависим\w*\s+пол|dependent field|дочерн\w*\s+пол|child field|управляющ|parent (field|choice|select)/i,
    ],
    unless: [
      // Без слова про очистку это не наше решение: «при изменении X загрузить Y» — side-effect.
      /^(?![\s\S]*(сброс|очи(ст|щ)|обнул|clear\b|reset\b))/i,
      /побочн|side effect/i,
    ],
    recommend: 'onChange',
    because:
      'триггер здесь — ФАКТ изменения источника, а не предикат: колбэк onChange выполняется вне effect-контекста, поэтому в нём можно писать сигналы (`model.dependent = ""`)',
    alternatives: [
      {
        symbol: 'resetWhen',
        when: 'сброс держится УСЛОВИЕМ («пока способ оплаты не карта»), а не фактом изменения',
      },
      { symbol: 'watchField', when: 'нужен низкоуровневый примитив без debounce и AbortSignal' },
    ],
  },

  // --- реакции ---------------------------------------------------------------
  {
    id: 'side-effect',
    intent: 'на изменение поля нужен побочный эффект',
    cues: [
      /побочн|side effect|при изменении .* (вызв|запрос|загруз)|react to .* change|on change|дёрну|fetch when/i,
    ],
    unless: [/вычисл|computed?|копиру|copy\b/i],
    recommend: 'onChange',
    because:
      'императивная реакция на изменение, с `debounce` и `immediate`; для получения ЗНАЧЕНИЯ поля из других полей это не нужно — там compute/computeFrom',
  },
  {
    id: 'revalidate',
    intent: 'правило перепроверяется при изменении другого поля',
    cues: [/перепровер|повторн(ая|о) валид|revalidat|re-?validate|trigger validation/i],
    recommend: 'revalidateWhen',
    because:
      'перезапускает валидацию поля при изменении ДРУГИХ полей; триггером не должно быть само поле — оно и так валидируется при изменении',
  },

  // --- массивы ---------------------------------------------------------------
  {
    id: 'per-row-behavior',
    intent: 'поведение навешивается на каждую строку массива',
    cues: [
      /кажд(ой|ый|ую) (строк|элемент|item)|per[- ](item|row)|for each (row|item)|на строку массива/i,
    ],
    unless: [/валид|validat/i],
    recommend: 'applyEach',
    because:
      'применяет под-схему поведения к каждому элементу динамического массива, включая добавленные позже',
  },
  {
    id: 'array-clear-on-flag',
    intent: 'массив очищается, когда сняли флаг, который его показывал',
    cues: [
      // Конъюнкция «очистить» + «массив»: по отдельности первое уводит в resetWhen,
      // а resetValue к ModelArray неприменим — у массива есть собственный `.clear()`.
      /(?=[\s\S]*(очи(ст|щ)|сброс|обнул|clear\b|empty\b|reset\b))[\s\S]*(масс?ив|array\b|список|list\b|строк[иу]|items?\b)/i,
      /флаг|чекбокс|checkbox|галочк|toggle|сня(т|л)|unchecked|выключ|off\b/i,
    ],
    unless: [/^(?![\s\S]*(масс?ив|array\b|список|list\b|строк[иу]|items?\b))/i],
    recommend: 'onChange',
    because:
      'документированный ARRAY CLEANUP PATTERN: `onChange(model.$.hasItems, (on) => { if (!on) model.items.clear(); })` — колбэк выполняется вне effect-контекста, поэтому мутировать массив безопасно',
    alternatives: [
      {
        symbol: 'resetWhen',
        when: 'очищается ОДНО поле, а не массив — там resetValue, а не .clear()',
      },
      { symbol: 'hideWhen', when: 'массив надо только спрятать в разметке, сохранив данные' },
    ],
  },
  {
    id: 'exclusive-flag',
    intent: 'из группы активен ровно один',
    cues: [
      /только один|единственн|ровно один|one of|only one|mutually exclusive|взаимн(о|ое) исключ|single[- ]selection/i,
    ],
    recommend: 'exclusiveFlag',
    because:
      'взаимное исключение булева флага среди строк массива — включение одного гасит остальные',
  },
  {
    id: 'aggregate-array',
    intent: 'значение собирается из строк массива',
    cues: [/агрегац|собра(ть|ние) из|сумм(а|ировать) по строкам|aggregate|roll ?up|total across/i],
    recommend: 'aggregateInto',
    because: 'агрегатная запись из строк массива в поле',
  },

  // --- валидация -------------------------------------------------------------
  {
    id: 'validate-async',
    intent: 'проверка требует обращения к серверу',
    cues: [
      /сервер|бэкенд|async|асинхрон|занят|доступн(ость|о) (email|логин)|availability|remote check|API check/i,
    ],
    unless: [/только на клиенте|client[- ]only/i],
    recommend: 'validateAsync',
    because:
      'асинхронное правило с отменой предыдущего запроса; дебаунс задаётся опцией, вручную его писать не нужно',
  },
  {
    id: 'validate-conditional',
    intent: 'правило действует только при условии',
    cues: [
      /обязательн(о|ы|ое) только|только если|только когда|conditional(ly)? (required|valid)|required (if|when)|validate only when/i,
    ],
    recommend: 'validateWhen',
    because:
      'правила внутри callback активны, пока условие истинно; в остальное время поле не валидируется',
    alternatives: [
      { symbol: 'enableWhen', when: 'поле должно не валидироваться, а стать недоступным' },
    ],
  },
  {
    id: 'validate-cross',
    intent: 'правило сравнивает несколько полей',
    cues: [
      /совпада|сравн|подтвержд|confirm|match(es)? (the )?(password|other)|cross[- ]field|two fields/i,
    ],
    recommend: 'cross',
    because:
      'кросс-полевое правило видит снимок модели целиком, поэтому может сравнивать поля между собой',
  },
  {
    id: 'validate-each',
    intent: 'валидируется каждый элемент массива',
    cues: [
      /кажд(ый|ого) элемент.*валид|валид.*кажд(ый|ого) элемент|each (array )?item|per[- ]row validation|validate .* array item/i,
    ],
    recommend: 'applyEach',
    because:
      'применяет под-схему правил к каждому элементу массива, включая добавленные динамически; у элемента своя область — под-схема получает его под-модель, пути внутри относительны',
    usage: [
      "import { applyEach, defineValidationSchema, validate } from '@reformer/core/validation';",
      "import { required } from '@reformer/core/validators';",
      '',
      'const itemRules = defineValidationSchema<Item>(({ model }) => {',
      '  validate(model.$.title, [required()]);',
      '});',
      '',
      'export const formValidation = defineValidationSchema<Form>(({ model }) => {',
      '  applyEach(model.$.items, itemRules);',
      '});',
    ].join('\n'),
    alternatives: [
      {
        symbol: 'apply',
        when: 'те же правила нужны ОДНОЙ под-модели (подформа), а не каждому элементу массива',
      },
      { symbol: 'each', when: 'прежнее имя этого оператора — заменено на applyEach' },
    ],
  },
  /**
   * Подформа. Отдельное правило, а не альтернатива у массива: требование «один блок адреса в
   * двух местах» не содержит ни слова про массив, и без своего правила уходило в поиск по
   * символам, где `apply` тонет среди `applyEach` и `applyFormSchema`.
   */
  {
    id: 'subform',
    intent: 'одна группа полей (подформа) подключается к под-модели, возможно в нескольких местах',
    cues: [
      /подформ|под-форм|вложенн(ая|ую|ой|ые) (форм|групп)|sub-?form|nested (form|group)/i,
      /переиспольз.{0,40}(групп|блок|част|адрес|правил)|(один|одна|одни) и (тот|та|те) же .{0,40}(в двух|в нескольких|дважды|к двум|к нескольким|для двух|для нескольких)|reus(e|able|ing) .{0,40}(group|part|block|rules|fragment)/i,
    ],
    unless: [/кажд(ой|ый|ую|ого) (строк|элемент)|per[- ](item|row)|each (row|item)/i],
    recommend: 'apply',
    because:
      'подформа подключается привязкой к под-модели — одинаково во всех слоях: под-схема получает под-модель (`model`), пути внутри относительны, поэтому один набор правил ставится в несколько мест',
    usage: [
      '// схема: узел с `part` — часть строится для одной под-модели',
      '{ model: model.$.registrationAddress, part: address }',
      '// та же схема документом: часть объявлена в `parts`, пути внутри — от под-модели',
      '// { "model": "$model(registrationAddress)", "part": "$part(address)" }',
      '',
      "// валидация — import { apply } from '@reformer/core/validation'",
      'apply(model.$.registrationAddress, addressRules);',
      '',
      "// поведение — import { apply } from '@reformer/core/behaviors'",
      'apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);',
    ].join('\n'),
    alternatives: [
      {
        symbol: 'applyEach',
        when: 'часть строится для КАЖДОГО элемента массива (`item` в схеме), а не для одной под-модели',
      },
    ],
  },
  {
    id: 'validate-run',
    intent: 'валидацию нужно запустить и получить результат',
    cues: [
      /запустить валид|прогнать валид|получить результат валид|run validation|validate programmatically|check the form/i,
    ],
    recommend: 'validateModel',
    because:
      'внешний раннер: принимает модель и схему, возвращает boolean; поля обновляются как побочный эффект',
  },

  /**
   * Массив под-форм объявляется в МОДЕЛИ. Отдельное правило, потому что требование «объявить
   * массив объектов» читалось раньше как вопрос про узел схемы — и ответ учил `initialValue` в
   * узле, то есть шаблону элемента, продублированному вне модели.
   */
  {
    id: 'declare-array',
    intent: 'в форме появляется массив под-форм: его надо объявить и дать шаблон нового элемента',
    cues: [
      /объявить.{0,30}массив|массив (объектов|под-?форм)|declare .{0,30}array|array of (objects|sub-?forms)/i,
      /шаблон нов(ого|ой) (элемент|строк)|(template|blank) .{0,20}(new )?(array )?(item|row)|new (row|item) template/i,
    ],
    unless: [/валид|validat|кажд(ой|ый|ую|ого)|each |per[- ](item|row)|очист|clear/i],
    recommend: 'arrayOf',
    because:
      'массив под-форм объявляется в модели вместе с шаблоном нового элемента: `arrayOf(blank)`. Узел схемы после этого — `{ model: model.$.items, item }` без `initialValue`, а «Добавить» — `model.items.push()` без аргумента',
    usage: [
      "import { arrayOf, createModel } from '@reformer/core';",
      '',
      '// model.ts — шаблон возвращает ПОЛНЫЙ элемент с простыми значениями',
      "const blankProperty = (): Property => ({ type: 'apartment', estimatedValue: 0 });",
      'export const createMyModel = () =>',
      '  createModel<MyForm>({ properties: arrayOf(blankProperty) });',
      '',
      '// form.schema.ts — `item` строится для каждого элемента',
      '{ model: model.$.properties, component: FormArray, item: propertyRow }',
      '',
      '// где угодно',
      'model.properties.push(); // новый элемент по шаблону',
    ].join('\n'),
    alternatives: [
      {
        symbol: 'applyEach',
        when: 'массив уже объявлен, нужны правила или поведение для каждой его строки',
      },
    ],
  },

  // --- сборка ----------------------------------------------------------------
  /**
   * Сборка и отрисовка. Раньше на каждый способ реализации была своя фабрика и свой рендерер,
   * и вопрос «чем собрать» зависел от таргета; теперь ответ один — и это надо сказать прямо,
   * иначе поиск по символам вернёт прежние `createReactForm` / `JsonFormRenderer`.
   */
  {
    id: 'one-contract',
    intent: 'форма описывается один раз для всех способов отрисовки и собирается одним вызовом',
    cues: [
      /един(ый|ого|ым) контракт|одн(а|у|ой) схем(а|у|ой)|unified (form )?contract|one schema/i,
      /(и|как) руками.{0,40}рендерер|и в jsx.{0,40}рендерер|both .{0,30}(jsx|by hand).{0,30}renderer|собрать форму|assemble (the |a )?form/i,
    ],
    unless: [/пересозда|ререндер|re-?render|useMemo/i],
    recommend: 'createForm',
    because:
      'контракт формы один на все способы отрисовки: одна схема-дерево с привязкой `model`, одно поведение, одна сборка. Различается только вид схемы (билдер или JSON-документ + `registry`) и то, кто рисует',
    usage: [
      "import { createForm, useFormBundle } from '@reformer/core';",
      '',
      '// form.schema.ts — одно дерево: поле стоит там, где оно рисуется',
      'export const formSchema = (model: FormModel<MyForm>): FormSchemaNode => ({',
      '  component: Box,',
      '  children: [{ model: model.$.email, component: Input, componentProps: { label: "Email" } }],',
      '});',
      '',
      '// index.tsx — одна сборка, один хук',
      'const bundle = useFormBundle(() =>',
      '  createForm<MyForm>({ model: createMyModel(), schema: formSchema, behavior, validation })',
      ');',
      '',
      '<FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} /> // рендерер',
      '<FormRenderer form={bundle} /> // JSON: schema — документ, плюс `registry`',
      '<FormField control={bundle.form.email} /> // разметка руками в JSX',
    ].join('\n'),
    alternatives: [
      { symbol: 'useFormBundle', when: 'вопрос про стабильность формы между ререндерами' },
      {
        symbol: 'createFormFromModel',
        when: 'нужна только форма из готовой модели, без схемы-дерева, поведения и валидации',
      },
    ],
  },
  {
    id: 'draw-form',
    intent: 'собранную форму надо отрисовать',
    cues: [
      /(отрендерить|отрисовать|смонтировать|нарисовать) форму|(render|mount|draw) (the |a )?form\b/i,
    ],
    unless: [/массив|array|строк|rows?\b/i],
    recommend: 'FormRenderer',
    because:
      'рендерер один на TS-схему и на JSON-документ: он получает бандл сборки `createForm` и рисует дерево схемы. Для JSON обёртка поля приходит из реестра (`FIELD_WRAPPER`), для TS — из `settings.fieldWrapper`',
    usage: [
      "import { createForm, useFormBundle } from '@reformer/core';",
      "import { FormRenderer } from '@reformer/renderer-react';",
      '',
      '// TS-схема',
      'const bundle = useFormBundle(() => createForm<MyForm>({ model, schema: formSchema }));',
      '<FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />',
      '',
      '// JSON-документ: тот же вызов, схема — документ, плюс реестр',
      'const bundle = useFormBundle(() => createForm<MyForm>({ model, schema: document, registry }));',
      '<FormRenderer form={bundle} />',
    ].join('\n'),
    alternatives: [
      { symbol: 'FormField', when: 'разметка пишется руками в JSX — по полю на `bundle.form.x`' },
    ],
  },
  {
    id: 'wizard-node',
    intent: 'визард и его шаги стоят узлами схемы',
    cues: [
      /(шаг|шаги|шагов) визарда.{0,40}(узл|схем)|визард.{0,40}(узлом|в схеме)|wizard.{0,40}(schema node|in the schema)|wizard step.{0,30}node/i,
    ],
    recommend: 'FormWizard',
    because:
      'визард — библиотечный компонент, стоящий узлом схемы; шаги — его обычные дети. Форму и валидацию он берёт из сборки сам, а шаг связан со своими правилами по `selector`',
    usage: [
      "import { Step } from '@reformer/cdk/form-wizard';",
      "import { FormWizard } from '@reformer/ui-kit';",
      '',
      '{',
      "  selector: 'wizard',",
      '  component: FormWizard,',
      '  children: [',
      '    {',
      "      selector: 'loan', // ключ в validation.steps",
      '      component: Step,',
      "      componentProps: { title: 'Кредит' },",
      '      children: [{ model: model.$.loanType, component: SelectAsync }],',
      '    },',
      '  ],',
      '}',
      '',
      '// form.validation.ts',
      'export const formValidation = { steps: { loan: loanRules }, extras: crossStepRules };',
    ].join('\n'),
  },
  {
    id: 'stable-form',
    intent: 'форма не должна пересоздаваться при ререндере',
    cues: [
      /пересозда|ререндер|re-?render|stable (form|instance)|useMemo|не терял|losing (input|state)|каждый рендер|every render/i,
    ],
    recommend: 'useFormBundle',
    because:
      'ленивый useState: фабрика выполняется ровно один раз. Хук один на все способы — `useFormBundle(() => createForm({ … }))`. useMemo здесь неверен — React вправе сбросить кэш, и форма пересоберётся вместе с потерей введённого',
  },
  {
    id: 'submit-guard',
    intent: 'отправка блокируется до прохождения валидации',
    cues: [
      /заблокир.*(отправ|submit)|disable.*submit|submit.*(пока|until)|кнопк.*невалид|блокир.*кнопк/i,
    ],
    recommend: 'useFormValidation',
    because:
      'отдаёт `{ submit, isValidating }`: submit прогоняет схему и возвращает boolean, а кнопка блокируется на время проверки через `disabled={isValidating}`. Отдельного реактивного флага «форма валидна» в контракте нет',
  },
  {
    id: 'declare-behavior',
    intent: 'объявить реактивное поведение формы',
    cues: [
      /объявить поведени|схем(а|у) поведени|declare .* behavior|behavior schema|defineFormBehavior/i,
    ],
    recommend: 'defineFormBehavior',
    because:
      'ambient-сток для операторов поведения: внутри callback `({ model, form, schema })` доступны compute/copyFrom/enableWhen и правила узлов схемы (hideWhen по `schema.node(selector)`) — поведение формы одно',
  },
  {
    id: 'declare-validation',
    intent: 'объявить схему валидации',
    cues: [/объявить (схему )?валид|схем(а|у) валидации|declare .* validation|validation schema/i],
    recommend: 'defineValidationSchema',
    because:
      'ambient-сток для операторов валидации: внутри callback доступны validate/validateAsync/validateWhen/cross/apply/applyEach',
  },
];

/** Результат выбора. */
export interface ApiChoice {
  rule: DecisionRule;
  /** Сколько сигналов правила совпало — грубая уверенность. */
  matches: number;
}

/**
 * Подобрать правила под требование.
 *
 * Счёт — число совпавших сигналов; правило с сработавшим `unless` выбывает целиком. Это
 * сознательно грубо: различия здесь бинарные («в обе стороны» или нет), и тонкая шкала
 * добавила бы ложной точности.
 */
export function chooseApi(requirement: string): ApiChoice[] {
  const text = String(requirement ?? '');
  if (!text.trim()) return [];

  const out: ApiChoice[] = [];
  for (const rule of DECISION_RULES) {
    if (rule.unless?.some((re) => re.test(text))) continue;
    const matches = rule.cues.filter((re) => re.test(text)).length;
    if (matches > 0) out.push({ rule, matches });
  }
  out.sort((a, b) => b.matches - a.matches || a.rule.id.localeCompare(b.rule.id));
  return out;
}
