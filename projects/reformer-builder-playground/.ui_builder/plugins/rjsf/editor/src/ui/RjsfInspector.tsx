/**
 * Свойства формы RJSF или её выбранного поля — тело панели в правом доке.
 *
 * Панель про свой документ не знает ничего, кроме того, что он на активной вкладке: оболочка
 * отдаёт ей только `panelId`. Поэтому документ она находит сама — по активной вкладке, — а
 * выбранное поле читает из выделения ручки модели: то самое, которое ставит щелчок по строке
 * в структуре и переносят операции (новое поле, переименование).
 *
 * Поле не выбрано — выбрана форма: панель показывает её заголовок и экспорт. Пустой панель
 * не бывает, а к форме возвращают двое — строка формы в структуре и крошка «Форма» над
 * свойствами поля. Крошка нужна виду «форма»: структуры там нет, и выйти к форме больше нечем.
 *
 * У поля два рода свойств. Одни ведёт схема (имя, подпись, тип, варианты, обязательность) —
 * набор один на все виджеты. Другие объявляет запись каталога кита, которой поле нарисовано, —
 * набор у каждого виджета свой. На экране они не разделены: строки стоят в общих группах
 * («Основные», «Текст», «Значения»…) от важного к второстепенному, а где какое значение хранится,
 * знает модель панели (`../widget-props`). Списка свойств контрола у панели нет.
 * Подсказка свойства — значком (i) у подписи, а не строкой под полем.
 *
 * Выбор в панели — всегда список: флажков и радиокнопок здесь нет. Одно значение из нескольких —
 * список с единичным выбором, булевы свойства группы («обязательное» схемы и булевы пропсы
 * контрола) — один список с мультивыбором, где выбранное и есть включённое.
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

import { useId, useMemo, useState, type ReactElement } from 'react';
import { InfoHint } from '@reformer/ui-kit/info-hint';
import { SelectMulti } from '@reformer/ui-kit/select';
import {
  RJSF_FIELD_TYPES,
  type RjsfEnumValue,
  type RjsfFieldSchema,
  type RjsfFieldType,
  type RjsfFieldUi,
  type RjsfForm,
  type RjsfOp,
} from '../../../core';
import type {
  CatalogJson,
  KitsService,
  ModelDocumentHandle,
  ResourceId,
} from '@reformer/builder-plugin-api';
import { exportRjsfForm, type ExportOutcome, type RjsfServices } from '../commands';
import {
  FIELD_GROUPS,
  fieldPanelOf,
  flagKey,
  flagOn,
  flagValue,
  retargetUi,
  withWidgetOption,
  type FieldFlag,
  type FieldRowId,
  type WidgetPropField,
} from '../widget-props';
import {
  selectedFieldOf,
  useActiveHandle,
  useKitCatalog,
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
  // Формы домена на активной вкладке нет: оболочка панель в этот момент уже прячет (`when`).
  if (handle === null) {
    return (
      <p className="p-3 text-xs text-muted-foreground" data-testid="rjsf-inspector-empty">
        {t('editor.notRjsf')}
      </p>
    );
  }
  // Ключ — документ: черновики полей (имя, варианты) и исход экспорта принадлежат своему документу.
  return (
    <DocumentInspector
      key={handle.document.id}
      handle={handle}
      services={services}
      kits={kits()}
      t={t}
    />
  );
}

function DocumentInspector(props: {
  handle: ModelDocumentHandle<RjsfForm>;
  services: RjsfServices;
  kits: KitsService | undefined;
  t: Translate;
}): ReactElement {
  const { handle, services, kits, t } = props;
  const form = useModel(handle);
  const selection = useSelection(handle);
  const catalog = useKitCatalog(kits);
  const selected = selectedFieldOf(form, selection);
  const apply = (op: RjsfOp, mergeKey?: string) =>
    handle.apply(op, mergeKey === undefined ? undefined : { mergeKey }).status === 'applied';

  if (selected === null) {
    return (
      <FormInspector
        form={form}
        documentId={handle.document.id}
        services={services}
        apply={apply}
        t={t}
      />
    );
  }
  // Ключ — имя поля: переименование переносит выделение (`focus` операции), и черновик имени
  // начинается с нового.
  return (
    <FieldInspector
      key={selected}
      form={form}
      name={selected}
      catalog={catalog}
      apply={apply}
      onShowForm={() => {
        handle.setSelection([]);
      }}
      t={t}
    />
  );
}

function exportStatus(outcome: ExportOutcome, t: Translate): string {
  if (outcome.status === 'refused') return t(`inspector.form.export.${outcome.reason}`);
  return outcome.saved ? t('inspector.form.export.saved') : t('inspector.form.export.unsaved');
}

/** Свойства формы целиком: заголовок и экспорт. Показаны, пока не выбрано ни одно поле. */
function FormInspector(props: {
  form: RjsfForm;
  documentId: ResourceId;
  services: RjsfServices;
  apply: (op: RjsfOp, mergeKey?: string) => boolean;
  t: Translate;
}): ReactElement {
  const { form, documentId, services, apply, t } = props;
  const [status, setStatus] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-2 p-3 text-sm" data-testid="rjsf-form-inspector">
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t('inspector.form.title')}</span>
        <input
          className={INPUT_CLASS}
          data-testid="rjsf-title"
          value={form.schema.title ?? ''}
          onChange={(event) => {
            apply({ type: 'set-title', params: { title: event.target.value } }, 'title@form');
          }}
        />
      </label>
      <button
        type="button"
        className="rounded border px-2 py-1"
        data-testid="rjsf-export"
        onClick={() => {
          void exportRjsfForm(services, documentId).then((outcome) => {
            setStatus(exportStatus(outcome, t));
          });
        }}
      >
        {t('inspector.form.export')}
      </button>
      {status !== null && (
        <span className="text-xs text-muted-foreground" role="status" data-testid="rjsf-status">
          {status}
        </span>
      )}
      <p className="text-xs text-muted-foreground">{t('inspector.form.hint')}</p>
    </section>
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

