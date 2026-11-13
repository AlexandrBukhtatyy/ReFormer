/**
 * Captcha binding, apart from `./fields`: the widget module talks to the registration API, and the
 * credit bundle must not import it.
 */
import { FieldFrame, controlAttrs } from '../../../shared/ui/FieldFrame';
import { CaptchaWidget, type CaptchaWidgetProps } from '../../../shared/ui/CaptchaWidget';
import { useBenchField, type Bound } from './binding';
import type { BoundKeys } from './fields';

type CaptchaProps = { label: string } & Omit<CaptchaWidgetProps, BoundKeys>;

/** Value-based widget (`onChange(value)`): bound through the value setter, not the event handlers. */
export function captchaView(b: Bound<string>, { label, ...props }: CaptchaProps) {
  return (
    <FieldFrame path={b.path} label={label} error={b.error}>
      <CaptchaWidget
        {...props}
        name={b.field.name}
        value={b.field.value}
        onChange={b.setValue}
        onBlur={() => b.setTouched(true)}
        {...controlAttrs(b.path, b.error)}
      />
    </FieldFrame>
  );
}

export function CaptchaField({ name, ...props }: { name: string } & CaptchaProps) {
  return captchaView(useBenchField<string>(name), props);
}
