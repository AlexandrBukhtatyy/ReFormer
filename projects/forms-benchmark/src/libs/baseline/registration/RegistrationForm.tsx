/**
 * Baseline: та же разметка и те же примитивы, что у реализаций, но без библиотеки форм, без
 * валидации и без отправки. Точка отсчёта для байтов, heap и DOM — «стоимость» каждой библиотеки
 * считается как прирост над этой страницей.
 */
import { useState } from 'react';
import { FieldFrame, controlAttrs } from '../../../shared/ui/FieldFrame';
import { Checkbox, MaskedInput, TextInput } from '../../../shared/ui/controls';
import { CaptchaWidget } from '../../../shared/ui/CaptchaWidget';
import { Actions, Page, ResetButton, SubmitButton } from '../../../shared/ui/layout';
import {
  PHONE_MASK,
  REGISTRATION_LABELS as L,
  REGISTRATION_PLACEHOLDERS as P,
} from '../../../shared/domain/registration';

export function RegistrationForm() {
  const [captcha, setCaptcha] = useState('');
  return (
    <Page title="Регистрация">
      <form noValidate onSubmit={(e) => e.preventDefault()}>
        <div className="b-grid">
          <FieldFrame path="username" label={L.username}>
            <TextInput name="username" placeholder={P.username} {...controlAttrs('username')} />
          </FieldFrame>
          <FieldFrame path="email" label={L.email}>
            <TextInput type="email" name="email" placeholder={P.email} {...controlAttrs('email')} />
          </FieldFrame>
          <FieldFrame path="password" label={L.password}>
            <TextInput
              type="password"
              name="password"
              placeholder={P.password}
              {...controlAttrs('password')}
            />
          </FieldFrame>
          <FieldFrame path="confirmPassword" label={L.confirmPassword}>
            <TextInput
              type="password"
              name="confirmPassword"
              placeholder={P.confirmPassword}
              {...controlAttrs('confirmPassword')}
            />
          </FieldFrame>
        </div>
        <FieldFrame path="fullName" label={L.fullName}>
          <TextInput name="fullName" placeholder={P.fullName} {...controlAttrs('fullName')} />
        </FieldFrame>
        <FieldFrame path="phone" label={L.phone}>
          <MaskedInput
            mask={PHONE_MASK}
            name="phone"
            placeholder={P.phone}
            {...controlAttrs('phone')}
          />
        </FieldFrame>
        <FieldFrame path="captcha" label={L.captcha}>
          <CaptchaWidget
            name="captcha"
            value={captcha}
            onChange={setCaptcha}
            placeholder={P.captcha}
            {...controlAttrs('captcha')}
          />
        </FieldFrame>
        <FieldFrame path="acceptTerms" label={L.acceptTerms} inline>
          <Checkbox name="acceptTerms" {...controlAttrs('acceptTerms')} />
        </FieldFrame>
        <Actions>
          <SubmitButton>Зарегистрироваться</SubmitButton>
          <ResetButton />
        </Actions>
      </form>
    </Page>
  );
}
