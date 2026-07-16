import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InputPassword, InputPasswordField } from './index';

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

describe('InputPasswordField (form-версия)', () => {
  it('value → значение в input', () => {
    const html = renderToStaticMarkup(<InputPasswordField value="секрет" />);
    expect(html).toContain('value="секрет"');
    expect(html).toContain('data-slot="input"');
  });

  it('value=null → пустое поле', () => {
    const html = renderToStaticMarkup(<InputPasswordField value={null} />);
    expect(html).toContain('value=""');
  });

  it('strip control: renderer-путь не течёт в DOM', () => {
    const html = renderToStaticMarkup(
      <InputPasswordField value="x" control={{ id: 1 } as never} />
    );
    expect(html).not.toContain('[object Object]');
  });

  it('прокидывает aria/id на input (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <InputPasswordField value="x" id="control-a" aria-labelledby="label-a" aria-invalid />
    );
    expect(html).toContain('id="control-a"');
    expect(html).toContain('aria-labelledby="label-a"');
  });
});
