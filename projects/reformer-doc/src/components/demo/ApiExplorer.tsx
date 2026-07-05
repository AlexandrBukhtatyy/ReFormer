import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import BrowserOnly from '@docusaurus/BrowserOnly';
import { useColorMode } from '@docusaurus/theme-common';
import CodeBlock from '@theme/CodeBlock';

import { validateFormModel, useFormControlValue } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import { ChevronDown } from 'lucide-react';
import { useDemoField } from './harness';
import type { ApiConfig, ApiControl, ApiValues } from './types';
import styles from './styles.module.css';

/** Богатый таб API в стиле TaigaUI. Живой рендер только на клиенте. */
export function ApiExplorer({ api }: { api: ApiConfig }) {
  return (
    <BrowserOnly fallback={<div className={styles.fallback}>Загрузка демо…</div>}>
      {() => <ApiExplorerInner api={api} />}
    </BrowserOnly>
  );
}

function initialValues(controls: ApiControl[]): ApiValues {
  const v: ApiValues = {};
  for (const c of controls) if (c.kind !== 'readonly') v[c.prop] = c.default;
  return v;
}

function ApiExplorerInner({ api }: { api: ApiConfig }) {
  const [values, setValues] = useState<ApiValues>(() => initialValues(api.controls));
  // По умолчанию берём тему из активной темы сайта (docusaurus с
  // respectPrefersColorScheme наследует её из темы браузера); дальше toggle независим.
  const { colorMode } = useColorMode();
  const [dark, setDark] = useState(colorMode === 'dark');
  const [bg, setBg] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [showData, setShowData] = useState(true);
  const [viewTab, setViewTab] = useState<'preview' | 'code'>('preview');
  const [codeFlavor, setCodeFlavor] = useState<'reformer' | 'react'>('reformer');

  const { control, model, schema } = useDemoField({
    initial: api.initialValue,
    component: api.component,
    componentProps: {
      ...api.baseComponentProps,
      ...Object.fromEntries(
        api.controls
          .filter((c) => c.kind !== 'readonly' && c.prop !== 'disabled')
          .map((c) => [c.prop, c.default])
      ),
    },
    validators: api.validators,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = useFormControlValue(control as any);

  const setControl = (c: ApiControl, raw: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [c.prop]: raw }));
    if (c.prop === 'disabled') {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      raw ? control.disable() : control.enable();
    } else {
      control.updateComponentProps({ [c.prop]: raw });
    }
    setStatus(null);
  };

  const onReset = () => {
    control.setValue(api.initialValue);
    setStatus(null);
  };
  const onSubmit = async () => {
    control.markAsTouched();
    const res = await validateFormModel(model, schema);
    setStatus(res.valid ? '✅ valid' : '❌ invalid');
  };

  // Группировка контролов с сохранением порядка появления групп.
  const groups: { name: string; items: ApiControl[] }[] = [];
  for (const c of api.controls) {
    const g = c.group ?? 'Props';
    let bucket = groups.find((x) => x.name === g);
    if (!bucket) {
      bucket = { name: g, items: [] };
      groups.push(bucket);
    }
    bucket.items.push(c);
  }

  return (
    <div className={styles.apiExplorer}>
      <div className={styles.apiPreview}>
        {/* Toolbar: слева табы Preview/Code (+ выбор формата кода), справа тумблеры превью */}
        <div className={styles.apiToolbar}>
          <div className={styles.apiViewTabs}>
            <button
              type="button"
              className={clsx(styles.apiViewTab, viewTab === 'preview' && styles.apiViewTabActive)}
              onClick={() => setViewTab('preview')}
            >
              Preview
            </button>
            <button
              type="button"
              className={clsx(styles.apiViewTab, viewTab === 'code' && styles.apiViewTabActive)}
              onClick={() => setViewTab('code')}
            >
              Code
            </button>
            {viewTab === 'code' && (
              <select
                className={styles.knobControl}
                value={codeFlavor}
                onChange={(e) => setCodeFlavor(e.target.value as 'reformer' | 'react')}
                aria-label="Формат кода"
              >
                <option value="reformer">ReFormer</option>
                <option value="react">React</option>
              </select>
            )}
          </div>

          {viewTab === 'preview' && (
            <div className={styles.apiToolbarRight}>
              <label className={styles.apiToggle}>
                <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />{' '}
                Dark mode
              </label>
              <label className={styles.apiToggle}>
                <input type="checkbox" checked={bg} onChange={(e) => setBg(e.target.checked)} />{' '}
                Background
              </label>
            </div>
          )}
        </div>

        {viewTab === 'preview' ? (
          <>
            {/* Canvas (form-bound preview) */}
            <div
              className={clsx('reformer-demo', styles.apiCanvas, bg && styles.apiCanvasBg)}
              data-preview-theme={dark ? 'dark' : 'light'}
            >
              <ResizableCanvas>
                <FormField control={control} />
              </ResizableCanvas>
            </div>

            {/* Form data output (сворачивается кнопкой «Value») */}
            {showData && (
              <pre className={styles.apiOutput}>
                Form data: {JSON.stringify({ value }, null, 2)}
              </pre>
            )}

            {/* Value controls */}
            <div className={styles.apiValueBar}>
              <button
                type="button"
                className={styles.apiValueToggle}
                onClick={() => setShowData((s) => !s)}
                aria-expanded={showData}
              >
                Value
                <ChevronDown size={16} className={styles.apiChevron} data-open={showData} />
              </button>
              <div className={styles.apiValueBtns}>
                {/* TODO: поле выбора стратегии обновления модели (updateOn) —
              когда значение поля пишется в модель: change | blur | submit.
              Пока скрыто; ниже закомментирован старый селект пресетов значения. */}
                {/* {api.valuePresets && api.valuePresets.length > 0 && (
            <ChangeSelect presets={api.valuePresets} onPick={(v) => control.setValue(v)} />
          )} */}
                <button type="button" className={styles.apiBtn} onClick={onReset}>
                  Reset
                </button>
                <button
                  type="button"
                  className={clsx(styles.apiBtn, styles.apiBtnPrimary)}
                  onClick={onSubmit}
                >
                  Submit
                </button>
                {status && <span className={styles.apiStatus}>{status}</span>}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.apiCodeView}>
            <CodeBlock language="tsx">
              {codeFlavor === 'react'
                ? api.codeReact
                  ? api.codeReact(values)
                  : buildReactSnippet(api, values)
                : api.code(values)}
            </CodeBlock>
          </div>
        )}
      </div>

      {/* Grouped prop controls */}
      {groups.map((g) => (
        <div key={g.name} className={styles.apiGroup}>
          <div className={styles.apiGroupHead}>{g.name}</div>
          {g.items.map((c) => (
            <ControlRow
              key={c.prop}
              control={c}
              value={values[c.prop]}
              onChange={(v) => setControl(c, v)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Обёртка превью с «шторкой» на правом крае: тянешь ручку — меняешь ширину
 * контейнера, чтобы проверить поведение компонента при разных размерах.
 * По умолчанию — во всю доступную ширину и с выравниванием по левому краю.
 * Двойной клик по ручке сбрасывает ширину обратно на 100%.
 */
function ResizableCanvas({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null); // null → во всю ширину
  const [dragging, setDragging] = useState(false);

  const onHandleDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const box = boxRef.current;
    if (!box) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = box.getBoundingClientRect().width;
    const parent = box.parentElement;
    let maxWidth = startWidth;
    if (parent) {
      const cs = getComputedStyle(parent);
      maxWidth = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    }
    setDragging(true);
    const onMove = (ev: PointerEvent) => {
      setWidth(Math.min(maxWidth, Math.max(200, startWidth + ev.clientX - startX)));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div ref={boxRef} className={styles.resizable} style={width == null ? undefined : { width }}>
      <div className={styles.resizableContent}>{children}</div>
      {dragging && (
        <span className={styles.resizableWidth}>
          {width == null ? '100%' : `${Math.round(width)}px`}
        </span>
      )}
      <button
        type="button"
        className={styles.resizableHandle}
        onPointerDown={onHandleDown}
        onDoubleClick={() => setWidth(null)}
        title="Потяните, чтобы изменить ширину контейнера. Двойной клик — сбросить."
        aria-label="Изменить ширину контейнера"
      />
    </div>
  );
}

// TODO: заготовка под будущее поле выбора updateOn (change | blur | submit).
// Сейчас это селект пресетов значения — законсервирован вместе с рендером выше.
// function ChangeSelect({
//   presets,
//   onPick,
// }: {
//   presets: ValuePreset[];
//   onPick: (value: unknown) => void;
// }) {
//   return (
//     <select
//       className={styles.knobControl}
//       defaultValue=""
//       onChange={(e) => {
//         const p = presets[Number(e.target.value)];
//         if (p) onPick(p.value);
//       }}
//     >
//       <option value="" disabled>
//         change…
//       </option>
//       {presets.map((p, i) => (
//         <option key={i} value={i}>
//           {p.label}
//         </option>
//       ))}
//     </select>
//   );
// }

/** Литерал начального значения для useState в React-сниппете. */
function valueLiteral(v: unknown): string {
  if (typeof v === 'string') return `'${v}'`;
  if (v === null || v === undefined) return 'null';
  return String(v);
}

/** JSX-атрибут пропа для React-сниппета (null → пропустить). */
function jsxAttr(key: string, val: unknown): string | null {
  if (typeof val === 'boolean') return val ? key : null;
  if (typeof val === 'number') return `${key}={${val}}`;
  if (typeof val === 'string') return val === '' ? null : `${key}="${val}"`;
  if (Array.isArray(val)) return `${key}={${key}}`;
  return null;
}

/** Автогенерация «сырого» React-сниппета компонента с текущими настройками. */
function buildReactSnippet(api: ApiConfig, values: ApiValues): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comp = api.component as any;
  const name: string = comp?.displayName || comp?.name || 'Component';
  const props: Record<string, unknown> = { ...(api.baseComponentProps ?? {}) };
  // `label`/`testId` — концепты FormField/схемы, «сырой» компонент их не принимает.
  delete props.testId;
  delete props.label;
  for (const c of api.controls) if (c.kind !== 'readonly') props[c.prop] = values[c.prop];
  const attrs = ['value={value}', 'onChange={setValue}'];
  for (const [k, v] of Object.entries(props)) {
    const a = jsxAttr(k, v);
    if (a) attrs.push(a);
  }
  return `import { useState } from 'react';
import { ${name} } from '@reformer/ui-kit';

function Field() {
  const [value, setValue] = useState(${valueLiteral(api.initialValue)});
  return (
    <${name}
      ${attrs.join('\n      ')}
    />
  );
}`;
}

function ControlRow({
  control,
  value,
  onChange,
}: {
  control: ApiControl;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
}) {
  return (
    <div className={styles.controlRow}>
      <div className={styles.controlInfo}>
        <code className={styles.controlName}>{control.prop}</code>
        {control.description && <span className={styles.controlDesc}>{control.description}</span>}
      </div>
      <code className={styles.controlType}>{control.type}</code>
      <div className={styles.controlWidget}>
        <ControlWidget control={control} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function ControlWidget({
  control,
  value,
  onChange,
}: {
  control: ApiControl;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
}) {
  if (control.kind === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }
  if (control.kind === 'enum') {
    return (
      <select
        className={styles.knobControl}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      >
        {control.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (control.kind === 'number') {
    return (
      <input
        className={styles.knobControl}
        type="number"
        value={Number(value)}
        min={control.min}
        max={control.max}
        step={control.step}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    );
  }
  if (control.kind === 'text') {
    return (
      <input
        className={styles.knobControl}
        type="text"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  // readonly
  return <span className={styles.controlReadonly}>—</span>;
}
