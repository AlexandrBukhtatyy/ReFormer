import type { ReactNode } from 'react';
import {
  createForm,
  type FormControl,
  type FormModel,
  type FormSchemaNode,
  type ValidationIssue,
} from '@reformer/core';
import { I18nProvider, useFormBundle, useFormControl } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { defineIssueMessages } from '@reformer/core/i18n';
import { minLength, required } from '@reformer/core/validators';
import { ValidationMessagesProvider, useIssueMessageResolver } from '@reformer/cdk';
import { ru } from '@reformer/cdk/locale/ru';
import { Button, FormField, Input, InputPassword } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

type SignUp = { phone: string; password: string };

const signUpSchema = (model: FormModel<SignUp>): FormSchemaNode => ({
  children: [
    { model: model.$.phone, component: Input, componentProps: { label: 'Телефон' } },
    { model: model.$.password, component: InputPassword, componentProps: { label: 'Пароль' } },
  ],
});

// Правила несут код замечания, текста в них нет.
const signUpRules = defineValidation<SignUp>(({ model }) => {
  validate(model.$.phone, [required({ code: 'phone.required' })]);
  validate(model.$.password, [required(), minLength(8)]);
});

/** Словарь формы: свой код и переопределение общего кода minLength. required — из локали. */
const SIGN_UP_MESSAGES = defineIssueMessages({
  'phone.required': 'Укажите телефон для связи',
  minLength: 'Пароль — не короче {minLength} символов',
});

/** Свой источник текстов — например, словарь i18n-библиотеки приложения. */
const APP_TEXTS: Record<string, string> = {
  'phone.required': 'Телефон обязателен (текст из своего источника)',
  required: 'Заполните поле (текст из своего источника)',
  minLength: 'Слишком коротко (текст из своего источника)',
};
const appResolver = (issue: ValidationIssue): string => APP_TEXTS[issue.code] ?? issue.code;

function useSignUp() {
  return useFormBundle(() =>
    createForm<SignUp>({
      initial: { phone: '', password: '' },
      schema: signUpSchema,
      validation: signUpRules,
    })
  );
}

const BOX: React.CSSProperties = { maxWidth: 380, width: '100%', display: 'grid', gap: 12 };

/** Поля формы и кнопка проверки: validate() помечает поля тронутыми — тексты видны сразу. */
function SignUpFields({ children }: { children?: ReactNode }) {
  const bundle = useSignUp();
  return (
    <div style={BOX}>
      <FormField control={bundle.form.phone} />
      <FormField control={bundle.form.password} />
      {children}
      <div>
        <Button size="sm" variant="outline" onClick={() => void bundle.validate()}>
          Проверить
        </Button>
      </div>
    </div>
  );
}

function MessagesDemo() {
  return (
    <I18nProvider locale={ru}>
      <ValidationMessagesProvider messages={SIGN_UP_MESSAGES}>
        <SignUpFields />
      </ValidationMessagesProvider>
    </I18nProvider>
  );
}

function ResolverDemo() {
  return (
    <I18nProvider locale={ru}>
      <ValidationMessagesProvider resolver={appResolver}>
        <SignUpFields />
      </ValidationMessagesProvider>
    </I18nProvider>
  );
}

/** Свой вывод замечаний: все тексты поля списком, через тот же резолвер. */
function IssueList({ control }: { control: FormControl<string> }) {
  const resolve = useIssueMessageResolver();
  const { issues } = useFormControl(control);
  if (issues.length === 0) return null;
  return (
    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--ifm-color-danger)' }}>
      {issues.map((issue) => (
        <li key={issue.code}>{resolve(issue)}</li>
      ))}
    </ul>
  );
}

function CustomRenderFields() {
  const bundle = useSignUp();
  return (
    <div style={BOX}>
      <FormField control={bundle.form.password} />
      <IssueList control={bundle.form.password} />
      <div>
        <Button size="sm" variant="outline" onClick={() => void bundle.validate()}>
          Проверить
        </Button>
      </div>
    </div>
  );
}

function CustomRenderDemo() {
  return (
    <I18nProvider locale={ru}>
      <ValidationMessagesProvider messages={SIGN_UP_MESSAGES}>
        <CustomRenderFields />
      </ValidationMessagesProvider>
    </I18nProvider>
  );
}

export const cdkValidationMessagesDocConfig: ComponentDocConfig = {
  name: 'ValidationMessagesProvider',
  importFrom: '@reformer/cdk',
  description:
    'Тексты замечаний валидации для поддерева формы: словарь формы поверх локали или полностью свой источник текстов.',
  variants: [
    {
      id: 'messages',
      title: 'Словарь формы поверх локали',
      description:
        'Нажмите «Проверить». Тексты phone.required и minLength — из словаря формы, required у пароля — из русской локали.',
      render: MessagesDemo,
      code: `import { defineIssueMessages } from '@reformer/core/i18n';
import { I18nProvider } from '@reformer/core/react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { ru } from '@reformer/cdk/locale/ru';

const messages = defineIssueMessages({
  'phone.required': 'Укажите телефон для связи',
  minLength: 'Пароль — не короче {minLength} символов',
});

<I18nProvider locale={ru}>
  <ValidationMessagesProvider messages={messages}>
    <FormField control={form.phone} />
    <FormField control={form.password} />
  </ValidationMessagesProvider>
</I18nProvider>`,
    },
    {
      id: 'resolver',
      title: 'Свой источник текстов',
      description:
        'resolver заменяет локаль для всего поддерева: каждый текст приходит из вашей функции.',
      render: ResolverDemo,
      code: `const appResolver = (issue: ValidationIssue) => t(\`errors.\${issue.code}\`, issue.params);

<ValidationMessagesProvider resolver={appResolver}>
  <FormField control={form.phone} />
  <FormField control={form.password} />
</ValidationMessagesProvider>`,
    },
  ],
  examples: [
    {
      id: 'custom-render',
      title: 'Свой вывод замечаний',
      description:
        'useIssueMessageResolver возвращает тот же резолвер, что использует FormField, — для своего компонента, который выводит замечания.',
      render: CustomRenderDemo,
      code: `import { useIssueMessageResolver } from '@reformer/cdk';
import { useFormControl } from '@reformer/core/react';

function IssueList({ control }: { control: FormControl<string> }) {
  const resolve = useIssueMessageResolver();
  const { issues } = useFormControl(control);
  return (
    <ul>
      {issues.map((issue) => <li key={issue.code}>{resolve(issue)}</li>)}
    </ul>
  );
}`,
    },
  ],
  props: [
    {
      name: 'messages',
      type: 'IssueMessages (defineIssueMessages)',
      description:
        'Словарь формы: код замечания → шаблон с параметрами {name} или функция. Накладывается поверх словарей внешних провайдеров и локали; кода нет в словаре — текст из локали. Константа модуля.',
    },
    {
      name: 'resolver',
      type: '(issue: ValidationIssue) => string',
      description:
        'Полная замена источника текстов для поддерева: локаль и внешние провайдеры не участвуют. messages того же провайдера важнее resolver.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Поддерево формы.',
    },
    {
      name: 'useIssueMessageResolver()',
      type: '→ (issue: ValidationIssue) => string',
      description:
        'Итоговый резолвер в точке вызова. Меняется вместе с языком и словарём — используйте прямо в рендере.',
    },
  ],
};
