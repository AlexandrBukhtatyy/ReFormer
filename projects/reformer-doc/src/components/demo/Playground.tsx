import { useState } from 'react';
import clsx from 'clsx';
import BrowserOnly from '@docusaurus/BrowserOnly';
import CodeBlock from '@theme/CodeBlock';
import { PropsTable } from './PropsTable';
import type { KnobDef, KnobValues, PlaygroundDef, PropRow } from './types';
import styles from './styles.module.css';

function defaults(knobs: KnobDef[]): KnobValues {
  const values: KnobValues = {};
  for (const k of knobs) values[k.name] = k.default;
  return values;
}

/** Таб API: интерактивная площадка props (knobs) + синхронный сниппет + таблица props. */
export function Playground({
  playground,
  props,
}: {
  playground: PlaygroundDef;
  props?: PropRow[];
}) {
  const [values, setValues] = useState<KnobValues>(() => defaults(playground.knobs));
  const set = (name: string, value: string | boolean) =>
    setValues((prev) => ({ ...prev, [name]: value }));
  const Render = playground.render;

  return (
    <div>
      <div className={styles.playground}>
        <div>
          <div className={clsx('reformer-demo', styles.canvas, styles.canvasCenter)}>
            <BrowserOnly fallback={<span className={styles.fallback}>Загрузка демо…</span>}>
              {() => <Render {...values} />}
            </BrowserOnly>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <CodeBlock language={playground.language ?? 'tsx'}>{playground.code(values)}</CodeBlock>
          </div>
        </div>

        <div className={styles.knobs}>
          <p className={styles.knobsTitle}>Props</p>
          {playground.knobs.map((knob) => (
            <Knob
              key={knob.name}
              knob={knob}
              value={values[knob.name]}
              onChange={(val) => set(knob.name, val)}
            />
          ))}
        </div>
      </div>

      {props && props.length > 0 && (
        <div className={styles.propsTableWrap}>
          <PropsTable rows={props} />
        </div>
      )}
    </div>
  );
}

function Knob({
  knob,
  value,
  onChange,
}: {
  knob: KnobDef;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
}) {
  const label = knob.label ?? knob.name;

  if (knob.type === 'boolean') {
    return (
      <label className={styles.knobRow}>
        <span className={styles.knobLabel}>{label}</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      </label>
    );
  }

  if (knob.type === 'select') {
    return (
      <label className={styles.knobRow}>
        <span className={styles.knobLabel}>{label}</span>
        <select
          className={styles.knobControl}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          {knob.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className={styles.knobRow}>
      <span className={styles.knobLabel}>{label}</span>
      <input
        className={styles.knobControl}
        type="text"
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
