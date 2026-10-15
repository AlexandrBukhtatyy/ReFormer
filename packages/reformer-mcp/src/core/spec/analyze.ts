/**
 * Разбор markdown-спеки формы.
 *
 * Вынесено из `prompts/plan-form.ts`: тот же разбор нужен теперь и промпту, и tool'у
 * `plan_form`. Две копии регулярок разошлись бы при первой же правке, и промпт с
 * инструментом начали бы читать одну спеку по-разному.
 *
 * Разбор ЭВРИСТИЧЕСКИЙ и таким и останется: спеки пишут люди, единого формата у них нет.
 * Поэтому результат — не готовый intent, а заготовка с явными `warnings`; выдавать её за
 * точный план значило бы обманывать потребителя.
 */

import type { FieldType } from '../generate/form-intent.js';

export interface SpecField {
  name: string;
  type: FieldType;
  component: string;
  label?: string;
  /**
   * Начальное значение из колонки «Значение». `undefined` — колонки не было либо ячейка пуста;
   * `null` — в спеке ЯВНО написан `null` (штатное «пустое число» в ReFormer).
   */
  initialValue?: unknown;
  /** Валидаторы как фрагменты кода: `required()`, `min(50000)`. Пусто, если правил нет. */
  rules: string[];
  /** Условие активности правил — выражение над `model`. Из «Условное (при X='Y')». */
  when?: string;
  /** Фрагменты колонки «Валидация», которые распознать не удалось. Уходят в `warnings`. */
  unparsedRules: string[];
  /**
   * Номер шага (`### Шаг N`), под которым стоит строка. `undefined` — в спеке нет шагов или
   * строка стоит до первого из них.
   */
  step?: number;
}

/**
 * Массив, собранный из строк вида `properties[].type`: имя массива и поля его элемента.
 *
 * Строка с ключом самого массива (`properties` с типом `FieldArray`) полем не становится — она
 * объявляет массив и даёт ему подпись.
 */
export interface SpecArray {
  name: string;
  label?: string;
  /** Шаг, на котором массив впервые встретился. */
  step?: number;
  itemFields: SpecField[];
}

/** Шаг спеки: номер и заголовок из `### Шаг N: Заголовок`. */
export interface SpecStep {
  number: number;
  title: string;
}

/** Поле или массив в порядке появления в спеке — по нему строится раскладка. */
export interface SpecEntry {
  kind: 'field' | 'array';
  name: string;
}

export interface SpecAnalysis {
  formName: string;
  steps: number;
  /** Шаги с заголовками в порядке спеки. */
  stepList: SpecStep[];
  fieldsPerStep: Record<string, number>;
  fields: SpecField[];
  /** Массивы с полями элемента. Имена — ещё и в `arrays`. */
  arrayDefs: SpecArray[];
  /** Поля и массивы в порядке спеки. */
  order: SpecEntry[];
  conditionalFields: string[];
  computedFields: string[];
  /**
   * Имена массивов. Если массив в спеке упомянут, но строк элемента нет, — подсказка
   * «(см. секцию массивов в спеке)».
   */
  arrays: string[];
  apiEndpoints: string[];
  hasCanonicalLabels: boolean;
  hasMasks: boolean;
  warnings: string[];
}

