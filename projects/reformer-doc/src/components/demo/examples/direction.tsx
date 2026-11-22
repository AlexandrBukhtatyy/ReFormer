import { useState } from 'react';
import { Button, DirectionProvider, ScrollArea, useDirection } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * DirectionProvider — не поле формы и не разметка: React-контекст направления текста (ltr / rtl)
 * для компонентов на Radix, плюс хук useDirection. Своего DOM не рисует. Variants — Radix-компонент
 * в rtl и свой компонент на useDirection, Examples — направление от языка, API — таблица props.
 */

const LINES = [
  'Первая строка',
  'Вторая строка',
  'Третья строка',
  'Четвёртая строка',
  'Пятая строка',
  'Шестая строка',
  'Седьмая строка',
];

/** Свой компонент: читает направление из контекста и ставит его на разметку. */
function DirectionLabel() {
  const dir = useDirection(); // 'ltr' | 'rtl'
  return (
    <div dir={dir} className="flex gap-2 rounded-md border p-2 text-sm">
      <span className="font-medium">dir = {dir}</span>
      <span>①</span>
      <span>②</span>
      <span>③</span>
    </div>
  );
}

function LanguageSwitch() {
  const [lang, setLang] = useState<'ru' | 'he'>('ru');
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant="outline"
        className="w-fit"
        onClick={() => setLang(lang === 'ru' ? 'he' : 'ru')}
      >
        Язык: {lang}
      </Button>
      <DirectionProvider dir={dir}>
        <DirectionLabel />
      </DirectionProvider>
    </div>
  );
}

export const directionDocConfig: ComponentDocConfig = {
  name: 'DirectionProvider',
  importFrom: '@reformer/ui-kit',
  description:
    'Задаёт направление текста (ltr / rtl) для компонентов на Radix внутри себя. Своей разметки не рисует.',
  variants: [
    {
      id: 'radix-rtl',
      title: 'Компонент на Radix в rtl',
      description:
        'ScrollArea берёт направление из провайдера: текст прижат вправо, полоса прокрутки встала слева.',
      render: () => (
        <DirectionProvider dir="rtl">
          <ScrollArea type="always" className="h-40 w-72 rounded-md border">
            <div className="p-4 text-sm">
              {LINES.map((line) => (
                <p key={line} className="mb-3">
                  {line}
                </p>
              ))}
            </div>
          </ScrollArea>
        </DirectionProvider>
      ),
      code: `const lines = [
  'Первая строка',
  'Вторая строка',
  'Третья строка',
  'Четвёртая строка',
  'Пятая строка',
  'Шестая строка',
  'Седьмая строка',
];

<DirectionProvider dir="rtl">
  <ScrollArea type="always" className="h-40 w-72 rounded-md border">
    <div className="p-4 text-sm">
      {lines.map((line) => (
        <p key={line} className="mb-3">
          {line}
        </p>
      ))}
    </div>
  </ScrollArea>
</DirectionProvider>`,
    },
    {
      id: 'use-direction',
      title: 'Свой компонент (useDirection)',
      description:
        'useDirection() возвращает направление из контекста. Атрибут dir на разметку компонент ставит сам.',
      render: () => (
        <DirectionProvider dir="rtl">
          <DirectionLabel />
        </DirectionProvider>
      ),
      code: `function DirectionLabel() {
  const dir = useDirection(); // 'ltr' | 'rtl'
  return (
    <div dir={dir} className="flex gap-2 rounded-md border p-2 text-sm">
      <span className="font-medium">dir = {dir}</span>
      <span>①</span>
      <span>②</span>
      <span>③</span>
    </div>
  );
}

<DirectionProvider dir="rtl">
  <DirectionLabel />
</DirectionProvider>`,
    },
  ],
  examples: [
    {
      id: 'from-language',
      title: 'Направление от языка',
      description:
        'Направление выводится из языка интерфейса: иврит и арабский — rtl, остальные — ltr. DirectionLabel — из варианта «Свой компонент». Переключите язык.',
      render: LanguageSwitch,
      code: `function LanguageSwitch() {
  const [lang, setLang] = useState<'ru' | 'he'>('ru');
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant="outline"
        className="w-fit"
        onClick={() => setLang(lang === 'ru' ? 'he' : 'ru')}
      >
        Язык: {lang}
      </Button>
      <DirectionProvider dir={dir}>
        <DirectionLabel />
      </DirectionProvider>
    </div>
  );
}`,
    },
  ],
  props: [
    {
      name: 'dir',
      type: "'ltr' | 'rtl'",
      description: 'Направление текста для компонентов внутри провайдера.',
    },
    {
      name: 'direction',
      type: "'ltr' | 'rtl'",
      description: 'Второе имя того же пропа. Если заданы оба, побеждает direction.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Поддерево, которое получит направление. Обёртки в DOM провайдер не добавляет.',
    },
    {
      name: 'useDirection',
      type: "(localDir?: 'ltr' | 'rtl') => 'ltr' | 'rtl'",
      description:
        'Хук: localDir, если передан, иначе направление из ближайшего провайдера, иначе "ltr".',
    },
  ],
};
