import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Tooltip — не form-control: overlay-compound над Radix Tooltip (TooltipProvider / Tooltip /
 * TooltipTrigger / TooltipContent). Всплывающая подсказка появляется при наведении / фокусе на
 * триггере. Таб Variants показывает готовые композиции (стороны появления), Examples — приёмы
 * (иконочная кнопка, asChild-триггер), API — таблица частей и ключевых props.
 */
export const tooltipDocConfig: ComponentDocConfig = {
  name: 'Tooltip',
  importFrom: '@reformer/ui-kit',
  description:
    'Всплывающая подсказка на shadcn / Radix. Compound: TooltipProvider (общий контекст задержки) + Tooltip + TooltipTrigger + TooltipContent. Оберните дерево в TooltipProvider один раз на приложение.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая подсказка',
      description: 'Триггер + Content. Наведите курсор (или сфокусируйтесь) на кнопку.',
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
      description: 'TooltipContent принимает side: top / right / bottom / left.',
      render: () => (
        <TooltipProvider>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <Tooltip key={side}>
                <TooltipTrigger asChild>
                  <Button variant="outline">{side}</Button>
                </TooltipTrigger>
                <TooltipContent side={side}>Появляюсь сверху/сбоку: {side}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      ),
      code: `<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline">right</Button>
    </TooltipTrigger>
    <TooltipContent side="right">Появляюсь справа</TooltipContent>
  </Tooltip>
</TooltipProvider>`,
    },
  ],
  examples: [
    {
      id: 'icon-button',
      title: 'Подсказка у иконочной кнопки',
      description:
        'Частый приём: иконка без подписи получает поясняющий текст в Tooltip (доступно с клавиатуры — появляется по фокусу).',
      render: () => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Информация">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
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
        'delayDuration на TooltipProvider (или отдельном Tooltip) задаёт паузу перед показом, мс. По умолчанию 0.',
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
        'Общий контекст группы подсказок (единая задержка, порядок). Оберните приложение один раз. Проп delayDuration (мс) задаёт паузу перед показом (по умолчанию 0).',
    },
    {
      name: 'Tooltip',
      type: 'Radix Tooltip.Root',
      description:
        'Обёртка одной подсказки. Управляемость: open / defaultOpen / onOpenChange; локальный delayDuration.',
    },
    {
      name: 'TooltipTrigger',
      type: 'Radix Tooltip.Trigger',
      description:
        'Элемент, при наведении / фокусе на который появляется подсказка. asChild рендерит переданного потомка (напр. Button) вместо <button>.',
    },
    {
      name: 'TooltipContent',
      type: 'Radix Tooltip.Content',
      description:
        'Всплывающее содержимое (рендерится в Portal, со стрелкой). Позиция — side (top/right/bottom/left), отступ от триггера — sideOffset (по умолчанию 0).',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у TooltipContent (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
