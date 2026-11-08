import { useEffect, useState } from 'react';
import { Progress } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Progress — не поле формы: полоса прогресса на Radix Progress (Root + Indicator). Заполнение —
 * `value` в процентах (0–100), высота и цвет — `className`. Variants — значения и размеры,
 * Examples — приёмы (живое значение, подпись). Обёртка `<div style>` в render — рамка демо, в
 * `code` её нет.
 */
export const progressDocConfig: ComponentDocConfig = {
  name: 'Progress',
  importFrom: '@reformer/ui-kit',
  description: 'Полоса, заполненная на value процентов (0–100). role="progressbar" ставит Radix.',
  variants: [
    {
      id: 'values',
      title: 'Значение (value)',
      description: 'value — доля заполнения в процентах: 0, 25, 50, 75, 100.',
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
      title: 'Высота через className',
      description: 'Высоту дорожки меняет класс h-*: ваш класс перекрывает базовый h-2.',
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
      title: 'Живое значение',
      description:
        'value берут из состояния (таймер, прогресс запроса) — полоса плавно доезжает до нового значения.',
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
      title: 'Подпись и значение для скринридера',
      description:
        'Progress не рисует текст: подпись и процент ставьте рядом. aria-labelledby связывает полосу с подписью, aria-valuenow сообщает значение — компонент сам его не выставляет.',
      render: () => (
        <div className="flex w-80 flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span id="upload-label">Загрузка файла</span>
            <span>66%</span>
          </div>
          <Progress value={66} aria-labelledby="upload-label" aria-valuenow={66} />
        </div>
      ),
      code: `<div className="flex w-80 flex-col gap-1.5">
  <div className="flex justify-between text-sm">
    <span id="upload-label">Загрузка файла</span>
    <span>66%</span>
  </div>
  <Progress value={66} aria-labelledby="upload-label" aria-valuenow={66} />
</div>`,
    },
  ],
  props: [
    {
      name: 'value',
      type: 'number',
      description:
        'Заполнение в процентах, 0–100. Без value полоса пустая. В Radix не передаётся — aria-valuenow задайте сами.',
    },
    {
      name: 'max',
      type: 'number',
      default: '100',
      description:
        'Верх шкалы для Radix (aria-valuemax). На заполнение не влияет: value всегда считается процентом.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Классы дорожки: h-*, w-*, rounded-*. При конфликте Tailwind-классов побеждает ваш.',
    },
    {
      name: '...props',
      type: 'Radix Progress.Root',
      description:
        'Остальные атрибуты корня: aria-label, aria-labelledby, aria-valuenow, aria-valuetext и т. д.',
    },
  ],
};