export function extractFormName(content: string): string {
  const m = content.match(/^#\s+(?:Форма:\s+)?(.+)$/m);
  return m ? m[1].trim() : 'Unknown form';
}

export function countSteps(content: string): number {
  const stepMatches = content.match(/^###\s+(?:Шаг|Step)\s+\d+[:.]/gim) ?? [];
  if (stepMatches.length === 0) {
    const chipTable = content.match(/Шаг\s+\d+[:.]\s+/g);
    return chipTable ? new Set(chipTable).size : 0;
  }
  return stepMatches.length;
}

/** Заголовок шага: `### Шаг 2: Персональные данные`. Номер — группа 1, заголовок — группа 2. */
const STEP_HEADING = /^###\s+(?:Шаг|Step)\s+(\d+)[:.]\s*([^\n]*)/gim;

/** Шаги спеки с позицией заголовка — по ней строка таблицы узнаёт свой шаг. */
function stepHeadings(content: string): Array<SpecStep & { offset: number }> {
  return [...content.matchAll(STEP_HEADING)].map((m) => ({
    number: Number(m[1]),
    title: m[2].trim(),
    offset: m.index ?? 0,
  }));
}

/** Шаги спеки в порядке появления: номер и заголовок. */
export function extractSteps(content: string): SpecStep[] {
  return stepHeadings(content).map(({ number, title }) => ({ number, title }));
}

export function countFieldsPerStep(content: string): Record<string, number> {
  const result: Record<string, number> = {};
  const stepRegex = STEP_HEADING;
  const matches = Array.from(content.matchAll(stepRegex));
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const stepNum = m[1];
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : content.length;
    const section = content.slice(start, end);
    const htmlRowRegex = new RegExp(`<td>\\s*${stepNum}\\.\\d+\\s*</td>`, 'g');
    const htmlMatches = section.match(htmlRowRegex);
    if (htmlMatches && htmlMatches.length > 0) {
      result[`step${stepNum}`] = htmlMatches.length;
      continue;
    }
    const mdRowMatches = section.match(/^\|(?!\s*[-:|\s]+\|\s*$)[^|\n]+\|/gm) ?? [];
    result[`step${stepNum}`] = Math.max(0, mdRowMatches.length - 1);
  }
  return result;
}

/**
 * Литералы, которые по форме неотличимы от имени поля. Позиционный фолбэк ниже сканирует
 * строку до первой «похожей на ключ» ячейки, поэтому значение из соседней колонки
 * («Значение» = `false`) уезжало в `fields` полем с именем `false` — а `tsc` его пропускал,
 * потому что `false: boolean` в TS легальное имя свойства.
 */
const NON_FIELD_LITERALS = new Set([
  'true',
  'false',
  'null',
  'undefined',
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'date',
]);

/**
 * Похоже ли значение ячейки на ключ поля.
 *
 * Точки разрешены, и это не послабление, а исправление: в спеках проекта составными путями
 * записаны целые разделы формы — `personalData.lastName`, `passportData.series`. Прежний
 * бездотный шаблон отвергал такую строку в разборе по шапке, позиционная ветка camelCase-ячейки
 * в ней тоже не находила, и строка ПРОПАДАЛА молча. На кредитной спеке так терялось 17 полей —
 * паспорт и персональные данные целиком. При этом `extractFieldKeyFromTrBlock`, который питает
 * списки условных и вычисляемых полей, точки допускал всегда: эти списки ссылались на поля,
 * которых в `fields` не было.
 *
 * Ограничение на длину прежнее: односимвольная ячейка — это номер или пометка, а не ключ.
 */
function isFieldKey(cell: string): boolean {
  if (NON_FIELD_LITERALS.has(cell.toLowerCase())) return false;
  return /^[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)*$/.test(cell) && cell.length > 1;
}

function extractFieldKeyFromTrBlock(trBlock: string): string | null {
  for (const m of trBlock.matchAll(/<td[^>]*>([^<]+)<\/td>/g)) {
    const cell = m[1].trim();
    if (/^[a-z][a-zA-Z0-9.]*$/.test(cell) && cell.length > 1 && cell.length < 50) return cell;
  }
  return null;
}

export function extractConditionalFields(content: string): string[] {
  const patterns: string[] = [];
  for (const block of content.match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
    if (
      /условн|только если|показ(ыв)?ается если|показ(ыв)?ать если|появля?ется если|зависит от|появ.{1,30}при\s+|if\s+\w+\s*[=!]|when\s+\w+/i.test(
        block
      )
    ) {
      const key = extractFieldKeyFromTrBlock(block);
      if (key && !patterns.includes(key)) patterns.push(key);
    }
  }
  if (patterns.length === 0) {
    for (const line of content.split('\n')) {
      if (
        /условн|только если|показывается если|зависит от|appears? when|if\s+\w+\s*[=!]/i.test(line)
      ) {
        const cellMatch = line.match(/^\|\s*([\w.]+)\s*\|/);
        if (cellMatch && !patterns.includes(cellMatch[1])) patterns.push(cellMatch[1]);
      }
    }
  }
  return patterns.slice(0, 30);
}

export function extractComputedFields(content: string): string[] {
  const patterns: string[] = [];
  for (const block of content.match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
    if (/Вычисляется автоматически|вычисляемое|computed|readonly|disabled.*автомат/i.test(block)) {
      const key = extractFieldKeyFromTrBlock(block);
      if (key && !patterns.includes(key)) patterns.push(key);
    }
  }
  if (patterns.length === 0) {
    for (const line of content.split('\n')) {
      if (/Вычисляется автоматически|computed|вычисляемое|readonly/i.test(line)) {
        const cellMatch = line.match(/^\|\s*([\w.]+)\s*\|/);
        if (cellMatch && !patterns.includes(cellMatch[1])) patterns.push(cellMatch[1]);
      }
    }
  }
  return patterns.slice(0, 20);
}

/**
 * Ключ поля элемента массива: `properties[].type` — массив `properties`, поле `type`. Путь
 * массива может быть составным (`loan.parties[].name`). Вложенные массивы (`a[].b[].c`) не
 * поддержаны — такая строка уходит в непонятые.
 */
const ARRAY_ITEM_KEY = /^([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)*)\[\]\.([a-z][a-zA-Z0-9]*)$/;

/**
 * Упоминание массива в прозе. Граница слова для кириллицы — `(?<!\p{L})` с флагом `u`: `\b`
 * в JS считается по латинице, и `\bмассив` в обычном тексте («это массив телефонов») не
 * совпадал никогда.
 */
const MENTIONS_ARRAY = /(?<!\p{L})массив|\barray\b|\b(?:Form|Field)Array\b/iu;

/** Подсказка вместо имени, когда массив упомянут, но строк его элемента в спеке нет. */
export const ARRAY_HINT = '(см. секцию массивов в спеке)';

/**
 * Имена массивов спеки — по ключам строк элемента (`properties[].type`).
 *
 * Раньше здесь стоял список имён из кредитной спеки (`properties`, `existingLoans`, …), причём
 * вперемешку с флажками, которые массивы только показывают (`hasProperty`): любая другая спека
 * получала либо пустой список, либо флажок под видом массива.
 */
export function extractArrays(content: string): string[] {
  const names: string[] = [];
  for (const m of content.matchAll(/\b([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)*)\[\]\.[a-z]/g)) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  if (names.length === 0 && MENTIONS_ARRAY.test(content)) names.push(ARRAY_HINT);
  return names;
}

export function extractApiEndpoints(content: string): string[] {
  const patterns: string[] = [];
  for (const m of content.match(/(?:GET|POST|PUT|DELETE|PATCH)\s+\/[\w/\-{}:]+/gi) ?? []) {
    if (!patterns.includes(m)) patterns.push(m);
  }
  return patterns.slice(0, 15);
}

// ---------------------------------------------------------------------------
// Разбор по колонкам
//
// Спеки репозитория используют одну и ту же шапку таблицы (`Ключ в форме`, `Тип поля`,
// `Значение`, `Валидация`, …). Пока читались только идентификаторы полей, а тип угадывался
// по имени — при том, что он написан в соседней ячейке. Ниже — чтение того, что в спеке уже
// есть; угадывание остаётся фолбэком для таблиц без шапки.
// ---------------------------------------------------------------------------

/** Нормализация заголовка: регистр и пробелы в шапках гуляют от спеки к спеке. */
function normalizeHeader(cell: string): string {
  return cell
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Карта «заголовок → индекс колонки» по строке `<th>`. `null`, если шапки нет —
 * тогда вызывающий код обязан остаться на позиционной эвристике.
 */
export function parseHeaderMap(table: string): Record<string, number> | null {
  const headerRow = table.match(/<tr\b[^>]*>(?:(?!<\/tr>)[\s\S])*?<th[\s\S]*?<\/tr>/);
  if (!headerRow) return null;
  const cells = [...headerRow[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) =>
    normalizeHeader(m[1])
  );
  if (cells.length === 0) return null;
  const map: Record<string, number> = {};
  cells.forEach((c, i) => {
    // Первое вхождение выигрывает: повтор заголовка — дефект спеки, но ломаться на нём нечем.
    if (c && !(c in map)) map[c] = i;
  });
  return map;
}

/** Значение ячейки по любому из синонимов заголовка. */
function cellByHeader(
  cells: string[],
  headers: Record<string, number>,
  names: string[]
): string | undefined {
  for (const n of names) {
    const idx = headers[n];
    if (idx !== undefined && idx < cells.length) return cells[idx];
  }
  return undefined;
}

/** `Input[number]` → number/Input, `Select` → string/Select. `null`, если ячейка не опознана. */
export function parseTypeCell(cell: string): { type: FieldType; component: string } | null {
  const raw = cell.replace(/<[^>]+>/g, '').trim();
  if (!raw) return null;

  // Без якоря в конце: в спеках за скобкой встречаются пометки («Input[number] readonly»,
  // «Input[number] — вычисляемое»). С якорем такая ячейка не матчилась вовсе и уходила в
  // фолбэк по имени компонента, где Input значит string — поэтому ВСЕ вычисляемые числовые
  // поля приезжали строками.
  const bracket = raw.match(/^([A-Za-z]+)\s*\[\s*([A-Za-z]+)\s*\]/);
  const component = (bracket ? bracket[1] : raw.match(/^([A-Za-z]+)/)?.[1]) ?? '';
  const hint = bracket?.[2]?.toLowerCase();

  const byComponent: Record<string, FieldType> = {
    Input: 'string',
    InputNumber: 'number',
    InputSuggest: 'string',
    Textarea: 'string',
    InputMask: 'string',
    InputPassword: 'string',
    Select: 'string',
    Combobox: 'string',
    RadioGroup: 'string',
    NativeSelect: 'string',
    ToggleGroup: 'string',
    InputOTP: 'string',
    Slider: 'number',
    Checkbox: 'boolean',
    Switch: 'boolean',
    Toggle: 'boolean',
    DatePicker: 'date',
    Calendar: 'date',
    FieldArray: 'array',
    // Прежнее имя компонента: спека — внешний документ и может называть массив по-старому.
    FormArray: 'array',
  };
  if (!(component in byComponent)) return null;

  const byHint: Record<string, FieldType> = {
    number: 'number',
    string: 'string',
    boolean: 'boolean',
    date: 'date',
    text: 'string',
  };
  const type = (hint && byHint[hint]) || byComponent[component];
  // `Input[number]` — запись спеки времён диспетчера `InputField`. Числа теперь рисует отдельный
  // `InputNumber`: у `Input` пропа `type: 'number'` больше нет.
  return {
    type,
    component: component === 'Input' && type === 'number' ? 'InputNumber' : component,
  };
}

/**
 * Начальное значение из колонки «Значение».
 *
 * `null` возвращается ЗНАЧАЩИМ: в ReFormer пустое число — штатное состояние (`min` и прочие
 * валидаторы пропускают `null`, обязательность даёт `required()`). Поэтому отличать «в спеке
 * написан null» от «колонки нет» обязательно — иначе поле молча получит `0`, которое ведёт
 * себя иначе.
 */
export function parseInitialCell(cell: string | undefined, type: FieldType): unknown {
  if (cell === undefined) return undefined;
  const raw = cell.replace(/<[^>]+>/g, '').trim();
  if (!raw || raw === '-' || raw === '—') return undefined;
  if (raw === 'null') return null;
  if (raw === 'undefined') return undefined;
  if (raw === 'true' || raw === 'false') return raw === 'true';
  if (raw === '[]') return [];
  if (raw === '{}') return {};

  const quoted = raw.match(/^['"`](.*)['"`]$/);
  if (quoted) return quoted[1];

  if (type === 'number' && /^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (/^-?\d+(\.\d+)?$/.test(raw)) return type === 'string' ? raw : Number(raw);
  return undefined;
}

/** Валидаторы без аргумента: слово в ячейке → вызов. */
const FLAG_VALIDATORS: Array<[RegExp, string]> = [
  [/обязательн\w*|\brequired\b/i, 'required()'],
  [/\bemail\b|электронн\w*\s+почт/i, 'email()'],
];

/** Валидаторы с одним числовым аргументом: `minLength: 2` → `minLength(2)`. */
const ARG_VALIDATORS = ['minLength', 'maxLength', 'min', 'max'] as const;

/**
 * Колонка «Валидация» → правила, условие и нераспознанный остаток.
 *
 * Нераспознанное НЕ отбрасывается. `min: 20% от стоимости` — настоящее требование спеки,
 * которое мы не умеем выразить; молча его потерять значило бы выдать неполную форму за полную.
 */
export function parseValidationCell(cell: string | undefined): {
  rules: string[];
  when?: string;
  unparsed: string[];
} {
  const raw = (cell ?? '').replace(/<[^>]+>/g, '').trim();
  // Прочерк — принятый в спеках способ написать «правил нет», а не нераспознанное правило.
  if (!raw || /^[-–—]$|^(нет|н\/д|n\/a|none)$/i.test(raw)) return { rules: [], unparsed: [] };

  const rules: string[] = [];
  const unparsed: string[] = [];
  let when: string | undefined;

  // «Условное (при loanType='mortgage')» — вырезается до разбиения, внутри есть запятые.
  // `\S*`, а не `\w*`: `\w` в JS — только латиница, и на «Условное» разбор обрывался
  // после «Условн», не доходя до скобки. Кириллические спеки — основной случай.
  const cond = raw.match(
    /условн\S*\s*\(\s*(?:при|если|when)\s+([A-Za-z_$][\w$.]*)\s*=+\s*['"`]?([^'"`)]+)['"`]?\s*\)/i
  );
  let rest = raw;
  if (cond) {
    const [full, field, value] = cond;
    const literal = /^-?\d+(\.\d+)?$/.test(value.trim())
      ? value.trim()
      : `'${value.trim().replace(/'/g, "\\'")}'`;
    when = `model.${field} === ${literal}`;
    rest = raw.replace(full, '');
  }

  for (const chunkRaw of rest.split(/[,;]/)) {
    const chunk = chunkRaw.trim();
    if (!chunk) continue;

    // «Необязательное» содержит «обязательн» подстрокой, а `\b` в JS работает только по
    // латинице (`\w` кириллицу не включает) — без явного отрицания спека с колонкой
    // «Необязательное» превращалась в `required()`. Это худший класс ошибки разбора:
    // не потеря данных, а сочинение — форма начинала требовать поля, которых спека не требует.
    if (/необязательн|не\s+обязательн|опционал|optional/i.test(chunk)) continue;

    const flag = FLAG_VALIDATORS.find(([re]) => re.test(chunk));
    // Условие уже вырезано, поэтому здесь безопасно: `Условное` не спутается с `required`.
    if (flag && !/[:=]/.test(chunk)) {
      if (!rules.includes(flag[1])) rules.push(flag[1]);
      continue;
    }

    const arg = ARG_VALIDATORS.find((n) => new RegExp(`^${n}\\s*[:=]`, 'i').test(chunk));
    if (arg) {
      const value = chunk.split(/[:=]/).slice(1).join(':').trim();
      if (/^-?\d+(\.\d+)?$/.test(value)) {
        rules.push(`${arg}(${value})`);
      } else {
        // «min: 20% от стоимости» — требование есть, выразить нечем.
        unparsed.push(chunk);
      }
      continue;
    }

    if (flag) {
      if (!rules.includes(flag[1])) rules.push(flag[1]);
      continue;
    }
    unparsed.push(chunk);
  }

  return { rules, when, unparsed };
}

/** Тип и компонент по имени поля и его описанию — грубая, но полезная эвристика. */
function guessField(name: string, note: string): { type: FieldType; component: string } {
  const hay = `${name} ${note}`.toLowerCase();
  if (/дата|date|birth|рожден/.test(hay)) return { type: 'date', component: 'DatePicker' };
  if (/сумм|amount|цена|price|количеств|count|срок|term|доход|income|\bчисл/.test(hay)) {
    return { type: 'number', component: 'InputNumber' };
  }
  if (/да\/нет|чекбокс|checkbox|флаг|согласи|есть ли/.test(hay)) {
    return { type: 'boolean', component: 'Checkbox' };
  }
  if (/выбор|select|список|dropdown|справочник/.test(hay)) {
    return { type: 'string', component: 'Select' };
  }
  if (/пароль|password/.test(hay)) return { type: 'string', component: 'InputPassword' };
  if (/маск|mask|телефон|phone|снилс|инн|паспорт/.test(hay)) {
    return { type: 'string', component: 'InputMask' };
  }
  return { type: 'string', component: 'Input' };
}

/**
 * Поля из табличных строк спеки. Ключом считается ячейка, похожая на идентификатор
 * (`camelCase` латиницей), меткой — первая содержательная ячейка рядом.
 */
/**
 * Потолок числа полей — защита от разбора мусора, а не свойство формата.
 *
 * Прежние 60 были меньше реальных спек проекта: страховая даёт 121 поле, кредитная 68, то есть
 * обрезалась половина формы — и обрезалась молча. Полученная форма выглядела разобранной. Порог
 * поднят до величины, за которой начинается уже не форма, а ошибка разбора; сам факт обрезки
 * теперь виден в предупреждениях.
 */
export const MAX_FIELDS = 200;

/**
 * Строки таблиц, из которых не вышло поля.
 *
 * Универсальная сеть под любой неизвестный синтаксис. Предыдущий раз этот класс бага чинили
 * частным случаем (точки в именах — тогда молча терялось 17 полей), и он вернулся со
 * скобками массивов: разбор снова промолчал. Пока «строка выпала» не попадает в ответ,
 * консумент не отличает «в спеке этого нет» от «разбор не понял».
 */
/** Синонимы колонок шапки. */
const KEY_COLUMN = ['ключ в форме', 'ключ', 'field', 'key'];
const TYPE_COLUMN = ['тип поля', 'тип', 'type'];
const LABEL_COLUMN = ['название поля', 'название', 'label'];
const VALUE_COLUMN = ['значение', 'value', 'default'];
const VALIDATION_COLUMN = ['валидация', 'validation'];
const SECTION_COLUMN = ['раздел', 'section'];

/** Таблица спеки: шапка (если есть) и строки данных с их позицией в документе. */
interface SpecTable {
  /** Шапка таблицы; `null` — таблица без шапки. */
  headers: Record<string, number> | null;
  /** Таблица в markdown — у неё нет позиционного фолбэка (см. `readTables`). */
  markdown: boolean;
  rows: Array<{ offset: number; cells: string[] }>;
}

/** Ячейки строки `<tr>` без разметки; у строки шапки (`<th>`) их нет. */
function htmlCells(row: string): string[] {
  return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim()
  );
}

/** Строки `<tr>` фрагмента; `base` — позиция фрагмента в документе. */
function htmlRows(fragment: string, base: number): SpecTable['rows'] {
  const rows: SpecTable['rows'] = [];
  for (const m of fragment.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)) {
    const cells = htmlCells(m[0]);
    if (cells.length > 0) rows.push({ offset: base + (m.index ?? 0), cells });
  }
  return rows;
}

/** Ячейки строки markdown-таблицы: `| a | `b` |` → `['a', 'b']`. */
function markdownCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim().replace(/^`(.*)`$/, '$1'));
}

/** Разделитель шапки markdown-таблицы: `|---|:--:|`. */
const MD_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const MD_ROW = /^\s*\|.*\|\s*$/;

/** Markdown-таблицы со шапкой: строка заголовков, разделитель, строки данных. */
function markdownTables(content: string): SpecTable[] {
  const tables: SpecTable[] = [];
  const lines = content.split('\n');
  const offsets: number[] = [];
  let pos = 0;
  for (const line of lines) {
    offsets.push(pos);
    pos += line.length + 1;
  }
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!MD_ROW.test(lines[i]) || !MD_SEPARATOR.test(lines[i + 1])) continue;
    const headers: Record<string, number> = {};
    markdownCells(lines[i]).forEach((c, idx) => {
      const name = normalizeHeader(c);
      if (name && !(name in headers)) headers[name] = idx;
    });
    const rows: SpecTable['rows'] = [];
    let j = i + 2;
    for (; j < lines.length && MD_ROW.test(lines[j]); j++) {
      rows.push({ offset: offsets[j], cells: markdownCells(lines[j]) });
    }
    tables.push({ headers, markdown: true, rows });
    i = j - 1;
  }
  return tables;
}

