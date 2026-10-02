/**
 * Свойства выбранного поля формы RJSF — тело панели в правом доке.
 *
 * Панель про свой документ не знает ничего, кроме того, что он на активной вкладке: оболочка
 * отдаёт ей только `panelId`. Поэтому документ она находит сама — по активной вкладке, — а
 * выбранное поле читает из выделения ручки модели: то самое, которое ставит щелчок по строке
 * в структуре и переносят операции (новое поле, переименование).
 *
 * Шапки и прокрутки здесь нет: имя панели и область прокрутки даёт оболочка, одинаково для всех
 * вкладов.
 *
 * Каждая правка — операция ручки модели: отмена снимает её целиком, текст документа
 * перепечатывается сам. Подпись и подсказка правятся на каждое нажатие с ключом схлопывания —
 * в истории это одна запись на поле, а не по букве.
 *
 * @module plugins/rjsf/editor/ui/RjsfInspector
 */

import { useState, type ReactElement } from 'react';
import {
  RJSF_FIELD_TYPES,
  type RjsfFieldSchema,
  type RjsfFieldType,
  type RjsfFieldUi,
  type RjsfForm,
  type RjsfOp,
} from '@/plugins/rjsf/core';
import type { KitsService, ModelDocumentHandle } from '@reformer/builder-plugin-api';
import type { RjsfServices } from '../commands';
import {
  selectedFieldOf,
  useActiveHandle,
  useKitFields,
  useModel,
  useSelection,
  type Translate,
} from './hooks';

const INPUT_CLASS = 'w-full rounded border border-input bg-background px-2 py-1 text-sm';

/** Короткие имена виджетов RJSF, которые имеют смысл для типа поля. */
const RJSF_WIDGET_CHOICES: Readonly<Record<RjsfFieldType, readonly string[]>> = {
  string: ['text', 'textarea', 'password', 'email', 'date', 'color'],
  number: ['updown', 'range', 'text'],
  integer: ['updown', 'range', 'text'],
  boolean: ['checkbox', 'radio', 'select'],
};
/** Поле с вариантами выбирают только списком или переключателями. */
const RJSF_ENUM_WIDGETS: readonly string[] = ['select', 'radio'];

export interface RjsfInspectorProps {
  readonly services: RjsfServices;
  readonly kits: () => KitsService | undefined;
  readonly useTranslate: () => Translate;
}

export function RjsfInspector({ services, kits, useTranslate }: RjsfInspectorProps): ReactElement {
  const t = useTranslate();
  const handle = useActiveHandle(services);
  if (handle === null) return <Hint text={t('inspector.empty')} />;
  // Ключ — документ: черновики полей (имя, варианты) принадлежат полю своего документа.
  return <DocumentInspector key={handle.document.id} handle={handle} kits={kits()} t={t} />;
}

function Hint({ text }: { text: string }): ReactElement {
  return (
    <p className="p-3 text-xs text-muted-foreground" data-testid="rjsf-inspector-empty">
      {text}
    </p>
  );
}

function DocumentInspector(props: {
  handle: ModelDocumentHandle<RjsfForm>;
  kits: KitsService | undefined;
  t: Translate;
}): ReactElement {
  const { handle, kits, t } = props;
  const form = useModel(handle);
  const selection = useSelection(handle);
  const kitFields = useKitFields(kits);
  const selected = selectedFieldOf(form, selection);
  const apply = (op: RjsfOp, mergeKey?: string) =>
    handle.apply(op, mergeKey === undefined ? undefined : { mergeKey }).status === 'applied';

  if (selected === null) return <Hint text={t('inspector.empty')} />;
  // Ключ — имя поля: переименование переносит выделение (`focus` операции), и черновик имени
  // начинается с нового.
  return (
    <FieldInspector
      key={selected}
      form={form}
      name={selected}
      kitFields={kitFields}
      apply={apply}
      t={t}
    />
  );
}

/** Подсказки поля без ключа; пустые — `null`, операция тогда убирает их из uiSchema. */
function uiWith(ui: RjsfFieldUi | undefined, key: string, value: unknown): RjsfFieldUi | null {
  const next: Record<string, unknown> = { ...ui };
  if (value === undefined || value === '') delete next[key];
  else next[key] = value;
  return Object.keys(next).length === 0 ? null : next;
}

/** Схема поля с ключом или без него (пустое значение ключ убирает). */
function fieldWith(field: RjsfFieldSchema, key: string, value: unknown): RjsfFieldSchema {
  const next: Record<string, unknown> = { ...field };
  if (value === undefined || value === '') delete next[key];
  else next[key] = value;
  return next as RjsfFieldSchema;
}

/** Варианты из текста: по одному в строке, числа — для числовых полей. */
function parseEnum(text: string, type: RjsfFieldType): (string | number)[] | undefined {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const values =
    type === 'number' || type === 'integer'
      ? lines.map(Number).filter((value) => Number.isFinite(value))
      : lines;
  return values.length === 0 ? undefined : values;
}

