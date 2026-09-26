/**
 * Редактор формы RJSF: поля в порядке показа и инспектор выбранного поля слева, живая форма справа.
 *
 * Форму рисует не редактор, а ПОВЕРХНОСТЬ превью, выбранная хостом превью по провайдеру модели
 * (`reformer.preview.live`): у домена это плагин `reformer.rjsf.render`, и форма в редакторе та же,
 * что в превью, — тема из активного кита. Нет превью в составе — форма не рисуется, а редактор
 * честно говорит почему.
 *
 * Каждая правка — операция ручки модели: отмена снимает её целиком, текст документа
 * перепечатывается сам. Подпись и подсказка правятся на каждое нажатие с ключом схлопывания —
 * в истории это одна запись на поле, а не по букве.
 *
 * @module plugins/rjsf/editor/ui/RjsfEditor
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from 'react';
import {
  displayOrder,
  RJSF_FIELD_TYPES,
  type RjsfFieldSchema,
  type RjsfFieldType,
  type RjsfFieldUi,
  type RjsfForm,
  type RjsfOp,
} from '@/plugins/rjsf/core';
import type {
  Disposable,
  KitsService,
  LiveSurfaceContext,
  ModelDocumentHandle,
  PreviewLiveService,
  ResourceId,
} from '@reformer/builder-plugin-api';
import {
  addRjsfField,
  exportRjsfForm,
  rjsfHandleOf,
  type ExportOutcome,
  type RjsfServices,
} from '../commands';

type Translate = (key: string, params?: Record<string, unknown>) => string;

const NOOP: Disposable = { dispose: () => {} };
const NO_SELECTION: readonly string[] = Object.freeze([]);
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

export interface RjsfEditorProps {
  readonly documentId: ResourceId;
  readonly services: RjsfServices;
  readonly live: () => PreviewLiveService | undefined;
  readonly kits: () => KitsService | undefined;
  readonly useTranslate: () => Translate;
}

/** Ручка документа как внешнее состояние: вкладка открывается раньше, чем модель готова. */
function useHandle(services: RjsfServices, documentId: ResourceId) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = services.documents()?.onDidChange(onChange) ?? NOOP;
      return () => {
        subscription.dispose();
      };
    },
    [services]
  );
  const snapshot = useCallback(() => rjsfHandleOf(services, documentId), [services, documentId]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Модель документа: перечитывается на каждую правку, отмену и разбор. */
function useModel(handle: ModelDocumentHandle<RjsfForm>): RjsfForm {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = handle.document.onDidChangeModel(onChange);
      return () => {
        subscription.dispose();
      };
    },
    [handle]
  );
  const snapshot = useCallback(() => handle.document.getModel(), [handle]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Поля активного кита — виджеты под своими именами. Кита нет — пусто. */
function useKitFields(kits: KitsService | undefined): readonly string[] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = kits?.onDidChange(onChange) ?? NOOP;
      return () => {
        subscription.dispose();
      };
    },
    [kits]
  );
  const snapshot = useCallback(() => kits?.catalogJson() ?? null, [kits]);
  const catalog = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useMemo(
    () =>
      catalog === null
        ? []
        : catalog.components
            .filter((record) => record.role === 'field')
            .map((record) => record.name),
    [catalog]
  );
}

function LiveForm(props: {
  documentId: ResourceId;
  handle: ModelDocumentHandle<RjsfForm>;
  live: PreviewLiveService | undefined;
  t: Translate;
}): ReactElement {
  const { documentId, handle, live, t } = props;
  const element = useRef<HTMLDivElement | null>(null);
  // Состав поверхностей меняется (плагин выключили) — перечитать выбор. Счётчик, а не снимок:
  // `chosen()` собирает объект на каждый вызов.
  const [, setVersion] = useState(0);
  useEffect(() => {
    const subscription = live?.onDidChange(documentId, () => {
      setVersion((previous) => previous + 1);
    });
    return () => {
      subscription?.dispose();
    };
  }, [live, documentId]);
  const chosen = live?.chosen(documentId) ?? null;
  const surfaceId = chosen?.id ?? null;

  const ctx = useMemo<LiveSurfaceContext>(
    () => ({
      schema: () => handle.document.getModel(),
      onDidChangeSchema: (cb) => handle.document.onDidChangeModel(() => cb()),
      selection: () => NO_SELECTION,
      onDidChangeSelection: () => NOOP,
      select: () => {},
    }),
    [handle]
  );

  useEffect(() => {
    const host = element.current;
    if (host === null || live === undefined || surfaceId === null) return;
    const mounted = live.mount(documentId, host, ctx);
    return () => {
      mounted?.dispose();
    };
  }, [live, documentId, ctx, surfaceId]);

  if (live === undefined || surfaceId === null) {
    return <p className="p-4 text-sm text-muted-foreground">{t('editor.noLive')}</p>;
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto" data-testid="rjsf-live">
      {chosen?.notice != null && <p className="px-4 pt-2 text-xs">{chosen.notice}</p>}
      <div ref={element} />
    </div>
  );
}