/**
 * Таблицы спеки в порядке документа.
 *
 * Шапка — у каждой таблицы своя. Раньше бралась шапка первой таблицы документа на все: спека,
 * где колонки у шагов разные или первая таблица вовсе не про поля, читалась чужой шапкой. Таблица
 * без шапки наследует шапку предыдущей — так пишут продолжение таблицы шага.
 */
function readTables(content: string): SpecTable[] {
  const tables: Array<SpecTable & { offset: number }> = [];
  for (const m of content.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    const base = m.index ?? 0;
    tables.push({
      offset: base,
      headers: parseHeaderMap(m[0]),
      markdown: false,
      rows: htmlRows(m[0], base),
    });
  }
  // Фрагмент из одних строк `<tr>` без обёртки `<table>` — так спеку передают описанием.
  if (tables.length === 0 && /<tr\b/.test(content)) {
    tables.push({
      offset: 0,
      headers: parseHeaderMap(content),
      markdown: false,
      rows: htmlRows(content, 0),
    });
  }
  for (const t of markdownTables(content)) tables.push({ ...t, offset: t.rows[0]?.offset ?? 0 });
  tables.sort((a, b) => a.offset - b.offset);

  let inherited: Record<string, number> | null = null;
  return tables.map((t) => {
    const headers: Record<string, number> | null = t.headers ?? (t.markdown ? null : inherited);
    if (t.headers && !t.markdown) inherited = t.headers;
    return { headers, markdown: t.markdown, rows: t.rows };
  });
}

