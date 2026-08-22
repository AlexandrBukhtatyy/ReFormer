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
}

/**
 * Таблица правил. Порядок значения не имеет — выбор идёт по счёту совпавших сигналов.
 * Каждое правило описывает ОДНО решение; близкие решения разведены через `unless`.
 */
export const DECISION_RULES: DecisionRule[] = [
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
      'скрывает УЗЕЛ РАЗМЕТКИ (render-слой). Поле при этом остаётся в модели и валидируется — если оно должно перестать участвовать, это enableWhen',
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
    intent: 'значение поля очищается при изменении условия',
    cues: [/сброс|очист|обнул|reset\b|clear\b|wipe/i],
    unless: [/после отправки|after submit|всю форму|whole form|entire form/i],
    recommend: 'resetWhen',
    because:
      'сбрасывает значение к `resetValue` при истинном условии; для строкового поля resetValue задавать явно, иначе прилетит null',
    alternatives: [
      {
        symbol: 'enableWhen',
        when: 'поле должно ещё и стать недоступным — тогда enableWhen с resetOnDisable',
      },
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
    recommend: 'each',
    because: 'применяет правила к каждому элементу массива, включая добавленные динамически',
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

  // --- сборка ----------------------------------------------------------------
  {
    id: 'stable-form',
    intent: 'форма не должна пересоздаваться при ререндере',
    cues: [
      /пересозда|ререндер|re-?render|stable (form|instance)|useMemo|не терял|losing (input|state)|каждый рендер|every render/i,
    ],
    recommend: 'useFormBundle',
    because:
      'ленивый useState: фабрика выполняется ровно один раз. useMemo здесь неверен — React вправе сбросить кэш, и форма пересоберётся вместе с потерей введённого',
    alternatives: [
      { symbol: 'useReactForm', when: 'тот же хук под именем из @reformer/renderer-react' },
      { symbol: 'useJsonForm', when: 'тот же хук под именем из @reformer/renderer-json' },
    ],
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
      'ambient-сток для операторов поведения: внутри callback доступны compute/copyFrom/enableWhen и остальные',
  },
  {
    id: 'declare-validation',
    intent: 'объявить схему валидации',
    cues: [/объявить (схему )?валид|схем(а|у) валидации|declare .* validation|validation schema/i],
    recommend: 'defineValidationSchema',
    because:
      'ambient-сток для операторов валидации: внутри callback доступны validate/validateAsync/validateWhen/cross/each',
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
