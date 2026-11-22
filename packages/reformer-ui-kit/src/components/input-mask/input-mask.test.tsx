import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InputMask } from './index';
import { Bound } from '@/test-utils/bound';

describe('InputMask (base)', () => {
  it('рендерит input с data-slot=input-mask', () => {
    expect(renderToStaticMarkup(<InputMask />)).toContain('data-slot="input-mask"');
  });

  it('placeholder по умолчанию равен mask', () => {
    const html = renderToStaticMarkup(<InputMask mask="+7 (999) 999-99-99" />);
    expect(html).toContain('placeholder="+7 (999) 999-99-99"');
  });

  it('явный placeholder перекрывает mask', () => {
    const html = renderToStaticMarkup(<InputMask mask="99.99.9999" placeholder="Дата рождения" />);
    expect(html).toContain('placeholder="Дата рождения"');
  });

  it('value рендерится', () => {
    const html = renderToStaticMarkup(<InputMask value="+7 (900) 000-00-00" />);
    expect(html).toContain('value="+7 (900) 000-00-00"');
  });

  it('value=null → пустое поле', () => {
    expect(renderToStaticMarkup(<InputMask value={null} />)).toContain('value=""');
  });
});

describe('InputMask (seam)', () => {
  it('value → рендерится в input', () => {
    const html = renderToStaticMarkup(
      <Bound component={InputMask} value="+7 (900) 000-00-00" mask="+7 (999) 999-99-99" />
    );
    expect(html).toContain('value="+7 (900) 000-00-00"');
    expect(html).toContain('data-slot="input-mask"');
  });

  it('value=null → пустое поле', () => {
    expect(renderToStaticMarkup(<Bound component={InputMask} value={null} />)).toContain(
      'value=""'
    );
  });

  it('прокидывает aria/id на input (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <Bound
        component={InputMask}
        value="x"
        id="control-a"
        aria-labelledby="label-a"
        aria-invalid
      />
    );
    expect(html).toContain('id="control-a"');
    expect(html).toContain('aria-labelledby="label-a"');
  });
});
