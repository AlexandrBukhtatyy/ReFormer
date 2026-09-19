import * as React from 'react';
import { InfoIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/tooltip';
import { nextOpenOnClick } from './info-hint-toggle';

/** Props компонента {@link InfoHint}. */
export interface InfoHintProps extends Omit<React.ComponentProps<'button'>, 'content' | 'type'> {
  /** Текст подсказки. Пустая строка — компонент ничего не рендерит. */
  content: string;
  /**
   * id скрытого дубля текста. Контент Radix Tooltip живёт в Portal и отсутствует в DOM, пока тултип
   * закрыт, — сослаться на него из `aria-describedby` контрола нельзя (висячий IDREF). Дубль `hidden`:
   * по ссылке он участвует в описании контрола, но не читается повторно и не влияет на раскладку.
   */
  descriptionId?: string;
  /** Доп. CSS-класс кнопки — обычно позиционирование иконки поверх контрола. */
  className?: string;
  /** Сторона показа тултипа. По умолчанию `'top'`. */
  side?: React.ComponentProps<typeof TooltipContent>['side'];
  /** Задержка показа по наведению, мс. По умолчанию `150` — без неё тултип мигает при проезде курсора. */
  delayDuration?: number;
}

/**
 * Иконка-подсказка (i) с тултипом: наведение, фокус с клавиатуры и клик/тап (на тач-устройствах
 * штатный Radix Tooltip по тапу не открывается).
 *
 * Приносит СВОЙ `TooltipProvider`: глобального провайдера в формах нет, а компонент, приносящий свой
 * контекст, невозможно смонтировать неправильно. Кнопка никогда не `disabled` — подсказка обязана
 * читаться и у выключенного поля.
 *
 * @example Рядом с заголовком
 * ```tsx
 * import { InfoHint } from '@reformer/ui-kit';
 *
 * <h3 className="flex items-center gap-1.5">
 *   Паспортные данные <InfoHint content="Как в документе, без сокращений" />
 * </h3>
 * ```
 *
 * @example С описанием для контрола (aria-describedby)
 * ```tsx
 * const hintId = React.useId();
 *
 * <input aria-describedby={hintId} />
 * <InfoHint content="Только латиница" descriptionId={hintId} />
 * ```
 */
function InfoHint({
  content,
  descriptionId,
  side = 'top',
  delayDuration = 150,
  className,
  onClick,
  onPointerDown,
  'aria-label': ariaLabel = 'Подсказка',
  ...props
}: InfoHintProps) {
  const [open, setOpen] = React.useState(false);
  const wasOpenRef = React.useRef(false);

  if (!content) return null;

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            // type="button" обязателен: внутри <form> кнопка без типа отправила бы форму.
            type="button"
            data-slot="info-hint"
            aria-label={ariaLabel}
            className={cn(
              // Сброс border/bg/p — кнопка должна выглядеть одинаково и без Preflight.
              'relative inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
              // Зона тапа 24px без роста строки: сама кнопка 16px, иначе ряд подписи стал бы выше.
              "after:absolute after:-inset-1 after:content-['']",
              className
            )}
            {...props}
            onPointerDown={(event) => {
              onPointerDown?.(event);
              // Наш обработчик идёт раньше радиксовского — запоминаем open ДО того, как Radix закроет.
              wasOpenRef.current = open;
            }}
            onClick={(event) => {
              onClick?.(event);
              // preventDefault отключает радиксовский onClose на click (composeEventHandlers).
              // stopPropagation НЕ ставим — сломалось бы закрытие чужих поповеров.
              event.preventDefault();
              setOpen(nextOpenOnClick(event.detail, open, wasOpenRef.current));
            }}
          >
            <InfoIcon aria-hidden="true" className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          {content}
        </TooltipContent>
      </Tooltip>
      {descriptionId && (
        <span id={descriptionId} hidden>
          {content}
        </span>
      )}
    </TooltipProvider>
  );
}

export { InfoHint };