/** Адрес скрытого текста подсказки — на него ссылается `aria-describedby` контрола. */
const hintIdOf = (controlId: string): string => `${controlId}-hint`;

/**
 * Подпись свойства и его подсказка — значком (i) рядом с подписью, тем же, что рисует
 * `labelTooltip` у полей форм ReFormer. Строкой под полем подсказки не показаны: описания пропсов
 * в каталоге кита длинные, и под каждым полем они растягивали бы панель в несколько раз.
 *
 * Значок стоит СНАРУЖИ `<label>`: внутри него щелчок по значку активировал бы контрол. Поэтому
 * подпись связана с контролом через `htmlFor`, а не вложением.
 */
function PropLabel(props: {
  controlId: string;
  label: string;
  hint?: string | undefined;
  t: Translate;
}): ReactElement {
  const { controlId, label, hint, t } = props;
  return (
    <span className="flex items-center gap-1.5">
      <label htmlFor={controlId} className="font-medium">
        {label}
      </label>
      {hint !== undefined && (
        <InfoHint
          content={hint}
          descriptionId={hintIdOf(controlId)}
          aria-label={t('inspector.hint', { label })}
        />
      )}
    </span>
  );
}

/**
 * Подсказка списка флагов — описания его пунктов: у пункта списка своей подсказки нет,
 * а у булевых пропсов кита описания есть. Флаг без описания в подсказку не попадает.
 */
function flagsHint(
  flags: readonly FieldFlag[],
  labelOf: (flag: FieldFlag) => string
): string | undefined {
  const parts = flags.flatMap((flag) => {
    const description = flag.kind === 'prop' ? (flag.prop.description ?? '').trim() : '';
    return description === '' ? [] : [`${labelOf(flag)} — ${description.replace(/[.\s]+$/, '')}`];
  });
  return parts.length === 0 ? undefined : parts.join('; ');
}

