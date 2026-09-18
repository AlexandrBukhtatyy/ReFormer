/**
 * Формат схемы демо-стека: плоский список полей, и ничего больше.
 *
 * Формат нарочно другой, чем у `@reformer/renderer-json`: ни операторов (`$model`, `$component`),
 * ни дерева узлов, ни идентификаторов узлов. Стек существует, чтобы доказать швы билдера, — и
 * доказывает их тем честнее, чем меньше его формат похож на формат стека ReFormer.
 *
 * @module @reformer/builder-stack-plain/schema
 */

/** Значение `$schema`, по которому стек узнаёт свой документ. */
export const PLAIN_SCHEMA_ID = 'plain-form/1';

/** Виды полей. Каждый рисуется одним нативным элементом. */
export const PLAIN_FIELD_TYPES = ['text', 'number', 'checkbox', 'select'] as const;

export type PlainFieldType = (typeof PLAIN_FIELD_TYPES)[number];

export interface PlainField {
  /** Имя значения в модели формы. Уникально в пределах формы. */
  readonly name: string;
  /** Подпись для человека. */
  readonly label: string;
  readonly type: PlainFieldType;
  /** Варианты выбора — только у `select`. */
  readonly options?: readonly string[];
}

export interface PlainForm {
  readonly $schema: typeof PLAIN_SCHEMA_ID;
  /** Заголовок формы; необязателен. */
  readonly title?: string;
  readonly fields: readonly PlainField[];
}

/** Значения формы: имя поля → значение. */
export type PlainValues = Readonly<Record<string, string | number | boolean | null>>;
