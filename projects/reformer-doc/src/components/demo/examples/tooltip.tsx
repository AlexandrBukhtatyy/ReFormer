import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Button } from '@reformer/ui-kit';
import { Info } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * Tooltip — не поле формы: подсказка на Radix Tooltip (TooltipProvider / Tooltip / TooltipTrigger /
 * TooltipContent). Без внешнего TooltipProvider Tooltip ставит провайдер сам. Variants — базовая подсказка и
 * стороны, Examples — кнопка-иконка, задержка. Обёртка `<div style>` в render — рамка демо, в
 * `code` её нет.
 */
export const tooltipDocConfig: ComponentDocConfig = {
  name: 'Tooltip',
  importFrom: '@reformer/ui-kit',
  description:
    'Короткий текст при наведении или фокусе. TooltipProvider необязателен: без него Tooltip ставит провайдер сам.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая подсказка',
      description: 'Наведите курсор на кнопку или перейдите на неё клавишей Tab.',
      render: () => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Наведи на меня</Button>
          </TooltipTrigger>
          <TooltipContent>Всплывающая подсказка</TooltipContent>
        </Tooltip>
      ),
      code: `<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="outline">Наведи на меня</Button>
  </TooltipTrigger>
  <TooltipContent>Всплывающая подсказка</TooltipContent>
</Tooltip>`,
    },
    {
      id: 'sides',
      title: 'Сторона появления (side)',
      description:
        'side у TooltipContent — сторона появления: top (по умолчанию), right, bottom, left. Общий TooltipProvider у соседних подсказок показывает следующую без повторной задержки.',
      render: () => (
        <TooltipProvider>
          <div className="flex flex-wrap gap-3">
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <Tooltip key={side}>
                <TooltipTrigger asChild>
                  <Button variant="outline">{side}</Button>
                </TooltipTrigger>
                <TooltipContent side={side}>Появляюсь со стороны: {side}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      ),
      code: `<TooltipProvider>
  <div className="flex flex-wrap gap-3">
    {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
      <Tooltip key={side}>
        <TooltipTrigger asChild>
          <Button variant="outline">{side}</Button>
        </TooltipTrigger>
        <TooltipContent side={side}>Появляюсь со стороны: {side}</TooltipContent>
      </Tooltip>
    ))}
  </div>
</TooltipProvider>`,
    },
  ],
  examples: [
    {
      id: 'icon-button',
      title: 'Подсказка у кнопки-иконки',
      description:
        'Кнопка без текста: имя для скринридера — aria-label, а Tooltip показывает то же слово глазами. Появляется и по фокусу.',
      render: () => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Информация">
              <Info />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Подробнее об этом поле</TooltipContent>
        </Tooltip>
      ),
      code: `import { Info } from 'lucide-react';

<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon" aria-label="Информация">
      <Info />
    </Button>
  </TooltipTrigger>
  <TooltipContent>Подробнее об этом поле</TooltipContent>
</Tooltip>`,
    },
    {
      id: 'delay',
      title: 'Задержка появления (delayDuration)',
      description:
        'delayDuration у TooltipProvider (или у отдельного Tooltip) — пауза перед показом, мс. По умолчанию 0 — и у TooltipProvider кита, и у провайдера, который Tooltip ставит сам.',
      render: () => (
        <TooltipProvider delayDuration={600}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Задержка 600мс</Button>
            </TooltipTrigger>
            <TooltipContent>Показался с задержкой</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      code: `<TooltipProvider delayDuration={600}>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline">Задержка 600мс</Button>
    </TooltipTrigger>
    <TooltipContent>Показался с задержкой</TooltipContent>
  </Tooltip>
</TooltipProvider>`,
    },
  ],
  props: [
    {
      name: 'TooltipProvider',
      type: 'Radix Tooltip.Provider',
      description:
        'Общие настройки подсказок. Необязателен: без него Tooltip ставит провайдер сам. Один у корня приложения задаёт задержку один раз и показывает соседние подсказки без повторной задержки. delayDuration — пауза перед показом, мс (у кита 0).',
    },
    {
      name: 'Tooltip',
      type: 'Radix Tooltip.Root',
      description:
        'Одна подсказка: open + onOpenChange или defaultOpen; свой delayDuration перекрывает общий.',
    },
    {
      name: 'TooltipTrigger',
      type: 'Radix Tooltip.Trigger',
      description:
        'Элемент, при наведении или фокусе на котором появляется подсказка. По умолчанию <button>; asChild — стать своим элементом.',
    },
    {
      name: 'TooltipContent',
      type: 'Radix Tooltip.Content',
      description:
        'Текст подсказки в портале, со стрелкой. side (top по умолчанию), align, sideOffset (0).',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы TooltipContent. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