/**
 * Булевы свойства группы — один список с мультивыбором: выбранное и есть включённое.
 *
 * Флажками это было по строке на свойство; списком — одна строка, в которой видно всё включённое.
 * Список показывает ДЕЙСТВУЮЩЕЕ состояние: проп, включённый китом по умолчанию, стоит выбранным,
 * хотя в документе его нет. Что из этого писать в документ, решает хозяин панели (`onChange`).
 */
function FlagsInput(props: {
  group: string;
  flags: readonly FieldFlag[];
  /** Обязательность поля — единственный флаг, который ведёт схема, а не `ui:options`. */
  required: boolean;
  onChange: (selected: readonly string[]) => void;
  t: Translate;
}): ReactElement {
  const { group, flags, required, onChange, t } = props;
  const id = useId();
  const labelOf = (flag: FieldFlag): string =>
    flag.kind === 'field' ? t('inspector.required') : flag.prop.label;
  const hint = flagsHint(flags, labelOf);
  return (
    <div className="flex flex-col gap-1">
      <PropLabel controlId={id} label={t('inspector.flags')} hint={hint} t={t} />
      <SelectMulti
        id={id}
        {...(hint === undefined ? {} : { 'aria-describedby': hintIdOf(id) })}
        data-testid={`rjsf-flags-${group}`}
        value={flags
          .filter((flag) => (flag.kind === 'field' ? required : flagOn(flag.prop)))
          .map(flagKey)}
        options={flags.map((flag) => ({ value: flagKey(flag), label: labelOf(flag) }))}
        placeholder={t('inspector.flags.none')}
        // Сводка «выбрано: N» панели не нужна: включённое должно читаться без раскрытия списка.
        summaryThreshold={flags.length}
        className="min-h-8 rounded px-2 py-1 text-sm shadow-none"
        onChange={onChange}
      />
    </div>
  );
}

/** Варианты выбора: текст по строкам, в модель — при уходе фокуса. */
function EnumInput(props: {
  field: RjsfFieldSchema;
  onCommit: (values: RjsfEnumValue[] | undefined) => void;
  t: Translate;
}): ReactElement {
  const { field, onCommit, t } = props;
  const id = useId();
  const [draft, setDraft] = useState((field.enum ?? []).join('\n'));
  return (
    <div className="flex flex-col gap-1">
      <PropLabel controlId={id} label={t('inspector.enum')} hint={t('inspector.enum.hint')} t={t} />
      <textarea
        id={id}
        aria-describedby={hintIdOf(id)}
        className={INPUT_CLASS}
        rows={3}
        data-testid="rjsf-field-enum"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          const values = parseEnum(draft, field.type);
          if (JSON.stringify(values) !== JSON.stringify(field.enum)) onCommit(values);
        }}
      />
    </div>
  );
}

