import { ScrollArea, ScrollBar } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * ScrollArea — не поле формы: compound поверх Radix ScrollArea (ScrollArea / ScrollBar). Область
 * фиксированного размера с тонкими полосами прокрутки темы. Variants — вертикальная,
 * горизонтальная и тонкая прокрутка, Examples — длинный текст, API — таблица props.
 * Классы в render и code одни и те же: все они есть в исходниках кита, поэтому сайт их собирает.
 */

const TAGS = Array.from({ length: 24 }, (_, i) => `Тег ${i + 1}`);

const VERSIONS = [
  'v1.0.0',
  'v1.1.0',
  'v1.2.0',
  'v2.0.0-rc.1',
  'v2.0.0',
  'v2.1.0',
  'v2.2.0',
  'v3.0.0',
];

const FILES = ['model.ts', 'validation.ts', 'form.behavior.ts', 'layout.tsx', 'registry.tsx'];

export const scrollAreaDocConfig: ComponentDocConfig = {
  name: 'ScrollArea',
  importFrom: '@reformer/ui-kit',
  description:
    'Область фиксированного размера с тонкими полосами прокрутки в цветах темы вместо системных.',
  variants: [
    {
      id: 'vertical',
      title: 'Вертикальная прокрутка',
      description:
        'Размер области задают классы h-* и w-*. Вертикальная полоса у ScrollArea есть всегда.',
      render: () => (
        <ScrollArea className="h-40 w-72 rounded-md border">
          <div className="p-4">
            <div className="mb-2 text-sm font-medium">Список тегов</div>
            {TAGS.map((tag) => (
              <div key={tag} className="border-t py-1.5 text-sm">
                {tag}
              </div>
            ))}
          </div>
        </ScrollArea>
      ),
      code: `const tags = Array.from({ length: 24 }, (_, i) => \`Тег \${i + 1}\`);

<ScrollArea className="h-40 w-72 rounded-md border">
  <div className="p-4">
    <div className="mb-2 text-sm font-medium">Список тегов</div>
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
        'Горизонтальную полосу добавляют вручную: <ScrollBar orientation="horizontal" />. Без неё лишнее по ширине обрезается.',
      render: () => (
        <ScrollArea className="w-72 rounded-md border whitespace-nowrap">
          <div className="flex gap-3 p-4">
            {VERSIONS.map((version) => (
              <div
                key={version}
                className="flex size-20 flex-none items-center justify-center rounded-md border bg-muted text-sm"
              >
                {version}
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ),
      code: `const versions = ['v1.0.0', 'v1.1.0', 'v1.2.0', 'v2.0.0-rc.1', 'v2.0.0', 'v2.1.0', 'v2.2.0', 'v3.0.0'];

<ScrollArea className="w-72 rounded-md border whitespace-nowrap">
  <div className="flex gap-3 p-4">
    {versions.map((version) => (
      <div
        key={version}
        className="flex size-20 flex-none items-center justify-center rounded-md border bg-muted text-sm"
      >
        {version}
      </div>
    ))}
  </div>
  <ScrollBar orientation="horizontal" />
</ScrollArea>`,
    },
    {
      id: 'compact',
      title: 'Тонкие полосы (size="xs")',
      description:
        'size="xs" — полоса 6px вместо 10px для плотных рядов: вкладок, панелей инструментов. На ScrollArea он действует на её вертикальную полосу; добавленной ScrollBar размер задают отдельно.',
      render: () => (
        <ScrollArea type="always" size="xs" className="w-72 rounded-md border whitespace-nowrap">
          <div className="flex items-center gap-1 p-1">
            {FILES.map((file) => (
              <div key={file} className="flex-none rounded-md border px-2 py-1 text-xs">
                {file}
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" size="xs" />
        </ScrollArea>
      ),
      code: `const files = ['model.ts', 'validation.ts', 'form.behavior.ts', 'layout.tsx', 'registry.tsx'];

<ScrollArea type="always" size="xs" className="w-72 rounded-md border whitespace-nowrap">
  <div className="flex items-center gap-1 p-1">
    {files.map((file) => (
      <div key={file} className="flex-none rounded-md border px-2 py-1 text-xs">
        {file}
      </div>
    ))}
  </div>
  <ScrollBar orientation="horizontal" size="xs" />
</ScrollArea>`,
    },
  ],
  examples: [
    {
      id: 'text-block',
      title: 'Длинный текст в блоке фиксированной высоты',
      description:
        'Соглашение или журнал изменений внутри формы: блок не растягивает страницу, полоса видна всегда (type="always").',
      render: () => (
        <ScrollArea type="always" className="h-40 w-72 rounded-md border">
          <div className="p-4 text-sm leading-relaxed">
            <div className="mb-2 font-medium">Условия использования</div>
            <p className="mb-3">
              Соглашение описывает, как обрабатываются данные, которые вы вводите в форму.
            </p>
            <p className="mb-3">
              Данные хранятся только на время рассмотрения заявки и не передаются третьим лицам.
            </p>
            <p className="mb-3">
              Вы можете отозвать согласие в любой момент, написав в службу поддержки.
            </p>
            <p>Прокрутите блок до конца, чтобы прочитать все условия.</p>
          </div>
        </ScrollArea>
      ),
      code: `<ScrollArea type="always" className="h-40 w-72 rounded-md border">
  <div className="p-4 text-sm leading-relaxed">
    <div className="mb-2 font-medium">Условия использования</div>
    <p className="mb-3">
      Соглашение описывает, как обрабатываются данные, которые вы вводите в форму.
    </p>
    <p className="mb-3">
      Данные хранятся только на время рассмотрения заявки и не передаются третьим лицам.
    </p>
    <p className="mb-3">
      Вы можете отозвать согласие в любой момент, написав в службу поддержки.
    </p>
    <p>Прокрутите блок до конца, чтобы прочитать все условия.</p>
  </div>
</ScrollArea>`,
    },
  ],
  props: [
    {
      name: 'className',
      type: 'string',
      description:
        'Классы корня: размер области (h-*, w-*), рамка, скругление. Без высоты вертикальной прокрутки не будет.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Прокручиваемое содержимое. Оно рисуется во внутренней области прокрутки.',
    },
    {
      name: 'type',
      type: "'hover' | 'scroll' | 'auto' | 'always'",
      default: "'hover'",
      description:
        'Когда видны полосы: hover — при наведении и прокрутке, scroll — только во время прокрутки, auto — когда содержимое не помещается, always — всегда.',
    },
    {
      name: 'scrollHideDelay',
      type: 'number',
      default: '600',
      description: 'Через сколько миллисекунд скрыть полосы для type="hover" и type="scroll".',
    },
    {
      name: 'size',
      type: "'default' | 'xs'",
      default: "'default'",
      description:
        'Толщина полос: default — 10px, xs — 6px. На ScrollArea — для её вертикальной полосы.',
    },
    {
      name: 'dir',
      type: "'ltr' | 'rtl'",
      description:
        'Направление текста. При rtl вертикальная полоса стоит слева. По умолчанию берётся из DirectionProvider.',
    },
    {
      name: 'ScrollBar.orientation',
      type: "'vertical' | 'horizontal'",
      default: "'vertical'",
      description:
        'Ориентация добавленной полосы. Для горизонтальной прокрутки нужна ScrollBar с orientation="horizontal".',
    },
    {
      name: 'ScrollBar.size',
      type: "'default' | 'xs'",
      default: "'default'",
      description: 'Толщина добавленной полосы. Размер ScrollArea на неё не переходит.',
    },
  ],
};
