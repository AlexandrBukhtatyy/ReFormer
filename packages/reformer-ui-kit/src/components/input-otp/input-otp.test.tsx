import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
  InputOTPDefault,
  REGEXP_ONLY_DIGITS_AND_CHARS,
  inputOtpBasePropsSchema,
} from './index';
import { Bound } from '@/test-utils/bound';

describe('InputOTP (base, pure shadcn)', () => {
  it('рендерит скрытый input с data-slot=input-otp', () => {
    const html = renderToStaticMarkup(
      <InputOTP maxLength={4}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
        </InputOTPGroup>
      </InputOTP>
    );
    expect(html).toContain('data-slot="input-otp"');
    expect(html).toContain('data-slot="input-otp-group"');
    expect(html).toContain('data-slot="input-otp-slot"');
  });

  it('InputOTPSeparator рендерит role=separator', () => {
    const html = renderToStaticMarkup(<InputOTPSeparator />);
    expect(html).toContain('data-slot="input-otp-separator"');
    expect(html).toContain('role="separator"');
  });
});

describe('InputOTPDefault (field-версия)', () => {
  it('разворачивает maxLength слотов из дефолтной раскладки', () => {
    const html = renderToStaticMarkup(
      <Bound component={InputOTPDefault} maxLength={4} value={null} />
    );
    const slots = html.match(/data-slot="input-otp-slot"/g) ?? [];
    expect(slots).toHaveLength(4);
  });

  it('value прокидывается в скрытый input', () => {
    const html = renderToStaticMarkup(
      <Bound component={InputOTPDefault} maxLength={6} value="123" />
    );
    expect(html).toContain('value="123"');
  });

  it('value=null → пустое поле (адаптер отдаёт "")', () => {
    const html = renderToStaticMarkup(
      <Bound component={InputOTPDefault} maxLength={6} value={null} />
    );
    expect(html).toContain('value=""');
  });

  it('прокидывает aria/id на скрытый input (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <Bound
        component={InputOTPDefault}
        maxLength={6}
        value="1"
        id="control-a"
        aria-labelledby="label-a"
        aria-invalid
      />
    );
    expect(html).toContain('id="control-a"');
    expect(html).toContain('aria-labelledby="label-a"');
  });
});

describe('InputOTPDefault — ошибка, pattern, inputMode', () => {
  it('aria-invalid поля подсвечивает ячейки (data-invalid), хотя сам атрибут — на input', () => {
    const invalid = renderToStaticMarkup(
      <Bound component={InputOTPDefault} maxLength={4} value={null} aria-invalid />
    );
    expect(invalid.match(/data-slot="input-otp-slot"[^>]*data-invalid="true"/g)).toHaveLength(4);

    const valid = renderToStaticMarkup(
      <Bound component={InputOTPDefault} maxLength={4} value={null} />
    );
    expect(valid).not.toContain('data-invalid="true"');
  });

  it('pattern и inputMode доходят до input', () => {
    const html = renderToStaticMarkup(
      <Bound
        component={InputOTPDefault}
        maxLength={4}
        value={null}
        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
        inputMode="text"
      />
    );
    expect(html).toContain('pattern="^[a-zA-Z0-9]+$"');
    expect(html).toContain('inputMode="text"');
  });

  it('props-схема: pattern/inputMode — в DSL, onComplete — runtime', () => {
    expect(Object.keys(inputOtpBasePropsSchema.properties)).toEqual(
      expect.arrayContaining(['pattern', 'inputMode'])
    );
    expect(Object.keys(inputOtpBasePropsSchema['x-runtimeProps'])).toContain('onComplete');
  });
});