/** Есть ли у шапки колонка ключа поля. */
function hasKeyColumn(headers: Record<string, number> | null): boolean {
  return headers !== null && KEY_COLUMN.some((n) => n in headers);
}

/** Поля и массивы спеки — результат `extractEntries`. */
export interface SpecEntries {
  fields: SpecField[];
  arrays: SpecArray[];
  order: SpecEntry[];
}

/**
 * Поля и массивы из табличных строк спеки.
 *
 * По шапке читаются ключ, тип, подпись, начальное значение и правила. Без шапки ключом считается
 * ячейка, похожая на идентификатор (`camelCase` латиницей), подписью — первая содержательная
 * ячейка рядом. Строки элемента массива (`properties[].type`) собираются в массив со своими
 * полями; строка с ключом самого массива объявляет его. Каждая строка знает свой шаг — по
 * последнему заголовку `### Шаг N` над ней.
 */
export function extractEntries(content: string, dropped?: string[]): SpecEntries {
  const fields: SpecField[] = [];
  const arrays = new Map<string, SpecArray>();
  const order: SpecEntry[] = [];
  const seen = new Set<string>();
  const steps = stepHeadings(content);
  const stepAt = (offset: number) => steps.filter((s) => s.offset <= offset).pop()?.number;

  const build = (
    name: string,
    note: string,
    label: string | undefined,
    step: number | undefined,
    extra?: Partial<SpecField>
  ): SpecField => {
    const guessed = guessField(name, note);
    return {
      name,
      type: extra?.type ?? guessed.type,
      component: extra?.component ?? guessed.component,
      label: label?.trim() || undefined,
      initialValue: extra?.initialValue,
      rules: extra?.rules ?? [],
      when: extra?.when,
      unparsedRules: extra?.unparsedRules ?? [],
      ...(step !== undefined ? { step } : {}),
    };
  };

  const arrayOf = (name: string, step: number | undefined): SpecArray => {
    let array = arrays.get(name);
    if (!array) {
      array = { name, ...(step !== undefined ? { step } : {}), itemFields: [] };
      arrays.set(name, array);
      order.push({ kind: 'array', name });
    }
    return array;
  };

  const pushField = (field: SpecField) => {
    if (seen.has(field.name) || arrays.has(field.name)) return;
    seen.add(field.name);
    fields.push(field);
    order.push({ kind: 'field', name: field.name });
  };

  const pushItem = (arrayName: string, field: SpecField, section?: string) => {
    const array = arrayOf(arrayName, field.step);
    if (!array.label && section) array.label = section;
    if (array.itemFields.some((f) => f.name === field.name)) return;
    const { step: _step, ...item } = field;
    void _step;
    array.itemFields.push(item);
  };

  const drop = (cells: string[]) => {
    if (cells.some(Boolean)) dropped?.push(cells.filter(Boolean).slice(0, 3).join(' | '));
  };

  for (const table of readTables(content)) {
    const headers = table.headers;
    // Markdown-таблица без колонки ключа — не таблица полей (строки, сценарии, API): позиционный
    // фолбэк выдумывал бы поля из любой латинской ячейки. Она читается, только если иначе
    // полей нет вовсе (см. ниже).
    if (table.markdown && !hasKeyColumn(headers)) continue;

    for (const { offset, cells } of table.rows) {
      const step = stepAt(offset);

      if (headers && hasKeyColumn(headers)) {
        const key = cellByHeader(cells, headers, KEY_COLUMN);
        const typeCell = cellByHeader(cells, headers, TYPE_COLUMN);
        const label = cellByHeader(cells, headers, LABEL_COLUMN);
        // Догадка о типе — только по подписи и ячейке типа. Вся строка (с подсказкой и
        // примечанием) уводила её: «0» в подсказке или «доход» в примечании делали число из
        // строки.
        const note = `${label ?? ''} ${typeCell ?? ''}`;
        const parsedType = typeCell ? parseTypeCell(typeCell) : null;
        // Группа полей (`GroupNode`) — не лист: её поля в спеке не перечислены, и догадка по
        // имени выдумала бы строковое поле на месте целого раздела.
        if (key && typeCell && /^\s*Group(?:Node)?\b/i.test(typeCell)) {
          drop(cells);
          continue;
        }
        const read = (name: string) => {
          const type = parsedType?.type ?? guessField(name, note).type;
          const validation = parseValidationCell(cellByHeader(cells, headers, VALIDATION_COLUMN));
          return build(name, note, label, step, {
            type,
            component: parsedType?.component,
            initialValue: parseInitialCell(cellByHeader(cells, headers, VALUE_COLUMN), type),
            rules: validation.rules,
            when: validation.when,
            unparsedRules: validation.unparsed,
          });
        };

        const item = key?.match(ARRAY_ITEM_KEY);
        if (item) {
          pushItem(item[1], read(item[2]), cellByHeader(cells, headers, SECTION_COLUMN));
          continue;
        }
        if (key && isFieldKey(key)) {
          if (parsedType?.type === 'array') {
            // Строка самого массива: объявляет его и даёт подпись, полем модели не становится.
            const array = arrayOf(key, step);
            if (label?.trim()) array.label = label.trim();
            continue;
          }
          pushField(read(key));
          continue;
        }
        // Ключевая ячейка заполнена, но ключом не является — синтаксис нам незнаком. Позиционный
        // фолбэк здесь опасен: он ищет первую похожую на ключ ячейку по всей строке и находит
        // значение соседней колонки. Честнее выпасть в dropped, чем выдумать поле.
        if (key) {
          drop(cells);
          continue;
        }
      }

      // Позиционный фолбэк — таблица без колонки ключа.
      const itemCell = cells.find((c) => ARRAY_ITEM_KEY.test(c));
      const key = itemCell ?? cells.find(isFieldKey);
      if (!key) {
        drop(cells);
        continue;
      }
      const label = cells.find((c) => c !== key && /[А-Яа-яA-Za-z]{3,}/.test(c));
      const typed = cells.map(parseTypeCell).find((t) => t !== null) ?? undefined;
      const note = label ?? '';
      const item = itemCell?.match(ARRAY_ITEM_KEY);
      if (item) {
        pushItem(item[1], build(item[2], note, label, step, typed));
        continue;
      }
      pushField(build(key, note, label, step, typed));
    }
  }

  if (fields.length === 0 && arrays.size === 0) {
    // Последний шанс: markdown-таблица без шапки ключа — ключ в первой колонке.
    for (const line of content.split('\n')) {
      const m = line.match(/^\|\s*`?([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)*)`?\s*\|([^|]*)\|/);
      if (m && isFieldKey(m[1])) pushField(build(m[1], m[2], m[2], undefined));
    }
  }

  const kept = fields.slice(0, MAX_FIELDS);
  const keptNames = new Set(kept.map((f) => f.name));
  return {
    fields: kept,
    arrays: [...arrays.values()],
    order: order.filter((e) => e.kind === 'array' || keptNames.has(e.name)),
  };
}

