import { useEffect, useState } from 'react';
import { Progress } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Progress — не form-control: презентационный индикатор прогресса на Radix Progress
 * (Root + Indicator). Значение задаётся пропом `value` (0..100); ширину/высоту/цвет
 * можно перекрыть через `className`. Variants — разные значения, Examples — приёмы
 * (анимация загрузки, неопределённый прогресс).
 */
export const progressDocConfig: ComponentDocConfig = {
  name: 'Progress',
  importFrom: '@reformer/ui-kit',
  description:
    'Индикатор прогресса на shadcn / Radix Progress. Заполнение задаётся числом value (0..100); role="progressbar" и aria-valuenow — из коробки.',
  variants: [
    {
      id: 'values',
      title: 'Разные значения',
      description: 'value: 0 / 25 / 50 / 75 / 100 — доля заполнения полосы.',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
          <Progress value={0} />
          <Progress value={25} />
          <Progress value={50} />
          <Progress value={75} />
          <Progress value={100} />
        </div>
      ),
      code: `<Progress value={0} />
<Progress value={25} />
<Progress value={50} />
<Progress value={75} />
<Progress value={100} />`,
    },
    {
      id: 'custom-size',
      title: 'Размер и цвет через className',
      description:
        'Высоту (h-*), скругление и цвет (bg-*) можно перекрыть через className — базовые классы мёржатся tailwind-merge.',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
          <Progress value={60} className="h-1" />
          <Progress value={60} />
          <Progress value={60} className="h-4" />
        </div>
      ),
      code: `<Progress value={60} className="h-1" />
<Progress value={60} />
<Progress value={60} className="h-4" />`,
    },
  ],
  examples: [
    {
      id: 'animated',
      title: 'Анимированная загрузка',
      description:
        'value — контролируемый проп: обновляй его из состояния (таймер, прогресс запроса), индикатор плавно доезжает (transition-all).',
      render: () => {
        function AnimatedProgress() {
          const [value, setValue] = useState(10);
          useEffect(() => {
            const id = setInterval(() => {
              setValue((v) => (v >= 100 ? 0 : v + 10));
            }, 700);
            return () => clearInterval(id);
          }, []);
          return (
            <div style={{ width: 320 }}>
              <Progress value={value} />
            </div>
          );
        }
        return <AnimatedProgress />;
      },
      code: `function AnimatedProgress() {
  const [value, setValue] = useState(10);
  useEffect(() => {
    const id = setInterval(() => {
      setValue((v) => (v >= 100 ? 0 : v + 10));
    }, 700);
    return () => clearInterval(id);
  }, []);
  return <Progress value={value} />;
}`,
    },
    {
      id: 'with-label',
      title: 'С подписью процента',
      description:
        'Progress не рисует текст — подпись добавляй рядом, синхронизируя с тем же value.',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 320 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span>Загрузка</span>
            <span>66%</span>
          </div>
          <Progress value={66} />
        </div>
      ),
      code: `<div className="flex flex-col gap-1.5">
  <div className="flex justify-between text-sm">
    <span>Загрузка</span>
    <span>66%</span>
  </div>
  <Progress value={66} />
</div>`,
    },
  ],
  props: [
    {
      name: 'value',
      type: 'number',
      description:
        'Доля заполнения в процентах (0..100). Без value индикатор скрыт (translateX(-100%)) — неопределённый прогресс.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Классы для Root (h-*, w-*, rounded-*, bg-*) — мёржатся поверх базовых (h-2 w-full rounded-full bg-primary/20) через tailwind-merge.',
    },
  ],
};
