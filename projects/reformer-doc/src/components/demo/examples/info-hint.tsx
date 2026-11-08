import { useId } from 'react';
import { InfoHint, Input } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * InfoHint — не поле формы: иконка (i) с подсказкой. Ею кит рисует подсказки полей (`labelTooltip`
 * у FormField, `tooltip` у контролов); напрямую нужна для заголовков, карточек и своих контролов.
 * В отличие от Tooltip приносит свой провайдер и открывается ещё и касанием. Обёртка
 * `<div style>` в render — рамка демо, в `code` её нет.
 */
function DescribedInput() {
  const hintId = useId();
  return (
    <div className="relative max-w-xs">
      <Input aria-describedby={hintId} aria-label="Логин" placeholder="Латиница" className="pr-9" />
      <InfoHint
        content="Только латинские буквы и цифры"
        descriptionId={hintId}
        className="absolute top-1/2 right-3 -translate-y-1/2"
      />
    </div>
  );
}

export const infoHintDocConfig: ComponentDocConfig = {
  name: 'InfoHint',
  importFrom: '@reformer/ui-kit',
  description:
    'Иконка (i) с подсказкой: открывается наведением, фокусом и касанием. Провайдер не нужен.',
  variants: [
    {
      id: 'basic',
      title: 'Рядом с заголовком',
      description: 'Наведите курсор, перейдите клавишей Tab или щёлкните по иконке.',
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
      description: 'side — сторона появления: top (по умолчанию), right, bottom, left.',
      render: () => (
        <div className="flex gap-6">
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <span key={side} className="flex items-center gap-1.5">
              {side} <InfoHint content={`Появляюсь: ${side}`} side={side} />
            </span>
          ))}
        </div>
      ),
      code: `<div className="flex gap-6">
  {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
    <span key={side} className="flex items-center gap-1.5">
      {side} <InfoHint content={\`Появляюсь: \${side}\`} side={side} />
    </span>
  ))}
</div>`,
    },
  ],
  examples: [
    {
      id: 'described-control',
      title: 'Описание для поля (descriptionId)',
      description:
        'Текст подсказки появляется в разметке, только пока она открыта. descriptionId рисует скрытую копию текста — на неё ссылается aria-describedby поля, и скринридер читает подсказку при фокусе на поле.',
      render: () => <DescribedInput />,
      code: `const hintId = useId();

<div className="relative max-w-xs">
  <Input aria-describedby={hintId} aria-label="Логин" placeholder="Латиница" className="pr-9" />
  <InfoHint
    content="Только латинские буквы и цифры"
    descriptionId={hintId}
    className="absolute top-1/2 right-3 -translate-y-1/2"
  />
</div>`,
    },
    {
      id: 'in-fields',
      title: 'В полях кита — проп tooltip',
      description:
        'Полям кита InfoHint вручную не нужен: проп tooltip ставит иконку внутрь поля, labelTooltip — после подписи (её рисует FormField). В схеме формы те же пропсы пишут в componentProps.',
      render: () => (
        <div className="max-w-xs">
          <Input tooltip="Только корпоративный домен" aria-label="Email" placeholder="Email" />
        </div>
      ),
      code: `// Вне формы — проп tooltip у самого поля:
<Input tooltip="Только корпоративный домен" aria-label="Email" placeholder="Email" />

// В схеме формы — те же пропсы в componentProps:
{
  model: model.$.email,
  component: Input,
  componentProps: {
    label: 'Email',
    labelTooltip: 'Нужен для отправки чеков', // (i) после подписи — рисует FormField
    tooltip: 'Только корпоративный домен', // (i) внутри поля
  },
}`,
    },
  ],
  props: [
    {
      name: 'content',
      type: 'string',
      description: 'Текст подсказки. Пустая строка — компонент ничего не рисует.',
    },
    {
      name: 'descriptionId',
      type: 'string',
      description:
        'id скрытой копии текста — на неё ссылается aria-describedby поля. Без пропа копии нет.',
    },
    {
      name: 'side',
      type: "'top' | 'right' | 'bottom' | 'left'",
      default: "'top'",
      description: 'Сторона появления подсказки.',
    },
    {
      name: 'delayDuration',
      type: 'number',
      default: '150',
      description: 'Пауза перед показом по наведению, мс.',
    },
    {
      name: 'aria-label',
      type: 'string',
      default: 'из словаря кита (kit.infoHint.label)',
      description: 'Имя кнопки для скринридера: «Hint» / «Подсказка».',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Классы кнопки — обычно положение иконки поверх поля.',
    },
  ],
};
