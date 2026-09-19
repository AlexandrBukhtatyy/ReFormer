import { forwardRef, useId } from 'react';
import type {
  ComponentType,
  ForwardRefExoticComponent,
  ReactNode,
  Ref,
  RefAttributes,
} from 'react';

import { cn } from '@/lib/utils';
import { InfoHint } from '@/components/info-hint';

/**
 * Подсказка-иконка (i) у самого контрола — проп `tooltip` (общий для всех field-компонентов,
 * см. `field-common.props.ts`). Иконку у ПОДПИСИ поля рисует `FormField` из `labelTooltip`.
 *
 * Два способа подключения:
 *  - {@link withFieldTooltip} — декоратор для примитивов, которым нечего знать о подсказке: иконка
 *    ложится поверх правого края контрола (`inside`) либо встаёт справа от него (`outside`);
 *  - {@link useFieldTooltip} — для композитов, которые ставят иконку сами, в ряд со своими
 *    элементами управления (Select/Combobox/InputPassword/Checkbox/…).
 *
 * Порядок в правой зоне поля, слева направо: [крестик очистки] → [(i)] → [родные элементы контрола:
 * шеврон, глаз, скрепка]. Геометрия: иконка 16px, шаг слота 24px, отступ от края 12px.
 */

/** Проп `tooltip` контрола. Пустая строка и не-строка = подсказки нет. */
export interface FieldTooltipProps {
  /** Текст подсказки-тултипа у иконки (i) в самом контроле. */
  tooltip?: string;
}

/** Нормализует проп: подсказка есть только у непустой строки. */
export function tooltipText(tooltip: unknown): string | undefined {
  return typeof tooltip === 'string' && tooltip !== '' ? tooltip : undefined;
}

/** Склейка id в значение `aria-describedby` (пустые отбрасываются). */
export function mergeIds(...ids: Array<string | null | undefined | false>): string | undefined {
  return ids.filter(Boolean).join(' ') || undefined;
}

export interface UseFieldTooltipOptions {
  /** id контрола — основа id скрытого текста подсказки. Нет — берётся `useId()`. */
  id?: string;
  /** Входящий `aria-describedby` (от FormField): id подсказки дописывается к нему. */
  describedBy?: string;
  /** `data-testid` контрола: иконка получит `<testId>-tooltip`. */
  testId?: string;
  /** Классы позиционирования иконки. */
  className?: string;
}

export interface UseFieldTooltipResult {
  /** `aria-describedby` для контрола: входящий + id скрытого текста подсказки. */
  describedBy: string | undefined;
  /** Готовая иконка либо `null`, если подсказки нет. */
  node: ReactNode;
}

/**
 * Иконка-подсказка для композита, который размещает её сам. Хук вызывается безусловно; без текста
 * возвращает `node: null` и входящий `describedBy` как есть.
 */
export function useFieldTooltip(
  tooltip: unknown,
  { id, describedBy, testId, className }: UseFieldTooltipOptions = {}
): UseFieldTooltipResult {
  const reactId = useId();
  const text = tooltipText(tooltip);
  if (!text) return { describedBy, node: null };

  const hintId = `${id ?? reactId}-tooltip`;
  return {
    describedBy: mergeIds(describedBy, hintId),
    node: (
      <InfoHint
        content={text}
        descriptionId={hintId}
        className={className}
        data-testid={testId ? `${testId}-tooltip` : undefined}
      />
    ),
  };
}

/** Размещение иконки декоратором {@link withFieldTooltip}. */
export interface FieldTooltipPlacement {
  /** Классы обёртки вокруг контрола и иконки. */
  wrapper: string;
  /** `inside`: позиция иконки поверх контрола. У `outside` иконка — обычный flex-ребёнок. */
  icon?: string;
  /** `inside`: резерв под иконку, дописывается в `className` контрола. */
  reserve?: string;
  /**
   * Контрол не пробрасывает `aria-describedby` в DOM (react-day-picker): описание вешается на саму
   * обёртку, которая становится `role="group"`. Иначе скрытый текст подсказки остался бы ни с чем
   * не связан.
   */
  describesWrapper?: boolean;
}

const ICON_INSIDE = 'absolute top-1/2 right-3 z-10 -translate-y-1/2';

/** Input / InputMask: иконка у правого края. Нативные спиннер/индикатор даты сдвигает сам резерв. */
export const INSIDE_INPUT: FieldTooltipPlacement = {
  wrapper: 'relative w-full',
  icon: ICON_INSIDE,
  reserve: 'pr-9',
};

/** Textarea: иконка в правом верхнем углу, на уровне первой строки. */
export const INSIDE_TEXTAREA: FieldTooltipPlacement = {
  wrapper: 'relative w-full',
  icon: 'absolute top-2.5 right-3 z-10',
  reserve: 'pr-9',
};

/**
 * NativeSelect: иконка левее шеврона (он на `right-3.5`). Обёртка `w-fit` — как у самого примитива,
 * иначе иконка уехала бы к краю более широкого контейнера.
 */
export const INSIDE_NATIVE_SELECT: FieldTooltipPlacement = {
  wrapper: 'relative w-fit',
  icon: 'absolute top-1/2 right-10 z-10 -translate-y-1/2',
  reserve: 'pr-16',
};

/**
 * Button-триггер (DatePicker). Резерв — только через `has-[>svg]:`: у Button размер по умолчанию
 * несёт `has-[>svg]:px-3`, и обычный `pr-*` проигрывает ему по специфичности.
 */
export const INSIDE_BUTTON: FieldTooltipPlacement = {
  wrapper: 'relative w-full',
  icon: ICON_INSIDE,
  reserve: 'has-[>svg]:pr-9',
};

