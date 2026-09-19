import { useId } from 'react';
import { InfoHint, Input } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * InfoHint — не form-control: иконка-подсказка (i) с тултипом. Это строительный блок, которым кит
 * рисует подсказки полей (`labelTooltip` у FormField, `tooltip` у контролов); напрямую нужен для
 * заголовков, карточек и своих контролов. В отличие от голого Tooltip приносит свой провайдер и
 * открывается ещё и по клику/тапу.
 */
function DescribedInput() {
  const hintId = useId();
  return (
    <div style={{ position: 'relative', maxWidth: 320 }}>
      <Input aria-describedby={hintId} placeholder="Латиница" style={{ paddingRight: 36 }} />
      <InfoHint
        content="Только латинские буквы и цифры"
        descriptionId={hintId}
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}
      />
    </div>
  );
}

export const infoHintDocConfig: ComponentDocConfig = {
  name: 'InfoHint',
  importFrom: '@reformer/ui-kit',
  description:
    'Иконка-подсказка (i) с тултипом: открывается по наведению, фокусу с клавиатуры и клику/тапу. Приносит свой TooltipProvider — оборачивать ничем не нужно.',
  variants: [
    {
      id: 'basic',
      title: 'Рядом с заголовком',
      description: 'Наведите, сфокусируйтесь или кликните по иконке.',
      render: () => (
        <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
          Паспортные данные <InfoHint content="Как в документе, без сокращений" />
        </h4>
      ),
      code: `<h4 className="flex items-center gap-1.5">
  Паспортные данные <InfoHint content="Как в документе, без сокращений" />
</h4>`,
    },
    {
      id: 'sides',
      title: 'Сторона появления (side)',
      description: 'side: top (по умолчанию) / right / bottom / left.',
      render: () => (
        <div style={{ display: 'flex', gap: 24 }}>
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <span key={side} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {side} <InfoHint content={`Появляюсь: ${side}`} side={side} />
            </span>
          ))}
        </div>
      ),
      code: `<InfoHint content="Появляюсь справа" side="right" />`,
    },
  ],
  examples: [
    {
      id: 'described-control',
      title: 'Описание для контрола (descriptionId)',
      description:
        'Контент тултипа живёт в портале и отсутствует в DOM, пока тултип закрыт. descriptionId рендерит скрытый дубль текста — на него ссылается aria-describedby контрола, и screen reader зачитывает подсказку при фокусе на поле.',
      render: () => <DescribedInput />,
      code: `const hintId = useId();

<div className="relative">
  <Input aria-describedby={hintId} className="pr-9" />
  <InfoHint
    content="Только латинские буквы и цифры"
    descriptionId={hintId}
    className="absolute top-1/2 right-3 -translate-y-1/2"
  />
</div>`,
    },
    {
      id: 'in-fields',
      title: 'В полях формы — без InfoHint вручную',
      description:
        'У полей кита иконка подключается пропами componentProps: labelTooltip — после подписи (рисует FormField), tooltip — в самом контроле. Свои поля получают tooltip через withFieldTooltip / useFieldTooltip из @reformer/ui-kit/fields.',
      render: () => (
        <code style={{ fontSize: 13 }}>componentProps: {'{ labelTooltip, tooltip }'}</code>
      ),
      code: `{
  value: model.$.email,
  component: InputField,
  componentProps: {
    label: 'Email',
    labelTooltip: 'Нужен для отправки чеков', // (i) после подписи
    tooltip: 'Только корпоративный домен',    // (i) внутри инпута
  },
}

// своё поле:
import { withFormControl, withFieldTooltip, INSIDE_INPUT, nativeInputAdapter } from '@reformer/ui-kit/fields';
export const MyInputField = withFormControl(withFieldTooltip(MyInput, INSIDE_INPUT), nativeInputAdapter);`,
    },
  ],
  props: [
    {
      name: 'content',
      type: 'string',
      description: 'Текст подсказки. Пустая строка — компонент ничего не рендерит.',
    },
    {
      name: 'descriptionId',
      type: 'string',
      description:
        'id скрытого дубля текста — цель aria-describedby контрола. Без него дубль не рендерится.',
    },
    {
      name: 'side',
      type: "'top' | 'right' | 'bottom' | 'left'",
      description: "Сторона показа тултипа. По умолчанию 'top'.",
    },
    {
      name: 'delayDuration',
      type: 'number',
      description: 'Задержка показа по наведению, мс. По умолчанию 150.',
    },
    {
      name: 'aria-label',
      type: 'string',
      description: "Доступное имя кнопки. По умолчанию 'Подсказка'.",
    },
    {
      name: 'className',
      type: 'string',
      description: 'Классы кнопки — обычно позиционирование иконки поверх контрола.',
    },
  ],
};