function FieldInspector(props: {
  form: RjsfForm;
  name: string;
  catalog: CatalogJson | null;
  apply: (op: RjsfOp, mergeKey?: string) => boolean;
  onShowForm: () => void;
  t: Translate;
}): ReactElement {
  const { form, name, catalog, apply, onShowForm, t } = props;
  const field = form.schema.properties[name]!;
  const ui = form.uiSchema?.[name] as RjsfFieldUi | undefined;
  const required = (form.schema.required ?? []).includes(name);
  const [draftName, setDraftName] = useState(name);
  const [nameError, setNameError] = useState<string | null>(null);
  const widget = typeof ui?.['ui:widget'] === 'string' ? ui['ui:widget'] : '';
  const hasEnum = Array.isArray(field.enum) && field.type !== 'boolean';
  const rjsfWidgets = hasEnum ? RJSF_ENUM_WIDGETS : RJSF_WIDGET_CHOICES[field.type];
  // Поля активного кита — виджеты под своими именами.
  const kitFields = useMemo(
    () =>
      (catalog?.components ?? [])
        .filter((record) => record.role === 'field')
        .map((record) => record.name),
    [catalog]
  );
  // Виджет, которого нет в списках (написан руками), остаётся выбранным — иначе список его сотрёт.
  const known = widget === '' || rjsfWidgets.includes(widget) || kitFields.includes(widget);
  const { component, sections } = fieldPanelOf(field, ui, catalog);
  /** Подсказки поля под новый виджет: пропсы прежнего контрола, чужие новому, уходят. */
  const retarget = (nextField: RjsfFieldSchema, nextUi: RjsfFieldUi | null): RjsfFieldUi | null =>
    retargetUi({ field, ui }, { field: nextField, ui: nextUi }, catalog);

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

  /** Строка свойства, которое ведёт схема формы. Её место в панели выбирает модель панели. */
  const schemaRow = (id: FieldRowId): ReactElement => {
    switch (id) {
      case 'name':
        return (
          <label key="field:name" className="flex flex-col gap-1">
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
        );
      case 'widget':
        return (
          <label key="field:widget" className="flex flex-col gap-1">
            <span className="font-medium">{t('inspector.widget')}</span>
            <select
              className={INPUT_CLASS}
              data-testid="rjsf-field-widget"
              value={widget}
              onChange={(event) => {
                apply({
                  type: 'set-field',
                  params: {
                    name,
                    ui: retarget(field, uiWith(ui, 'ui:widget', event.target.value)),
                  },
                });
              }}
            >
              {/* Виджет не выбран — поле рисует запись кита по типу значения: её и называем. */}
              <option value="">
                {widget === '' && component !== null
                  ? t('inspector.widget.defaultOf', { name: component })
                  : t('inspector.widget.default')}
              </option>
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
        );
      case 'label':
        return (
          <label key="field:label" className="flex flex-col gap-1">
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
        );
      case 'placeholder':
        return (
          <label key="field:placeholder" className="flex flex-col gap-1">
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
        );
      case 'type':
        return (
          <label key="field:type" className="flex flex-col gap-1">
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
                  params: {
                    name,
                    field: next,
                    ui: retarget(next, uiWith(ui, 'ui:widget', undefined)),
                  },
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
        );
      case 'enum':
        return (
          // Ключ — сами варианты: отмена и правка текстом меняют их, и черновик начинается заново.
          <EnumInput
            key={`field:enum:${JSON.stringify(field.enum ?? [])}`}
            field={field}
            onCommit={(values) => {
              // Появление и исчезновение вариантов меняет виджет по умолчанию (текст ↔ выбор).
              const next = fieldWith(field, 'enum', values);
              const current = ui ?? null;
              const kept = retarget(next, current);
              apply({
                type: 'set-field',
                params: { name, field: next, ...(kept !== current ? { ui: kept } : {}) },
              });
            }}
            t={t}
          />
        );
    }
  };

  /**
   * Флаги группы после щелчка в списке. Пишется только изменившееся, и туда же, куда писал
   * флажок: обязательность — в схему, булев проп контрола — в `ui:options` (совпавшее
   * с умолчанием кита из документа уходит). Одна операция — одна запись в истории.
   */
  const setFlags = (flags: readonly FieldFlag[], selected: readonly string[]) => {
    const params: { name: string; required?: boolean; ui?: RjsfFieldUi | null } = { name };
    for (const flag of flags) {
      const on = selected.includes(flagKey(flag));
      if (flag.kind === 'field') {
        if (on !== required) params.required = on;
      } else if (on !== flagOn(flag.prop)) {
        const current = params.ui === undefined ? ui : (params.ui ?? undefined);
        params.ui = withWidgetOption(current, flag.prop.key, flagValue(flag.prop, on));
      }
    }
    if (params.required !== undefined || params.ui !== undefined) {
      apply({ type: 'set-field', params });
    }
  };

  return (
    <section className="flex flex-col gap-2 p-3 text-sm" data-testid="rjsf-inspector">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <button
          type="button"
          className="underline underline-offset-2 hover:text-foreground"
          data-testid="rjsf-inspector-form"
          onClick={onShowForm}
        >
          {t('inspector.form')}
        </button>
        <span aria-hidden="true">›</span>
        <span className="min-w-0 truncate font-mono text-foreground">{name}</span>
      </div>
      {sections.map((section, index) => (
        <div
          key={section.group}
          className={`flex flex-col gap-2 ${index === 0 ? '' : 'border-t pt-2'}`}
          data-testid={`rjsf-group-${section.group}`}
        >
          {/* Подпись в словаре есть у групп каталога ReFormer; свою группу кита называем как есть. */}
          <span className="text-[11px] font-medium uppercase text-muted-foreground">
            {FIELD_GROUPS.includes(section.group)
              ? t(`inspector.group.${section.group}`)
              : section.group}
          </span>
          {section.rows.map((row) =>
            row.kind === 'field' ? (
              schemaRow(row.id)
            ) : row.kind === 'flags' ? (
              <FlagsInput
                key="flags"
                group={section.group}
                flags={row.flags}
                required={required}
                onChange={(selected) => {
                  setFlags(row.flags, selected);
                }}
                t={t}
              />
            ) : (
              <WidgetPropInput
                key={`prop:${row.prop.key}`}
                field={row.prop}
                onChange={(key, value, merge) => {
                  apply(
                    { type: 'set-field', params: { name, ui: withWidgetOption(ui, key, value) } },
                    merge ? `option.${key}@${name}` : undefined
                  );
                }}
                t={t}
              />
            )
          )}
        </div>
      ))}
    </section>
  );
}