/** Поля спеки — `extractEntries` без массивов. */
export function extractFields(content: string, dropped?: string[]): SpecField[] {
  return extractEntries(content, dropped).fields;
}

export function analyzeSpec(content: string): SpecAnalysis {
  const fieldsPerStep = countFieldsPerStep(content);
  const droppedRows: string[] = [];
  const { fields, arrays: arrayDefs, order } = extractEntries(content, droppedRows);
  const warnings: string[] = [];

  if (droppedRows.length > 0) {
    // Не «сколько нашли», а «сколько не поняли»: без этой строки неполный разбор выглядит
    // полным. Примеры даём дословно — по ним видно, какой синтаксис не поддержан.
    const sample = droppedRows
      .slice(0, 3)
      .map((r) => `«${r}»`)
      .join(', ');
    warnings.push(
      `Строк таблиц, из которых не удалось получить поле: ${droppedRows.length}` +
        `${sample ? ` (например ${sample})` : ''}. ` +
        'Обычно это неподдержанный синтаксис ключа — например вложенный массив ' +
        '`items[].rows[].field`. Проверьте их и допишите недостающее в `fields`/`arrays` вручную.'
    );
  }

  if (fields.length === 0 && arrayDefs.length === 0) {
    warnings.push(
      'Полей в спеке распознать не удалось — заполните `fields` в intent вручную. ' +
        'Разбор рассчитан на таблицы с колонкой-идентификатором поля.'
    );
  }
  if (fields.length === MAX_FIELDS) {
    // Ровно потолок — почти наверняка обрезка. Сказать об этом обязательно: иначе форма
    // выглядит разобранной целиком, а недостающие поля обнаружит только пользователь.
    warnings.push(
      `Полей ровно ${MAX_FIELDS} — это потолок разбора, часть могла быть отброшена. ` +
        'Проверьте конец спеки и допишите недостающее в `fields`.'
    );
  }
  if (!/## Canonical user-facing strings/i.test(content)) {
    warnings.push(
      'В спеке нет таблицы канонических строк — метки полей взяты из описаний и могут отличаться от требуемых.'
    );
  }
  // Требование, которое мы прочли, но выразить не смогли, обязано быть видно: молчание здесь
  // означало бы «правил больше нет», а это не так.
  const withItems = [
    ...fields.map((f) => ({ path: f.name, field: f })),
    ...arrayDefs.flatMap((a) =>
      a.itemFields.map((f) => ({ path: `${a.name}[].${f.name}`, field: f }))
    ),
  ];
  for (const { path, field } of withItems) {
    for (const chunk of field.unparsedRules) {
      // Формулировка нейтральная сознательно: в этой колонке встречаются и правила, которые
      // нечем выразить (`min: 20% от стоимости`), и вовсе не правила (`mask: '+7 (999)…'`).
      // Совет «допишите валидатор» был бы для второго случая прямо неверным.
      warnings.push(
        `Поле \`${path}\`: фрагмент «${chunk}» не разобран как правило валидации — перенесите его в intent вручную.`
      );
    }
  }

  // Имена разобранных массивов, затем упомянутые ключом `имя[].поле` где-то ещё в тексте.
  // Подсказка «см. секцию массивов» нужна, только когда имени нет ни одного: массив, объявленный
  // одной строкой `FieldArray` без строк элемента, её иначе бы получил.
  const named = [...new Set([...arrayDefs.map((a) => a.name), ...extractArrays(content)])];
  const arrays = named.length > 1 ? named.filter((n) => n !== ARRAY_HINT) : named;

  return {
    formName: extractFormName(content),
    steps: countSteps(content),
    stepList: extractSteps(content),
    fieldsPerStep,
    fields,
    arrayDefs,
    order,
    conditionalFields: extractConditionalFields(content),
    computedFields: extractComputedFields(content),
    arrays,
    apiEndpoints: extractApiEndpoints(content),
    hasCanonicalLabels: /## Canonical user-facing strings/i.test(content),
    hasMasks: /InputMask|маска|mask:\s*['"`]/.test(content),
    warnings,
  };
}
