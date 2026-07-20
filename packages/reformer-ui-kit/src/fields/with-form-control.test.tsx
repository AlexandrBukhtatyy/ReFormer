import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentProps } from 'react';
import { withFormControl } from './with-form-control';
import { nativeInputAdapter } from './adapters';

/** Локальный аналог shadcn-примитива Input (React-19 ref-as-prop plain-функция). */
function Input(props: ComponentProps<'input'>) {
  return <input data-slot="input" {...props} />;
}

describe('withFormControl — forwardRef + baseline handle', () => {
  const Field = withFormControl(Input, nativeInputAdapter);

  it('возвращает forwardRef-компонент с displayName', () => {
    // forwardRef exotic — объект ($$typeof), не функция.
    expect(typeof Field).toBe('object');
    expect(Field.displayName).toBe('Field(Input)');
  });

  it('SSR: value/onChange-контракт сохранён (regression)', () => {
    const html = renderToStaticMarkup(<Field value="привет" />);
    expect(html).toContain('value="привет"');
    expect(html).toContain('data-slot="input"');
  });

  it('SSR: value=null → пустое поле (toValue coerce)', () => {
    const html = renderToStaticMarkup(<Field value={null} />);
    expect(html).toContain('value=""');
  });

  it('SSR: control снимается, не течёт в DOM', () => {
    const html = renderToStaticMarkup(<Field value="x" control={{ id: 1 } as never} />);
    expect(html).not.toContain('[object Object]');
  });

  it('SSR: aria/id прокидываются на примитив (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <Field value="x" id="control-a" aria-labelledby="label-a" aria-invalid />
    );
    expect(html).toContain('id="control-a"');
    expect(html).toContain('aria-labelledby="label-a"');
  });

  it('ref не течёт в DOM как атрибут', () => {
    const html = renderToStaticMarkup(<Field value="x" />);
    expect(html).not.toContain('ref=');
  });
});

describe('withFormControl — passthrough (exposesHandle)', () => {
  const Passthrough = withFormControl(Input, nativeInputAdapter, { exposesHandle: true });

  it('тоже forwardRef-компонент', () => {
    expect(typeof Passthrough).toBe('object');
    expect(Passthrough.displayName).toBe('Field(Input)');
  });

  it('SSR: value/onChange-контракт сохранён', () => {
    const html = renderToStaticMarkup(<Passthrough value="мир" />);
    expect(html).toContain('value="мир"');
    expect(html).toContain('data-slot="input"');
  });
});