function exportStatus(outcome: ExportOutcome, t: Translate): string {
  if (outcome.status === 'refused') return t(`editor.export.${outcome.reason}`);
  return outcome.saved ? t('editor.export.saved') : t('editor.export.unsaved');
}

export function RjsfEditor(props: RjsfEditorProps): ReactElement {
  const { documentId, services, live, kits, useTranslate } = props;
  const t = useTranslate();
  const handle = useHandle(services, documentId);
  if (handle === null) {
    return <p className="p-4 text-sm text-muted-foreground">{t('editor.notRjsf')}</p>;
  }
  return (
    <RjsfEditorBody
      documentId={documentId}
      services={services}
      live={live()}
      kits={kits()}
      handle={handle}
      t={t}
    />
  );
}

function RjsfEditorBody(props: {
  documentId: ResourceId;
  services: RjsfServices;
  live: PreviewLiveService | undefined;
  kits: KitsService | undefined;
  handle: ModelDocumentHandle<RjsfForm>;
  t: Translate;
}): ReactElement {
  const { documentId, services, live, kits, handle, t } = props;
  const form = useModel(handle);
  const kitFields = useKitFields(kits);
  const [status, setStatus] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const order = displayOrder(form);
  // Выбранное поле исчезло (удалили, отменили добавление) — выбора нет.
  const selected = picked !== null && picked in form.schema.properties ? picked : null;
  const apply = (op: RjsfOp, mergeKey?: string) =>
    handle.apply(op, mergeKey === undefined ? undefined : { mergeKey }).status === 'applied';

  return (
    <div className="flex h-full min-h-0" data-testid="rjsf-editor">
      <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-auto border-r p-3 text-sm">
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border px-2 py-1"
            data-testid="rjsf-add-field"
            onClick={() => {
              const name = addRjsfField(services, documentId);
              if (name !== null) setPicked(name);
            }}
          >
            {t('editor.add')}
          </button>
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
            {t('editor.export')}
          </button>
        </div>
        {status !== null && (
          <p className="text-xs text-muted-foreground" data-testid="rjsf-status">
            {status}
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('editor.formTitle')}</span>
          <input
            className={INPUT_CLASS}
            data-testid="rjsf-title"
            value={form.schema.title ?? ''}
            onChange={(event) => {
              apply({ type: 'set-title', params: { title: event.target.value } }, 'title@form');
            }}
          />
        </label>
        <ul className="flex flex-col gap-1" aria-label={t('editor.fields')}>
          {order.map((name, index) => (
            <li
              key={name}
              className={`flex items-center justify-between gap-2 rounded px-1 py-0.5 ${
                name === selected ? 'bg-accent' : ''
              }`}
              data-testid={`rjsf-field-${name}`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                aria-pressed={name === selected}
                onClick={() => {
                  setPicked(name);
                }}
              >
                <span className="font-mono">{name}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {t(`type.${form.schema.properties[name]!.type}`)}
                </span>
              </button>
              <span className="flex shrink-0 gap-1 text-xs text-muted-foreground">
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={t('editor.moveUp', { name })}
                  onClick={() => {
                    apply({ type: 'move-field', params: { name, index: index - 1 } });
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === order.length - 1}
                  aria-label={t('editor.moveDown', { name })}
                  onClick={() => {
                    apply({ type: 'move-field', params: { name, index: index + 1 } });
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={t('editor.remove', { name })}
                  onClick={() => {
                    apply({ type: 'remove-field', params: { name } });
                  }}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
        {selected === null ? (
          <p className="text-xs text-muted-foreground">{t('inspector.empty')}</p>
        ) : (
          <Inspector
            key={selected}
            form={form}
            name={selected}
            kitFields={kitFields}
            apply={apply}
            onRenamed={setPicked}
            t={t}
          />
        )}
      </aside>
      <LiveForm documentId={documentId} handle={handle} live={live} t={t} />
    </div>
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

function Inspector(props: {
  form: RjsfForm;
  name: string;
  kitFields: readonly string[];
  apply: (op: RjsfOp, mergeKey?: string) => boolean;
  onRenamed: (name: string) => void;
  t: Translate;
}): ReactElement {
  const { form, name, kitFields, apply, onRenamed, t } = props;
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
    if (to in form.schema.properties) {
      setNameError(t('inspector.name.taken', { name: to }));
      return;
    }
    if (apply({ type: 'rename-field', params: { name, to } })) onRenamed(to);
  };

  return (
    <section className="flex flex-col gap-2 border-t pt-3" data-testid="rjsf-inspector">
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