/** Контрол по содержимому, иконка по центру (InputOTP, Toggle, ToggleGroup). */
export const OUTSIDE_CENTER: FieldTooltipPlacement = { wrapper: 'flex w-fit items-center gap-2' };
/** Высокий контрол по содержимому, иконка у верха (Calendar). */
export const OUTSIDE_START: FieldTooltipPlacement = { wrapper: 'flex w-fit items-start gap-2' };
/** То же для контрола, глотающего `aria-describedby` (Calendar): описание несёт обёртка-группа. */
export const OUTSIDE_START_GROUP: FieldTooltipPlacement = {
  ...OUTSIDE_START,
  describesWrapper: true,
};
/** Контрол на всю ширину, иконка по центру (Slider). */
export const OUTSIDE_FILL: FieldTooltipPlacement = { wrapper: 'flex w-full items-center gap-2' };
/** Высокий контрол на всю ширину, иконка у верха (NativeSelectMulti, RadioGroup). */
export const OUTSIDE_FILL_START: FieldTooltipPlacement = {
  wrapper: 'flex w-full items-start gap-2',
};

/**
 * Правый кластер композитов с триггером-кнопкой (Select/Combobox): `[крестик][(i)]` левее шеврона.
 * Шеврон — flex-ребёнок триггера и остаётся у края (12px отступ + 16px иконка + 8px зазор = `right-9`).
 * Кластер прижат вправо, поэтому при появлении крестика (i) не сдвигается.
 */
export const TRAILING_CLUSTER =
  'absolute top-1/2 right-9 z-10 flex -translate-y-1/2 items-center gap-2';

/** Крестик очистки внутри {@link TRAILING_CLUSTER}. */
export const TRAILING_CLEAR =
  'flex cursor-pointer border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground focus:outline-none';

/**
 * Резерв под кластер у Button-триггера — margin шеврона по числу иконок в кластере. Именно margin:
 * `pr-*` на Button мёртв (его перебивает `has-[>svg]:px-3` размера по умолчанию).
 */
export const CHEVRON_RESERVE = ['ml-2', 'ml-8', 'ml-14'] as const;

/**
 * Резерв под кластер у `SelectTrigger` — margin значения (сам триггер — дословный порт, шеврон в нём
 * не достать). Margin, а не padding: при `overflow:hidden` текст клипуется по padding-box и залез бы
 * под иконки.
 */
export const SELECT_VALUE_RESERVE = [
  undefined,
  '*:data-[slot=select-value]:mr-6',
  '*:data-[slot=select-value]:mr-12',
] as const;

type DecoratedProps = Record<string, unknown> & { ref?: Ref<unknown> };

function FieldTooltipShell({
  Primitive,
  placement,
  text,
  innerRef,
  rest,
}: {
  Primitive: ComponentType<DecoratedProps>;
  placement: FieldTooltipPlacement;
  text: string;
  innerRef: Ref<unknown>;
  rest: Record<string, unknown>;
}) {
  const { describedBy, node } = useFieldTooltip(text, {
    id: rest.id as string | undefined,
    describedBy: rest['aria-describedby'] as string | undefined,
    testId: rest['data-testid'] as string | undefined,
    className: placement.icon,
  });

  return (
    <div
      data-slot="field-tooltip"
      className={placement.wrapper}
      {...(placement.describesWrapper ? { role: 'group', 'aria-describedby': describedBy } : {})}
    >
      <Primitive
        {...rest}
        ref={innerRef}
        aria-describedby={describedBy}
        className={
          placement.reserve
            ? cn(rest.className as string | undefined, placement.reserve)
            : rest.className
        }
      />
      {node}
    </div>
  );
}

/**
 * Декоратор: добавляет примитиву проп `tooltip`. Применяется ДО `withFormControl`:
 * `withFormControl(withFieldTooltip(Input, INSIDE_INPUT), nativeInputAdapter)`.
 *
 * - Без подсказки (нет пропа / пустая строка) рендерит голый примитив — ни хуков, ни обёртки:
 *   DOM побайтно прежний, существующие снапшоты и SSR-тесты не меняются.
 * - `ref` уходит на примитив — baseline `FieldHandle` HOC по-прежнему строится из его DOM-узла.
 * - id скрытого текста подсказки дописывается к входящему `aria-describedby`.
 * - `displayName` примитива сохраняется: `Field(Input)` остаётся `Field(Input)`.
 *
 * Дословные порты shadcn (`variants/base/*-base.tsx`) при этом не меняются — декорация живёт
 * в `*.field.tsx`, как презентационные обёртки Checkbox/Switch/RadioGroup.
 */
export function withFieldTooltip<P extends object>(
  Primitive: ComponentType<P>,
  placement: FieldTooltipPlacement
): ForwardRefExoticComponent<P & FieldTooltipProps & RefAttributes<unknown>> {
  const Inner = Primitive as unknown as ComponentType<DecoratedProps>;

  const Decorated = forwardRef<unknown, Record<string, unknown>>(function Decorated(props, ref) {
    const { tooltip, ...rest } = props;
    const text = tooltipText(tooltip);
    if (!text) return <Inner {...rest} ref={ref} />;
    return (
      <FieldTooltipShell
        Primitive={Inner}
        placement={placement}
        text={text}
        innerRef={ref}
        rest={rest}
      />
    );
  });
  Decorated.displayName = Primitive.displayName ?? Primitive.name ?? 'Component';
  return Decorated as unknown as ForwardRefExoticComponent<
    P & FieldTooltipProps & RefAttributes<unknown>
  >;
}
