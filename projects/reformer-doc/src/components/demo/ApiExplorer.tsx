import { useState } from 'react';
import clsx from 'clsx';
import BrowserOnly from '@docusaurus/BrowserOnly';

import { validateFormModel, useFormControlValue } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import { ChevronDown } from 'lucide-react';
import { useDemoField } from './harness';
import { ApiPreview, type CodeFlavor } from './ApiPreview';
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
  const [status, setStatus] = useState<string | null>(null);
  const [showData, setShowData] = useState(true);

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

  // Футер панели: form-data (сворачивается «Value») + Reset/Submit. Присущ только API.
  const footer = (
    <>
      {/* Form data output (сворачивается кнопкой «Value») */}
      {showData && (
        <pre className={styles.apiOutput}>Form data: {JSON.stringify({ value }, null, 2)}</pre>
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
  );

  // Флейворы кода: schema-нода ReFormer + «сырой» React (авто-сниппет, если не задан).
  const codeFlavors: CodeFlavor[] = [
    { id: 'reformer', label: 'ReFormer', code: api.code(values) },
    {
      id: 'react',
      label: 'React',
      code: api.codeReact ? api.codeReact(values) : buildReactSnippet(api, values),
    },
  ];

  return (
    <div className={styles.apiExplorer}>
      <ApiPreview codeFlavors={codeFlavors} footer={footer}>
        <FormField control={control} />
      </ApiPreview>

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