/** Варианты выбора: текст по строкам, в модель — при уходе фокуса. */
function EnumInput(props: {
  name: string;
  field: RjsfFieldSchema;
  apply: (op: RjsfOp) => boolean;
  t: Translate;
}): ReactElement {
  const { name, field, apply, t } = props;
  const [draft, setDraft] = useState((field.enum ?? []).join('\n'));
  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">{t('inspector.enum')}</span>
      <textarea
        className={INPUT_CLASS}
        rows={3}
        data-testid="rjsf-field-enum"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          const values = parseEnum(draft, field.type);
          if (JSON.stringify(values) !== JSON.stringify(field.enum)) {
            apply({ type: 'set-field', params: { name, field: fieldWith(field, 'enum', values) } });
          }
        }}
      />
      <span className="text-xs text-muted-foreground">{t('inspector.enum.hint')}</span>
    </label>
  );
}

function FieldInspector(props: {
  form: RjsfForm;
  name: string;
  kitFields: readonly string[];
  apply: (op: RjsfOp, mergeKey?: string) => boolean;
  t: Translate;
}): ReactElement {
  const { form, name, kitFields, apply, t } = props;
  const field = form.schema.properties[name]!;
  const ui = form.uiSchema?.[name] as RjsfFieldUi | undefined;
  const required = (form.schema.required ?? []).includes(name);
  const [draftName, setDraftName] = useState(name);
  const [nameError, setNameError] = useState<string | null>(null);
  const widget = typeof ui?.['ui:widget'] === 'string' ? ui['ui:widget'] : '';
  const hasEnum = Array.isArray(field.enum) && field.type !== 'boolean';
  const rjsfWidgets = hasEnum ? RJSF_ENUM_WIDGETS : RJSF_WIDGET_CHOICES[field.type];
  // Виджет, которого нет в списках (написан руками), остаётся выбранным — иначе список его сотрёт.
  const known = widget === '' || rjsfWidgets.includes(widget) || kitFields.includes(widget);

  const rename = () => {
    const to = draftName.trim();
    if (to === name) return;
    if (to === '') {
      setNameError(t('inspector.name.empty'));
      return;
    }
    if (Object.hasOwn(form.schema.properties, to)) {
      setNameError(t('inspector.name.taken', { name: to }));
      return;
    }
    // Выделение за полем переносит сама операция: её `focus` — новое имя.
    apply({ type: 'rename-field', params: { name, to } });
  };

  return (
    <section className="flex flex-col gap-2 p-3 text-sm" data-testid="rjsf-inspector">
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t('inspector.name')}</span>
        <input
          className={INPUT_CLASS}
          data-testid="rjsf-field-name"
          value={draftName}
          onChange={(event) => {
            setDraftName(event.target.value);
            setNameError(null);
          }}
          onBlur={rename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') rename();
          }}
        />
        {nameError !== null && (
          <span className="text-xs text-destructive" role="alert">
            {nameError}
          </span>
        )}
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t('inspector.title')}</span>
        <input
          className={INPUT_CLASS}
          data-testid="rjsf-field-title"
          value={field.title ?? ''}
          onChange={(event) => {
            apply(
              {
                type: 'set-field',
                params: { name, field: fieldWith(field, 'title', event.target.value) },
              },
              `title@${name}`
            );
          }}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t('inspector.type')}</span>
        <select
          className={INPUT_CLASS}
          data-testid="rjsf-field-type"
          value={field.type}
          onChange={(event) => {
            const type = event.target.value as RjsfFieldType;
            // Смена типа — новая схема поля: ограничения и варианты старого типа к новому не
            // подходят, а виджет старого типа мог бы не нарисовать новый.
            const next: RjsfFieldSchema = {
              type,
              ...(field.title !== undefined ? { title: field.title } : {}),
              ...(field.description !== undefined ? { description: field.description } : {}),
            };
            apply({
              type: 'set-field',
              params: { name, field: next, ui: uiWith(ui, 'ui:widget', undefined) },
            });
          }}
        >
          {RJSF_FIELD_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`type.${type}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          data-testid="rjsf-field-required"
          checked={required}
          onChange={(event) => {
            apply({ type: 'set-field', params: { name, required: event.target.checked } });
          }}
        />
        <span>{t('inspector.required')}</span>
      </label>
      {field.type !== 'boolean' && (
        // Ключ — сами варианты: отмена и правка текстом меняют их, и черновик начинается заново.
        <EnumInput
          key={JSON.stringify(field.enum ?? [])}
          name={name}
          field={field}
          apply={apply}
          t={t}
        />
      )}
      {field.type !== 'boolean' && (
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('inspector.placeholder')}</span>
          <input
            className={INPUT_CLASS}
            data-testid="rjsf-field-placeholder"
            value={typeof ui?.['ui:placeholder'] === 'string' ? ui['ui:placeholder'] : ''}
            onChange={(event) => {
              apply(
                {
                  type: 'set-field',
                  params: { name, ui: uiWith(ui, 'ui:placeholder', event.target.value) },
                },
                `placeholder@${name}`
              );
            }}
          />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t('inspector.widget')}</span>
        <select
          className={INPUT_CLASS}
          data-testid="rjsf-field-widget"
          value={widget}
          onChange={(event) => {
            apply({
              type: 'set-field',
              params: { name, ui: uiWith(ui, 'ui:widget', event.target.value) },
            });
          }}
        >
          <option value="">{t('inspector.widget.default')}</option>
          {!known && <option value={widget}>{widget}</option>}
          <optgroup label={t('inspector.widget.rjsf')}>
            {rjsfWidgets.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </optgroup>
          {kitFields.length > 0 && (
            <optgroup label={t('inspector.widget.kit')}>
              {kitFields.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
    </section>
  );
}
