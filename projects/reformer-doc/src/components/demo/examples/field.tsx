import { useState } from 'react';
import {
  Checkbox,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldFrame,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  Input,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

const WIDTH = { maxWidth: 380, width: '100%' };

/** Подпись, контрол и пояснение — вертикальная раскладка по умолчанию. */
function VerticalField() {
  return (
    <div style={WIDTH}>
      <Field>
        <FieldLabel htmlFor="field-demo-email">Email</FieldLabel>
        <Input id="field-demo-email" type="email" placeholder="you@example.com" />
        <FieldDescription>Пришлём на него чек.</FieldDescription>
      </Field>
    </div>
  );
}

/** Флажок слева, подпись и пояснение справа. */
function HorizontalField() {
  return (
    <div style={WIDTH}>
      <Field orientation="horizontal">
        <Checkbox id="field-demo-news" defaultChecked />
        <FieldContent>
          <FieldLabel htmlFor="field-demo-news">Получать новости</FieldLabel>
          <FieldDescription>Не чаще раза в неделю.</FieldDescription>
        </FieldContent>
      </Field>
    </div>
  );
}

/** Ошибка: data-invalid красит подпись, aria-invalid — рамку поля. */
function InvalidField() {
  return (
    <div style={WIDTH}>
      <Field data-invalid>
        <FieldLabel htmlFor="field-demo-login">Логин</FieldLabel>
        <Input
          id="field-demo-login"
          defaultValue="admin"
          aria-invalid
          aria-describedby="field-demo-login-error"
        />
        <FieldError id="field-demo-login-error" errors={[{ message: 'Логин уже занят' }]} />
      </Field>
    </div>
  );
}

/** Группа полей с заголовком и разделителем. */
function FieldSetDemo() {
  return (
    <div style={WIDTH}>
      <FieldSet>
        <FieldLegend>Адрес доставки</FieldLegend>
        <FieldDescription>Курьер привезёт заказ по этому адресу.</FieldDescription>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="field-demo-city">Город</FieldLabel>
            <Input id="field-demo-city" />
          </Field>
          <FieldSeparator>или</FieldSeparator>
          <Field>
            <FieldLabel htmlFor="field-demo-pickup">Пункт выдачи</FieldLabel>
            <Input id="field-demo-pickup" />
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  );
}

/** FieldFrame: рамка поля без ноды формы — значение и ошибки держит само приложение. */
function FrameDemo() {
  const [nick, setNick] = useState('ab');
  const errors = nick.length < 3 ? ['Не короче 3 символов'] : [];
  return (
    <div style={WIDTH}>
      <FieldFrame
        id="field-demo-nick"
        label="Ник"
        description="Виден другим участникам"
        required
        errors={errors}
      >
        <Input
          id="field-demo-nick"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          aria-invalid={errors.length > 0 || undefined}
        />
      </FieldFrame>
    </div>
  );
}

export const fieldDocConfig: ComponentDocConfig = {
  name: 'Field',
  importFrom: '@reformer/ui-kit',
  description:
    'Части раскладки поля без формы: подпись, контрол, пояснение, ошибка, группа полей. FieldFrame собирает их в готовую рамку.',
  variants: [
    {
      id: 'vertical',
      title: 'Подпись над полем',
      description: 'Field — колонка: FieldLabel, контрол, FieldDescription.',
      render: VerticalField,
      code: `import { Field, FieldDescription, FieldLabel, Input } from '@reformer/ui-kit';

<Field>
  <FieldLabel htmlFor="field-demo-email">Email</FieldLabel>
  <Input id="field-demo-email" type="email" placeholder="you@example.com" />
  <FieldDescription>Пришлём на него чек.</FieldDescription>
</Field>`,
    },
    {
      id: 'horizontal',
      title: 'Флажок с подписью',
      description:
        'orientation="horizontal": контрол слева, справа FieldContent с подписью и пояснением.',
      render: HorizontalField,
      code: `<Field orientation="horizontal">
  <Checkbox id="field-demo-news" defaultChecked />
  <FieldContent>
    <FieldLabel htmlFor="field-demo-news">Получать новости</FieldLabel>
    <FieldDescription>Не чаще раза в неделю.</FieldDescription>
  </FieldContent>
</Field>`,
    },
    {
      id: 'invalid',
      title: 'Ошибка',
      description:
        'data-invalid у Field красит подпись, aria-invalid у контрола — его рамку. FieldError выводит текст с role="alert".',
      render: InvalidField,
      code: `<Field data-invalid>
  <FieldLabel htmlFor="field-demo-login">Логин</FieldLabel>
  <Input
    id="field-demo-login"
    defaultValue="admin"
    aria-invalid
    aria-describedby="field-demo-login-error"
  />
  <FieldError id="field-demo-login-error" errors={[{ message: 'Логин уже занят' }]} />
</Field>`,
    },
    {
      id: 'fieldset',
      title: 'Группа полей',
      description:
        'FieldSet и FieldLegend — настоящие <fieldset> и <legend>. FieldGroup ставит поля в колонку, FieldSeparator разделяет их.',
      render: FieldSetDemo,
      code: `<FieldSet>
  <FieldLegend>Адрес доставки</FieldLegend>
  <FieldDescription>Курьер привезёт заказ по этому адресу.</FieldDescription>
  <FieldGroup>
    <Field>
      <FieldLabel htmlFor="field-demo-city">Город</FieldLabel>
      <Input id="field-demo-city" />
    </Field>
    <FieldSeparator>или</FieldSeparator>
    <Field>
      <FieldLabel htmlFor="field-demo-pickup">Пункт выдачи</FieldLabel>
      <Input id="field-demo-pickup" />
    </Field>
  </FieldGroup>
</FieldSet>`,
    },
  ],
  examples: [
    {
      id: 'frame',
      title: 'FieldFrame: рамка для чужого состояния',
      description:
        'Та же раскладка, что у FormField, но всё приходит пропсами: значение и ошибки держит приложение. Введите три символа — ошибка исчезнет.',
      render: FrameDemo,
      code: `import { useState } from 'react';
import { FieldFrame, Input } from '@reformer/ui-kit';

const [nick, setNick] = useState('ab');
const errors = nick.length < 3 ? ['Не короче 3 символов'] : [];

<FieldFrame
  id="field-demo-nick"
  label="Ник"
  description="Виден другим участникам"
  required
  errors={errors}
>
  <Input
    id="field-demo-nick"
    value={nick}
    onChange={(e) => setNick(e.target.value)}
    aria-invalid={errors.length > 0 || undefined}
  />
</FieldFrame>`,
    },
  ],
  props: [
    {
      name: 'Field · orientation',
      type: "'vertical' | 'horizontal' | 'responsive'",
      default: "'vertical'",
      description:
        'Раскладка поля: колонка, строка или колонка, которая становится строкой в широком FieldGroup. Корень — div с role="group".',
    },
    {
      name: 'Field · data-invalid',
      type: 'boolean',
      description: 'Красит поле цветом ошибки. Рамку контрола даёт его собственный aria-invalid.',
    },
    {
      name: 'FieldLabel',
      type: 'ComponentProps<typeof Label>',
      description: 'Подпись поля — Label кита. Связь с контролом — htmlFor.',
    },
    {
      name: 'FieldTitle',
      type: "ComponentProps<'div'>",
      description: 'Заголовок, который выглядит как подпись, но не является <label>.',
    },
    {
      name: 'FieldContent',
      type: "ComponentProps<'div'>",
      description: 'Колонка подписи и пояснения рядом с контролом в горизонтальном Field.',
    },
    {
      name: 'FieldDescription',
      type: "ComponentProps<'p'>",
      description: 'Пояснение приглушённым цветом.',
    },
    {
      name: 'FieldError · errors',
      type: 'Array<{ message?: string } | undefined>',
      description:
        'Тексты ошибок: одна — строкой, несколько — списком, повторы убираются. children важнее errors. Пусто — ничего не рисует.',
    },
    {
      name: 'FieldSet',
      type: "ComponentProps<'fieldset'>",
      description: 'Группа связанных полей.',
    },
    {
      name: 'FieldLegend · variant',
      type: "'legend' | 'label'",
      default: "'legend'",
      description: 'Заголовок группы. label — размер подписи поля вместо крупного заголовка.',
    },
    {
      name: 'FieldGroup',
      type: "ComponentProps<'div'>",
      description: 'Колонка полей с отступами; задаёт ширину для orientation="responsive".',
    },
    {
      name: 'FieldSeparator · children',
      type: 'ReactNode',
      description: 'Горизонтальная линия между полями, с текстом посередине или без.',
    },
    {
      name: 'FieldFrame · id',
      type: 'string',
      description: 'id контрола: на него ссылается подпись (htmlFor). Сам контрол id не получает.',
    },
    {
      name: 'FieldFrame · label / description',
      type: 'ReactNode',
      description: 'Подпись над контролом и пояснение под ним.',
    },
    {
      name: 'FieldFrame · required',
      type: 'boolean',
      description: 'Звёздочка у подписи. Скрыта от скринридера; aria-required ставьте на контрол.',
    },
    {
      name: 'FieldFrame · errors',
      type: 'readonly string[]',
      description:
        'Тексты ошибок. Непустой массив красит поле и выводит текст с role="alert". Повторы и пустые строки отбрасываются.',
    },
    {
      name: 'FieldFrame · inlineLabel',
      type: 'boolean',
      description: 'Контрол подписывает себя сам (флажок, переключатель) — верхней подписи нет.',
    },
    {
      name: 'FieldFrame · hidden',
      type: 'boolean',
      description: 'Ничего не рисовать.',
    },
    {
      name: 'FieldFrame · className / children',
      type: 'string / ReactNode',
      description: 'Класс корня и сам контрол.',
    },
  ],
};
