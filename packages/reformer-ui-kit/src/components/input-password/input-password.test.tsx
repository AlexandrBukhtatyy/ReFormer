import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InputPassword, inputPasswordBasePropsSchema } from './index';
import { Bound } from '@/test-utils/bound';

describe('InputPassword (base)', () => {
  it('рендерит native input с data-slot=input и type=password по умолчанию', () => {
    const html = renderToStaticMarkup(<InputPassword />);
    expect(html).toContain('data-slot="input"');
    expect(html).toContain('type="password"');
  });

  it('value рендерится в поле', () => {
    const html = renderToStaticMarkup(<InputPassword value="секрет" />);
    expect(html).toContain('value="секрет"');
  });

  it('value=null → пустое поле', () => {
    const html = renderToStaticMarkup(<InputPassword value={null} />);
    expect(html).toContain('value=""');
  });

  it('showToggle + непустой value → кнопка переключения (aria-label «Show password»)', () => {
    const html = renderToStaticMarkup(<InputPassword value="секрет" />);
    expect(html).toContain('data-slot="input-password-toggle"');
    expect(html).toContain('aria-label="Show password"');
  });

  it('пустой value → тумблер скрыт', () => {
    const html = renderToStaticMarkup(<InputPassword value="" />);
    expect(html).not.toContain('data-slot="input-password-toggle"');
  });

  it('showToggle=false → тумблер скрыт даже при значении', () => {
    const html = renderToStaticMarkup(<InputPassword value="секрет" showToggle={false} />);
    expect(html).not.toContain('data-slot="input-password-toggle"');
  });

  it('placeholder прокидывается', () => {
    const html = renderToStaticMarkup(<InputPassword placeholder="Пароль" />);
    expect(html).toContain('placeholder="Пароль"');
  });
});

describe('InputPassword (form-версия)', () => {
  it('value → значение в input', () => {
    const html = renderToStaticMarkup(<Bound component={InputPassword} value="секрет" />);
    expect(html).toContain('value="секрет"');
    expect(html).toContain('data-slot="input"');
  });

  it('value=null → пустое поле', () => {
    const html = renderToStaticMarkup(<Bound component={InputPassword} value={null} />);
    expect(html).toContain('value=""');
  });

  it('прокидывает aria/id на input (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <Bound
        component={InputPassword}
        value="x"
        id="control-a"
        aria-labelledby="label-a"
        aria-invalid
      />
    );
    expect(html).toContain('id="control-a"');
    expect(html).toContain('aria-labelledby="label-a"');
  });

  it('forwardRef: InputPassword сам владеет InputPasswordHandle', () => {
    // forwardRef exotic (объект), не функция: обёртка поля публикует handle композита как есть.
    // Рантайм-поведение handle (toggleVisibility/setVisible) проверяется в e2e (Playwright).
    expect(typeof InputPassword).toBe('object');
  });
});

describe('InputPassword — фокус «глаза» и autoComplete', () => {
  it('у кнопки «глаз» видимый фокус с клавиатуры (outline снят, есть кольцо)', () => {
    const html = renderToStaticMarkup(<InputPassword value="secret" />);
    const toggle = html.match(/<button[^>]*data-slot="input-password-toggle"[^>]*>/)?.[0] ?? '';
    expect(toggle).toContain('focus-visible:ring-[3px]');
    expect(toggle).not.toContain('text-gray-');
  });

  it('autoComplete доходит до input; в props-схеме — enum', () => {
    const html = renderToStaticMarkup(<InputPassword value="" autoComplete="new-password" />);
    expect(html).toContain('autoComplete="new-password"');
    expect(inputPasswordBasePropsSchema.properties.autoComplete.enum).toEqual([
      'current-password',
      'new-password',
      'one-time-code',
      'off',
    ]);
  });
});
