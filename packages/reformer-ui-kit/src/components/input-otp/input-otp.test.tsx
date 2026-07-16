import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator, InputOTPField } from './index';

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

describe('InputOTPField (field-версия)', () => {
  it('разворачивает maxLength слотов из дефолтной раскладки', () => {
    const html = renderToStaticMarkup(<InputOTPField maxLength={4} value={null} />);
    const slots = html.match(/data-slot="input-otp-slot"/g) ?? [];
    expect(slots).toHaveLength(4);
  });

  it('value прокидывается в скрытый input', () => {
    const html = renderToStaticMarkup(<InputOTPField maxLength={6} value="123" />);
    expect(html).toContain('value="123"');
  });

  it('value=null → пустое поле (адаптер отдаёт "")', () => {
    const html = renderToStaticMarkup(<InputOTPField maxLength={6} value={null} />);
    expect(html).toContain('value=""');
  });

  it('strip control: renderer-путь не течёт в DOM', () => {
    const html = renderToStaticMarkup(
      <InputOTPField maxLength={6} value="12" control={{ id: 1 } as never} />
    );
    expect(html).not.toContain('[object Object]');
  });

  it('прокидывает aria/id на скрытый input (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <InputOTPField
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
