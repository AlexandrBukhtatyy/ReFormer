import {
  DirectionProvider,
  useDirection,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Button,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Direction — не form-control, provider: тонкая обёртка над Radix Direction.DirectionProvider.
 * Задаёт направление письма (LTR/RTL) через React-контекст для всех Radix-примитивов внутри
 * (Select, Tooltip, Slider, …) — они читают его через useDirection и разворачивают раскладку.
 * Собственную DOM-обёртку не рендерит. Таб Variants показывает эффект dir на разметке,
 * Examples — оборачивание приложения и хук useDirection, API — части провайдера.
 */

/** Демонстрация: строка, физически разворачивающаяся по текущему направлению из контекста. */
function DirRow() {
  const dir = useDirection();
  return (
    <div
      dir={dir}
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: 12,
        border: '1px solid var(--ifm-color-emphasis-300, #ccc)',
        borderRadius: 6,
      }}
    >
      <span style={{ fontWeight: 600 }}>dir = {dir}</span>
      <span>①</span>
      <span>②</span>
      <span>③</span>
    </div>
  );
}

export const directionDocConfig: ComponentDocConfig = {
  name: 'DirectionProvider',
  importFrom: '@reformer/ui-kit',
  description:
    'Провайдер направления письма (LTR/RTL) на shadcn / Radix. Оберните приложение (или поддерево) один раз — вложенные Radix-примитивы (Select, Tooltip, Slider и др.) подхватят направление из контекста через useDirection. Собственной DOM-обёртки не создаёт.',
  variants: [
    {
      id: 'rtl',
      title: 'RTL — справа налево',
      description:
        'dir="rtl" разворачивает раскладку потомков. Элементы ①②③ выстраиваются справа налево.',
      render: () => (
        <DirectionProvider dir="rtl">
          <DirRow />
        </DirectionProvider>
      ),
      code: `<DirectionProvider dir="rtl">
  {/* потомки, читающие направление через useDirection */}
  <MyRtlAwareComponent />
</DirectionProvider>`,
    },
    {
      id: 'ltr',
      title: 'LTR — слева направо (по умолчанию)',
      description: 'dir="ltr" — обычная раскладка слева направо.',
      render: () => (
        <DirectionProvider dir="ltr">
          <DirRow />
        </DirectionProvider>
      ),
      code: `<DirectionProvider dir="ltr">
  <MyRtlAwareComponent />
</DirectionProvider>`,
    },
  ],
  examples: [
    {
      id: 'wrap-app',
      title: 'Оборачивание Radix-примитивов',
      description:
        'Оберните дерево один раз — вложенные Radix-компоненты (здесь Tooltip) наследуют направление из контекста и позиционируются с учётом RTL.',
      render: () => (
        <DirectionProvider dir="rtl">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">RTL-контекст</Button>
              </TooltipTrigger>
              <TooltipContent>Подсказка в RTL-направлении</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </DirectionProvider>
      ),
      code: `<DirectionProvider dir="rtl">
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">RTL-контекст</Button>
      </TooltipTrigger>
      <TooltipContent>Подсказка в RTL-направлении</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</DirectionProvider>`,
    },
    {
      id: 'use-direction',
      title: 'Хук useDirection',
      description:
        'useDirection() возвращает текущее направление из контекста ("ltr" по умолчанию). Позволяет собственным компонентам подстраивать раскладку.',
      render: () => (
        <DirectionProvider dir="rtl">
          <DirRow />
        </DirectionProvider>
      ),
      code: `import { useDirection } from '@reformer/ui-kit';

function MyRtlAwareComponent() {
  const dir = useDirection(); // 'ltr' | 'rtl'
  return <div dir={dir}>Направление: {dir}</div>;
}`,
    },
    {
      id: 'direction-alias',
      title: 'Алиас direction (динамический язык)',
      description:
        'Проп-алиас direction эквивалентен dir и удобен, когда направление приходит из состояния языка приложения. Если заданы оба — приоритет у direction.',
      render: () => (
        <DirectionProvider dir="ltr" direction="rtl">
          <DirRow />
        </DirectionProvider>
      ),
      code: `const dir = locale === 'ar' ? 'rtl' : 'ltr';

<DirectionProvider direction={dir}>
  <App />
</DirectionProvider>`,
    },
  ],
  props: [
    {
      name: 'DirectionProvider',
      type: 'Radix Direction.DirectionProvider',
      description:
        'Провайдер направления. Рендерит только children (без DOM-обёртки), задавая контекст направления для вложенных Radix-примитивов.',
    },
    {
      name: 'dir',
      type: "'ltr' | 'rtl'",
      description: 'Направление письма для потомков.',
    },
    {
      name: 'direction',
      type: "'ltr' | 'rtl'",
      description: 'Алиас для dir. Если заданы оба — приоритет у direction (direction ?? dir).',
    },
    {
      name: 'useDirection',
      type: '() => "ltr" | "rtl"',
      description:
        'Хук: возвращает текущее направление из контекста ("ltr" по умолчанию, если провайдера нет).',
    },
  ],
};