/**
 * Одно свойство контрола. Чем оно правится, решил каталог — см. `../widget-props`.
 * Булевых свойств здесь нет: они пункты списка флагов своей группы ({@link FlagsInput}).
 */
function WidgetPropInput(props: {
  field: WidgetPropField;
  onChange: (key: string, value: unknown, merge: boolean) => void;
  t: Translate;
}): ReactElement {
  const { field, onChange, t } = props;
  const id = useId();
  const testId = `rjsf-option-${field.key}`;
  const describedBy = field.description === undefined ? undefined : hintIdOf(id);

  if (field.editor === 'select') {
    const options = field.options ?? [];
    const current = field.value === undefined ? '' : String(field.value);
    return (
      <div className="flex flex-col gap-1">
        <PropLabel controlId={id} label={field.label} hint={field.description} t={t} />
        <select
          id={id}
          aria-describedby={describedBy}
          className={INPUT_CLASS}
          data-testid={testId}
          value={current}
          onChange={(event) => {
            const next = event.target.value;
            // Тип возвращается тот же, что в каталоге: числовой вариант остаётся числом.
            const original = options.find((option) => String(option) === next);
            onChange(field.key, next === '' ? undefined : (original ?? next), false);
          }}
        >
          <option value="">
            {field.fallback === undefined
              ? t('inspector.option.unset')
              : t('inspector.option.default', { value: String(field.fallback) })}
          </option>
          {/* Значение, которого нет среди вариантов (написано руками), список не стирает. */}
          {current !== '' && !options.some((option) => String(option) === current) && (
            <option value={current}>{current}</option>
          )}
          {options.map((option) => (
            <option key={String(option)} value={String(option)}>
              {String(option)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const numeric = field.editor === 'number';
  const shown = numeric ? typeof field.value === 'number' : typeof field.value === 'string';
  return (
    <div className="flex flex-col gap-1">
      <PropLabel controlId={id} label={field.label} hint={field.description} t={t} />
      <input
        id={id}
        aria-describedby={describedBy}
        className={INPUT_CLASS}
        data-testid={testId}
        type={numeric ? 'number' : 'text'}
        min={field.min}
        max={field.max}
        step={field.step}
        placeholder={field.fallback === undefined ? undefined : String(field.fallback)}
        value={shown ? String(field.value) : ''}
        onChange={(event) => {
          const next = event.target.value;
          const value = !numeric ? next : next === '' ? undefined : Number(next);
          if (typeof value === 'number' && !Number.isFinite(value)) return;
          onChange(field.key, value, true);
        }}
      />
    </div>
  );
}
