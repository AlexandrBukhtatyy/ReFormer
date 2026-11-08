import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Button } from '@reformer/ui-kit';
import { Info } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * Tooltip — не поле формы: подсказка на Radix Tooltip (TooltipProvider / Tooltip / TooltipTrigger /
 * TooltipContent). Tooltip работает только внутри TooltipProvider. Variants — базовая подсказка и
 * стороны, Examples — кнопка-иконка, задержка. Обёртка `<div style>` в render — рамка демо, в
 * `code` её нет.
 */
export const tooltipDocConfig: ComponentDocConfig = {
  name: 'Tooltip',
  importFrom: '@reformer/ui-kit',
  description:
    'Короткий текст при наведении или фокусе. Нужен TooltipProvider — один на приложение.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая подсказка',
      description: 'Наведите курсор на кнопку или перейдите на неё клавишей Tab.',
      render: () => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Наведи на меня</Button>
            </TooltipTrigger>
            <TooltipContent>Всплывающая подсказка</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      code: `<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline">Наведи на меня</Button>
    </TooltipTrigger>
    <TooltipContent>Всплывающая подсказка</TooltipContent>
  </Tooltip>
</TooltipProvider>`,
    },
    {
      id: 'sides',
      title: 'Сторона появления (side)',
      description:
        'side у TooltipContent — сторона появления: top (по умолчанию), right, bottom, left.',
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Информация">
                <Info />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Подробнее об этом поле</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      code: `import { Info } from 'lucide-react';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="Информация">
        <Info />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Подробнее об этом поле</TooltipContent>
  </Tooltip>
</TooltipProvider>`,
    },
    {
      id: 'delay',
      title: 'Задержка появления (delayDuration)',
      description:
        'delayDuration у TooltipProvider (или у отдельного Tooltip) — пауза перед показом, мс. У TooltipProvider кита по умолчанию 0.',
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
        'Общие настройки подсказок. Обязателен: без него Tooltip бросает ошибку. Ставится один раз у корня. delayDuration — пауза перед показом, мс (у кита 0).',
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
