import { Checkbox, Input, Label } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/** Подпись над полем ввода: связь — htmlFor ↔ id. */
function LabelForInput() {
  return (
    <div className="grid w-full max-w-sm gap-2">
      <Label htmlFor="label-demo-name">Имя</Label>
      <Input id="label-demo-name" placeholder="Иван" />
    </div>
  );
}

/** Подпись справа от флажка: клик по тексту переключает флажок. */
function LabelForCheckbox() {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id="label-demo-terms" />
      <Label htmlFor="label-demo-terms">Принимаю условия</Label>
    </div>
  );
}

/** Выключенный контрол: подпись сразу после него (класс peer) гаснет вместе с ним. */
function LabelDisabled() {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id="label-demo-off" disabled className="peer" />
      <Label htmlFor="label-demo-off">Недоступный пункт</Label>
    </div>
  );
}

/** Подпись-обёртка: контрол внутри label, htmlFor и id не нужны. */
function LabelWrapping() {
  return (
    <Label>
      <Checkbox />
      Запомнить меня
    </Label>
  );
}

export const labelDocConfig: ComponentDocConfig = {
  name: 'Label',
  importFrom: '@reformer/ui-kit',
  description: 'Подпись к контролу — элемент label с оформлением кита.',
  variants: [
    {
      id: 'input',
      title: 'Подпись поля ввода',
      description: 'htmlFor указывает на id контрола: клик по подписи ставит фокус в поле.',
      render: LabelForInput,
      code: `import { Input, Label } from '@reformer/ui-kit';

<div className="grid w-full max-w-sm gap-2">
  <Label htmlFor="label-demo-name">Имя</Label>
  <Input id="label-demo-name" placeholder="Иван" />
</div>`,
    },
    {
      id: 'checkbox',
      title: 'Подпись флажка',
      description: 'Клик по тексту переключает флажок — так в него проще попасть.',
      render: LabelForCheckbox,
      code: `import { Checkbox, Label } from '@reformer/ui-kit';

<div className="flex items-center gap-2">
  <Checkbox id="label-demo-terms" />
  <Label htmlFor="label-demo-terms">Принимаю условия</Label>
</div>`,
    },
    {
      id: 'disabled',
      title: 'Выключенный контрол',
      description:
        'Подпись гаснет, если стоит сразу после выключенного контрола с классом peer или внутри родителя с классами group и data-disabled="true".',
      render: LabelDisabled,
      code: `<div className="flex items-center gap-2">
  <Checkbox id="label-demo-off" disabled className="peer" />
  <Label htmlFor="label-demo-off">Недоступный пункт</Label>
</div>`,
    },
  ],
  examples: [
    {
      id: 'wrapping',
      title: 'Контрол внутри подписи',
      description:
        'Если контрол лежит внутри Label, связь не нужна: клик по тексту попадает в контрол. Удобно, когда id не придумать.',
      render: LabelWrapping,
      code: `<Label>
  <Checkbox />
  Запомнить меня
</Label>`,
    },
  ],
  props: [
    {
      name: 'htmlFor',
      type: 'string',
      description: 'id контрола, к которому относится подпись (атрибут for).',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Дополнительные классы Tailwind.',
    },
    {
      name: 'asChild',
      type: 'boolean',
      default: 'false',
      description: 'Отдать оформление и поведение дочернему элементу вместо своего <label>.',
    },
    {
      name: '…',
      type: "ComponentProps<'label'>",
      description: 'Остальные атрибуты уходят в <label>.',
    },
  ],
};
