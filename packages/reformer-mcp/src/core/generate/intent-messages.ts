/**
 * Тексты чтения intent: что за запись, какие у неё ключи и как она выглядит.
 *
 * Тексты читает модель, поэтому они английские (аудит 2026-11: тексты для модели — английские,
 * тексты формы — на языке пользователя). Стабилен код проблемы, текст может меняться: потребитель со
 * своим языком выбирает по коду.
 *
 * Ключи записей перечислены здесь, а не выводятся из чтения: подсказка «unknown key» называет канон,
 * а синонимы, которые чтение тоже принимает, в ней были бы шумом.
 *
 * @module reformer-mcp/core/generate/intent-messages
 */

/** Вид записи intent — то, о чём говорит проблема. */
export type IntentRecordKind =
  | 'intent'
  | 'field'
  | 'array'
  | 'rule'
  | 'behavior'
  | 'node-rule'
  | 'visibility'
  | 'data-source'
  | 'step'
  | 'wizard'
  | 'operator'
  | 'field-node'
  | 'array-node'
  | 'part-node'
  | 'container-node'
  | 'step-node'
  | 'text-node';

interface RecordText {
  /** Как запись называется в тексте: «a field». */
  readonly label: string;
  /** Канонические ключи записи. */
  readonly keys: readonly string[];
  /** Образец записи — для «ожидается». */
  readonly sample: string;
}

export const INTENT_RECORDS: Readonly<Record<IntentRecordKind, RecordText>> = {
  intent: {
    label: 'the intent',
    keys: [
      'formName',
      'interfaceName',
      'target',
      'fields',
      'arrays',
      'parts',
      'layoutRoot',
      'steps',
      'validation',
      'behavior',
      'visibility',
      'dataSources',
      'operators',
    ],
    sample:
      '{ "formName": "Sign-up", "target": "renderer-react", "fields": [ … ], "layoutRoot": { … } }',
  },
  field: {
    label: 'a field',
    keys: [
      'name',
      'type',
      'component',
      'label',
      'initialValue',
      'optionsSource',
      'suggestionsSource',
      'componentProps',
      'selector',
      'modelPath',
      'required',
    ],
    sample: '{ "name": "lastName", "type": "string", "component": "Input", "label": "Last name" }',
  },
  array: {
    label: 'an array',
    keys: [
      'name',
      'itemInterfaceName',
      'itemFields',
      'initialValue',
      'component',
      'componentProps',
      'label',
      'modelPath',
    ],
    sample: '{ "name": "items", "itemInterfaceName": "OrderItem", "itemFields": [ … ] }',
  },
  rule: {
    label: 'a validation rule',
    keys: [
      'target',
      'rules',
      'cross',
      'async',
      'call',
      'when',
      'each',
      'code',
      'message',
      'severity',
      'params',
    ],
    sample: '{ "target": "price", "rules": ["required()", "min(1)"] }',
  },
  behavior: {
    label: 'a behavior',
    keys: ['kind', 'target', 'sources', 'expr', 'when', 'each', 'options'],
    sample: '{ "kind": "computeFrom", "target": "total", "sources": ["price"], "expr": "…" }',
  },
  'node-rule': {
    label: 'a node rule',
    keys: ['kind', 'selector', 'event', 'expr'],
    sample: '{ "kind": "onMount", "selector": "wizard", "expr": "…" }',
  },
  visibility: {
    label: 'a visibility rule',
    keys: ['selector', 'condition'],
    sample: '{ "selector": "spouseIncome", "condition": "model.married === false" }',
  },
  'data-source': {
    label: 'a data source',
    keys: ['name', 'values', 'note'],
    sample: '{ "name": "CURRENCIES", "values": [{ "value": "usd", "label": "USD" }] }',
  },
  step: {
    label: 'a step',
    keys: ['title', 'icon', 'selector', 'fields'],
    sample: '{ "title": "Personal data", "fields": ["lastName", "firstName"] }',
  },
  wizard: {
    label: 'the wizard',
    keys: ['steps'],
    sample: '{ "steps": [{ "title": "Personal data", "fields": ["lastName"] }] }',
  },
  operator: {
    label: 'an operator',
    keys: ['name', 'from'],
    sample: '{ "operators": { "innChecksum": "./operators" } }',
  },
  'field-node': {
    label: 'a field node',
    keys: ['kind', 'ref'],
    sample: '"lastName" or { "kind": "field", "ref": "lastName" }',
  },
  'array-node': {
    label: 'an array node',
    keys: ['kind', 'ref', 'selector'],
    sample: '{ "kind": "array", "ref": "contacts" }',
  },
  'part-node': {
    label: 'a part node',
    keys: ['kind', 'ref', 'part', 'selector'],
    sample: '{ "kind": "part", "ref": "registrationAddress", "part": "address" }',
  },
  'container-node': {
    label: 'a container node',
    keys: ['kind', 'component', 'componentProps', 'selector', 'htmlTag', 'children'],
    sample: '{ "kind": "container", "component": "Box", "children": [ … ] }',
  },
  'text-node': {
    label: 'a text',
    keys: ['kind', 'text'],
    sample: '{ "text": "Sign in" }',
  },
  'step-node': {
    label: 'a step node',
    keys: ['kind', 'title', 'icon', 'selector', 'children'],
    sample: '{ "kind": "step", "title": "Personal data", "children": ["lastName"] }',
  },
};

/** Ключи записи одной строкой — для «ожидается». */
export function recordKeys(kind: IntentRecordKind): string {
  return `${INTENT_RECORDS[kind].label} takes ${INTENT_RECORDS[kind].keys.join(', ')}`;
}

/**
 * Ближайший допустимый ключ: опечатка, перестановка букв, лишняя или потерянная буква. Дальше
 * подсказка вредна — модель переименует ключ в чужой.
 *
 * @param candidates - Ключ → его канон: подсказка называет канон, а не синоним.
 */
export function nearestKey(key: string, candidates: ReadonlyMap<string, string>): string | null {
  const limit = Math.max(1, Math.floor(key.length / 4));
  let best: { key: string; distance: number } | null = null;
  for (const [candidate, canonical] of candidates) {
    const distance = editDistance(key.toLowerCase(), candidate.toLowerCase());
    if (distance <= limit && (best === null || distance < best.distance)) {
      best = { key: canonical, distance };
    }
  }
  return best?.key ?? null;
}

/** Расстояние Дамерау — Левенштейна (перестановка соседних букв — одна правка). */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}
