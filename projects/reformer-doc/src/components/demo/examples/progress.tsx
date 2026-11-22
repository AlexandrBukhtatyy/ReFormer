import { useEffect, useState } from 'react';
import { Progress } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Progress — не поле формы: полоса прогресса на Radix Progress (Root + Indicator). Заполнение —
 * доля `value / max` (по умолчанию max = 100), высота и цвет — `className`. Variants — значения и размеры,
 * Examples — приёмы (живое значение, подпись). Обёртка `<div style>` в render — рамка демо, в
 * `code` её нет.
 */
export const progressDocConfig: ComponentDocConfig = {
  name: 'Progress',
  importFrom: '@reformer/ui-kit',
  description:
    'Полоса, заполненная на долю value / max (по умолчанию max = 100). role="progressbar" и aria-valuenow ставит Radix.',
  variants: [
    {
      id: 'values',
      title: 'Значение (value)',
      description: 'При max по умолчанию (100) value читается как процент: 0, 25, 50, 75, 100.',
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
      id: 'max',
      title: 'Своя шкала (max)',
      description: 'value и max — в ваших единицах: 3 из 5 разделов заполняют полосу на 60 %.',
      render: () => (
        <div style={{ width: 320 }}>
          <Progress value={3} max={5} aria-label="Заполнено разделов" />
        </div>
      ),
      code: `<Progress value={3} max={5} aria-label="Заполнено разделов" />`,
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
        'Progress не рисует текст: подпись и процент ставьте рядом. aria-labelledby связывает полосу с подписью; aria-valuenow и процент в aria-valuetext компонент ставит сам.',
      render: () => (
        <div className="flex w-80 flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span id="upload-label">Загрузка файла</span>
            <span>66%</span>
          </div>
          <Progress value={66} aria-labelledby="upload-label" />
        </div>
      ),
      code: `<div className="flex w-80 flex-col gap-1.5">
  <div className="flex justify-between text-sm">
    <span id="upload-label">Загрузка файла</span>
    <span>66%</span>
  </div>
  <Progress value={66} aria-labelledby="upload-label" />
</div>`,
    },
  ],
  props: [
    {
      name: 'value',
      type: 'number',
      description:
        'Текущее значение от 0 до max. Без value (или вне шкалы) полоса пустая, прогресс неопределённый. Доходит до Radix: aria-valuenow, aria-valuetext, data-state.',
    },
    {
      name: 'max',
      type: 'number',
      default: '100',
      description:
        'Верх шкалы (aria-valuemax). Заливка — доля value / max: value={3} max={5} заполняет 60 %.',
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
        'Остальные атрибуты корня: aria-label, aria-labelledby, aria-valuetext, getValueLabel и т. д.',
    },
  ],
};
