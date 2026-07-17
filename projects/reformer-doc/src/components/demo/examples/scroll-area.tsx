import { ScrollArea, ScrollBar } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * ScrollArea — не form-control: compound поверх Radix ScrollArea (ScrollArea / ScrollBar).
 * Кастомная область прокрутки с тонкими полосами вместо нативного скроллбара. Таб Variants
 * показывает вертикальную и горизонтальную прокрутку, Examples — рецепты (список, текстовый блок),
 * props — таблица.
 */

const TAGS = Array.from({ length: 24 }, (_, i) => `Тег ${i + 1}`);

const ARTIFACTS = [
  'v1.0.0',
  'v1.1.0',
  'v1.2.0',
  'v2.0.0-rc.1',
  'v2.0.0',
  'v2.1.0',
  'v2.2.0',
  'v3.0.0',
];

export const scrollAreaDocConfig: ComponentDocConfig = {
  name: 'ScrollArea',
  importFrom: '@reformer/ui-kit',
  description:
    'Кастомная область прокрутки на shadcn / Radix ScrollArea. Тонкие полосы вместо нативного скроллбара, стилизуются токенами темы. Compound-набор: ScrollArea (обёртка + вертикальная полоса) и ScrollBar (доп. полоса, напр. горизонтальная).',
  variants: [
    {
      id: 'vertical',
      title: 'Вертикальная прокрутка',
      description:
        'Фиксированная высота через className (h-*): контент выше области прокручивается, справа появляется тонкая полоса.',
      render: () => (
        <ScrollArea className="h-52 w-64 rounded-md border" style={{ height: 208, width: 256 }}>
          <div style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Список тегов</h4>
            {TAGS.map((tag) => (
              <div
                key={tag}
                style={{
                  padding: '6px 0',
                  fontSize: 14,
                  borderTop: '1px solid var(--border, #e5e7eb)',
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </ScrollArea>
      ),
      code: `<ScrollArea className="h-52 w-64 rounded-md border">
  <div className="p-4">
    <h4 className="mb-2 text-sm font-medium">Список тегов</h4>
    {tags.map((tag) => (
      <div key={tag} className="border-t py-1.5 text-sm">
        {tag}
      </div>
    ))}
  </div>
</ScrollArea>`,
    },
    {
      id: 'horizontal',
      title: 'Горизонтальная прокрутка',
      description:
        'Для горизонтальной полосы добавьте <ScrollBar orientation="horizontal" /> внутрь ScrollArea, а контенту задайте ряд с шириной больше области.',
      render: () => (
        <ScrollArea className="w-72 rounded-md border whitespace-nowrap" style={{ width: 288 }}>
          <div style={{ display: 'flex', gap: 12, padding: 16 }}>
            {ARTIFACTS.map((v) => (
              <div
                key={v}
                style={{
                  flex: '0 0 auto',
                  width: 96,
                  height: 96,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  borderRadius: 8,
                  border: '1px solid var(--border, #e5e7eb)',
                  background: 'var(--muted, #f4f4f5)',
                }}
              >
                {v}
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ),
      code: `<ScrollArea className="w-72 rounded-md border whitespace-nowrap">
  <div className="flex gap-3 p-4">
    {versions.map((v) => (
      <div key={v} className="flex size-24 flex-none items-center justify-center rounded-md border bg-muted text-sm">
        {v}
      </div>
    ))}
  </div>
  <ScrollBar orientation="horizontal" />
</ScrollArea>`,
    },
  ],
  examples: [
    {
      id: 'text-block',
      title: 'Прокручиваемый текстовый блок',
      description:
        'Длинный текст (соглашение, changelog) в области фиксированной высоты — типовой сценарий.',
      render: () => (
        <ScrollArea className="h-48 w-80 rounded-md border" style={{ height: 192, width: 320 }}>
          <div style={{ padding: 16, fontSize: 14, lineHeight: 1.6 }}>
            <h4 style={{ margin: '0 0 8px', fontWeight: 600 }}>Условия использования</h4>
            <p style={{ margin: '0 0 12px' }}>
              Настоящее соглашение регулирует порядок использования библиотеки для построения форм
              со связанной реактивностью полей.
            </p>
            <p style={{ margin: '0 0 12px' }}>
              Компоненты ui-kit построены на shadcn / Radix с сохранением data-slot и дословным
              портом стилей. Темизация выполняется через токены темы (CSS-переменные).
            </p>
            <p style={{ margin: '0 0 12px' }}>
              Область прокрутки заменяет нативный скроллбар тонкими полосами, которые появляются при
              наведении и адаптируются к тёмной теме автоматически.
            </p>
            <p style={{ margin: 0 }}>
              Прокрутите блок, чтобы увидеть, как полоса реагирует на положение содержимого.
            </p>
          </div>
        </ScrollArea>
      ),
      code: `<ScrollArea className="h-48 w-80 rounded-md border">
  <div className="p-4 text-sm leading-relaxed">
    <h4 className="mb-2 font-medium">Условия использования</h4>
    <p className="mb-3">Настоящее соглашение регулирует…</p>
    <p className="mb-3">Компоненты ui-kit построены на shadcn / Radix…</p>
    <p>Прокрутите блок, чтобы увидеть полосу прокрутки.</p>
  </div>
</ScrollArea>`,
    },
  ],
  props: [
    {
      name: 'className',
      type: 'string',
      description:
        'Классы обёртки (ScrollArea.Root) — здесь задаётся размер области (h-*, w-*), рамка, скругление. tailwind-merge: класс вызывающего перекрывает.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description:
        'Прокручиваемое содержимое. Рендерится внутри Viewport; область скроллится, когда контент превышает её размеры.',
    },
    {
      name: 'type',
      type: "'auto' | 'always' | 'scroll' | 'hover'",
      default: "'hover'",
      description:
        'Когда показывать полосы (проп Radix Root): "hover" — при наведении, "always" — всегда, "scroll" — при прокрутке, "auto" — при переполнении.',
    },
    {
      name: 'dir',
      type: "'ltr' | 'rtl'",
      description: 'Направление текста — влияет на сторону вертикальной полосы (проп Radix Root).',
    },
    {
      name: 'orientation (ScrollBar)',
      type: "'vertical' | 'horizontal'",
      default: "'vertical'",
      description:
        'Ориентация дополнительной полосы. Для горизонтальной прокрутки добавьте <ScrollBar orientation="horizontal" /> внутрь ScrollArea.',
    },
  ],
};
