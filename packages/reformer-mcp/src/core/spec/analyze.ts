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
}

export interface SpecAnalysis {
  formName: string;
  steps: number;
  fieldsPerStep: Record<string, number>;
  fields: SpecField[];
  conditionalFields: string[];
  computedFields: string[];
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

export function countFieldsPerStep(content: string): Record<string, number> {
  const result: Record<string, number> = {};
  const stepRegex = /^###\s+(?:Шаг|Step)\s+(\d+)[:.]\s*([^\n]*)/gim;
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

export function extractArrays(content: string): string[] {
  const patterns: string[] = [];
  const matches = content.match(
    /\b(?:hasProperty|hasExistingLoans|hasCoBorrower|properties|existingLoans|coBorrowers)\b/g
  );
  for (const m of matches ?? []) if (!patterns.includes(m)) patterns.push(m);
  if (patterns.length === 0 && /\bмассив|\barray|\bFormArray\b/i.test(content)) {
    patterns.push('(см. секцию массивов в спеке)');
  }
  return patterns;
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
  const headerRow = table.match(/<tr>[\s\S]*?<th[\s\S]*?<\/tr>/);
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

  const bracket = raw.match(/^([A-Za-z]+)\s*\[\s*([A-Za-z]+)\s*\]$/);
  const component = (bracket ? bracket[1] : raw.match(/^([A-Za-z]+)/)?.[1]) ?? '';
  const hint = bracket?.[2]?.toLowerCase();

  const byComponent: Record<string, FieldType> = {
    Input: 'string',
    Textarea: 'string',
    InputMask: 'string',
    InputPassword: 'string',
    Select: 'string',
    Combobox: 'string',
    RadioGroup: 'string',
    Checkbox: 'boolean',
    Switch: 'boolean',
    DatePicker: 'date',
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
  return { type: (hint && byHint[hint]) || byComponent[component], component };
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
    return { type: 'number', component: 'Input' };
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
export function extractFields(content: string): SpecField[] {
  const fields: SpecField[] = [];
  const seen = new Set<string>();

  const push = (name: string, note: string, label?: string, extra?: Partial<SpecField>) => {
    if (seen.has(name)) return;
    seen.add(name);
    const guessed = guessField(name, note);
    fields.push({
      name,
      type: extra?.type ?? guessed.type,
      component: extra?.component ?? guessed.component,
      label: label?.trim() || undefined,
      initialValue: extra?.initialValue,
      rules: extra?.rules ?? [],
      when: extra?.when,
      unparsedRules: extra?.unparsedRules ?? [],
    });
  };

  // Шапка ищется по всему документу: в спеке несколько таблиц (по одной на шаг), колонки у
  // них одинаковые. Первой достаточно.
  const headers = parseHeaderMap(content);

  for (const block of content.match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
    const cells = [...block.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, '').trim()
    );

    if (headers) {
      const key = cellByHeader(cells, headers, ['ключ в форме', 'ключ', 'field', 'key']);
      // Ячейка может оказаться пустой или нести не идентификатор (строка-разделитель) —
      // тогда падаем на общий путь ниже, а не пропускаем строку целиком.
      if (key && /^[a-z][a-zA-Z0-9]*$/.test(key) && key.length > 1) {
        const typeCell = cellByHeader(cells, headers, ['тип поля', 'тип', 'type']);
        const parsedType = typeCell ? parseTypeCell(typeCell) : null;
        const type = parsedType?.type ?? guessField(key, cells.join(' ')).type;
        const validation = parseValidationCell(
          cellByHeader(cells, headers, ['валидация', 'validation'])
        );
        push(
          key,
          cells.join(' '),
          cellByHeader(cells, headers, ['название поля', 'название', 'label']),
          {
            type,
            component: parsedType?.component,
            initialValue: parseInitialCell(
              cellByHeader(cells, headers, ['значение', 'value', 'default']),
              type
            ),
            rules: validation.rules,
            when: validation.when,
            unparsedRules: validation.unparsed,
          }
        );
        continue;
      }
    }

    const key = cells.find((c) => /^[a-z][a-zA-Z0-9]*$/.test(c) && c.length > 1);
    if (!key) continue;
    const label = cells.find((c) => c !== key && /[А-Яа-яA-Za-z]{3,}/.test(c));
    push(key, cells.join(' '), label);
  }

  if (fields.length === 0) {
    for (const line of content.split('\n')) {
      const m = line.match(/^\|\s*`?([a-z][a-zA-Z0-9]*)`?\s*\|([^|]*)\|/);
      if (m) push(m[1], line, m[2]);
    }
  }
  return fields.slice(0, 60);
}

export function analyzeSpec(content: string): SpecAnalysis {
  const fieldsPerStep = countFieldsPerStep(content);
  const fields = extractFields(content);
  const warnings: string[] = [];

  if (fields.length === 0) {
    warnings.push(
      'Полей в спеке распознать не удалось — заполните `fields` в intent вручную. ' +
        'Разбор рассчитан на таблицы с колонкой-идентификатором поля.'
    );
  }
  if (!/## Canonical user-facing strings/i.test(content)) {
    warnings.push(
      'В спеке нет таблицы канонических строк — метки полей взяты из описаний и могут отличаться от требуемых.'
    );
  }
  // Требование, которое мы прочли, но выразить не смогли, обязано быть видно: молчание здесь
  // означало бы «правил больше нет», а это не так.
  for (const f of fields) {
    for (const chunk of f.unparsedRules) {
      // Формулировка нейтральная сознательно: в этой колонке встречаются и правила, которые
      // нечем выразить (`min: 20% от стоимости`), и вовсе не правила (`mask: '+7 (999)…'`).
      // Совет «допишите валидатор» был бы для второго случая прямо неверным.
      warnings.push(
        `Поле \`${f.name}\`: фрагмент «${chunk}» не разобран как правило валидации — перенесите его в intent вручную.`
      );
    }
  }

  return {
    formName: extractFormName(content),
    steps: countSteps(content),
    fieldsPerStep,
    fields,
    conditionalFields: extractConditionalFields(content),
    computedFields: extractComputedFields(content),
    arrays: extractArrays(content),
    apiEndpoints: extractApiEndpoints(content),
    hasCanonicalLabels: /## Canonical user-facing strings/i.test(content),
    hasMasks: /InputMask|маска|mask:\s*['"`]/.test(content),
    warnings,
  };
}
