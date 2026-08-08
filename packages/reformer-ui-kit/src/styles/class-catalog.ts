/**
 * Курируемый словарь классов, который кит отдаёт билдеру для автодополнения поля `className`
 * (секция `kit.styles.classNames` в `component-catalog.json`, пишется `scripts/generate-catalog.ts`).
 *
 * Это НЕ полный набор Tailwind: v4 генерирует утилиты под запрос, перечислить их нельзя. Здесь —
 * частые утилиты layout/flex/grid/spacing/sizing/typography/границ/эффектов плюс СЕМАНТИЧЕСКИЕ
 * токены этой дизайн-системы (`bg-muted`, `text-foreground`, `border-border`…), имена которых знает
 * только кит: они объявлены в `@theme inline` в `./theme.css`. Соответствие {@link COLOR_TOKENS} и
 * темы стережёт `./class-catalog.test.ts` — иначе словарь тихо расходится с источником и начинает
 * предлагать классы, которых Tailwind не сгенерирует.
 *
 * Поле в билдере остаётся свободным вводом: словарь лишь ускоряет набор, любой кастомный класс
 * допустим.
 *
 * `id` группы СТАБИЛЕН: на него ссылается `classGroups` записи каталога и `classGroupsByRole`
 * («чем разрешено стилизовать этот компонент»). Переименование id ломает уже сгенерированные
 * каталоги — это изменение контракта, а не косметика.
 *
 * @module @reformer/ui-kit/styles/class-catalog
 */

/** Группа словаря: стабильный `id`, подпись для UI и классы в курируемом порядке. */
export interface ClassGroup {
  id: string;
  label: string;
  classes: string[];
}

/** Частые числовые шкалы spacing (padding/margin/gap/space). */
const SPACE = [
  '0',
  '0.5',
  '1',
  '1.5',
  '2',
  '2.5',
  '3',
  '4',
  '5',
  '6',
  '8',
  '10',
  '12',
  '16',
  '20',
  '24',
];

const scale = (prefix: string): string[] => SPACE.map((s) => `${prefix}-${s}`);

/** Радиусы: `--radius-*` из `@theme inline` плюс встроенные значения Tailwind. */
const RADII = ['none', 'sm', '', 'md', 'lg', 'xl', '2xl', '3xl', 'full'];

/**
 * Цветовые токены дизайн-системы — РОВНО `--color-*` из `@theme inline` (`./theme.css`).
 * Список сверяется с темой тестом: токен, которого в теме нет, дал бы мёртвую подсказку
 * (Tailwind такую утилиту не сгенерирует), а забытый токен — дырку в словаре.
 */
export const COLOR_TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'border',
  'input',
  'ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
];

/**
 * Токены, у которых осмысленна рамка. Полный перебор `COLOR_TOKENS` дал бы мусор вроде
 * `border-card-foreground` — выбор префиксов кураторский, из CSS он не выводится.
 */
const STROKE_TOKENS = ['border', 'input', 'ring', 'destructive', 'primary', 'muted'];

/** Токены, у которых осмысленно кольцо фокуса. */
const RING_TOKENS = ['ring', 'primary', 'destructive'];

/** Палитра Tailwind (подмножество оттенков для кастомных цветов вне токенов темы). */
const PALETTE = [
  'slate',
  'gray',
  'zinc',
  'red',
  'orange',
  'amber',
  'yellow',
  'green',
  'emerald',
  'blue',
  'indigo',
  'violet',
];
const SHADES = ['400', '500', '600', '700'];

/**
 * Словарь классов по группам. Порядок групп и классов внутри них — курируемый: он же порядок
 * подсказок в билдере после уплощения.
 */
export const CLASS_GROUPS: ClassGroup[] = [
  {
    id: 'layout',
    label: 'Раскладка',
    classes: [
      'block',
      'inline-block',
      'inline',
      'flex',
      'inline-flex',
      'grid',
      'inline-grid',
      'hidden',
      'contents',
      'table',
      'overflow-auto',
      'overflow-hidden',
      'overflow-scroll',
      'overflow-visible',
      'overflow-x-auto',
      'overflow-y-auto',
      'overflow-x-hidden',
      'overflow-y-hidden',
    ],
  },
  {
    id: 'flex',
    label: 'Флексбокс и выравнивание',
    classes: [
      'flex-row',
      'flex-row-reverse',
      'flex-col',
      'flex-col-reverse',
      'flex-wrap',
      'flex-nowrap',
      'flex-1',
      'flex-auto',
      'flex-initial',
      'flex-none',
      'grow',
      'grow-0',
      'shrink',
      'shrink-0',
      'items-start',
      'items-center',
      'items-end',
      'items-stretch',
      'items-baseline',
      'justify-start',
      'justify-center',
      'justify-end',
      'justify-between',
      'justify-around',
      'justify-evenly',
      'self-start',
      'self-center',
      'self-end',
      'self-stretch',
      'self-auto',
      'content-start',
      'content-center',
      'content-between',
      'place-items-center',
      'place-content-center',
    ],
  },
  {
    id: 'grid',
    label: 'Грид',
    classes: [
      'grid-cols-1',
      'grid-cols-2',
      'grid-cols-3',
      'grid-cols-4',
      'grid-cols-5',
      'grid-cols-6',
      'grid-cols-12',
      'col-span-1',
      'col-span-2',
      'col-span-3',
      'col-span-full',
      'row-span-1',
      'row-span-2',
      'grid-flow-row',
      'grid-flow-col',
      'auto-cols-fr',
      'auto-rows-fr',
    ],
  },
  {
    id: 'spacing',
    label: 'Отступы',
    classes: [
      ...scale('gap'),
      ...scale('gap-x'),
      ...scale('gap-y'),
      ...scale('p'),
      ...scale('px'),
      ...scale('py'),
      ...scale('pt'),
      ...scale('pr'),
      ...scale('pb'),
      ...scale('pl'),
      ...scale('m'),
      ...scale('mx'),
      ...scale('my'),
      ...scale('mt'),
      ...scale('mr'),
      ...scale('mb'),
      ...scale('ml'),
      'mx-auto',
      'my-auto',
      'ml-auto',
      'mr-auto',
      ...scale('space-x'),
      ...scale('space-y'),
    ],
  },
  {
    id: 'sizing',
    label: 'Размеры',
    classes: [
      'w-full',
      'w-auto',
      'w-screen',
      'w-fit',
      'w-min',
      'w-max',
      'w-px',
      'w-1/2',
      'w-1/3',
      'w-2/3',
      'w-1/4',
      'w-3/4',
      ...scale('w'),
      'h-full',
      'h-auto',
      'h-screen',
      'h-fit',
      'h-min',
      'h-max',
      'h-px',
      ...scale('h'),
      'min-w-0',
      'min-w-full',
      'min-h-0',
      'min-h-full',
      'min-h-screen',
      'max-w-none',
      'max-w-xs',
      'max-w-sm',
      'max-w-md',
      'max-w-lg',
      'max-w-xl',
      'max-w-2xl',
      'max-w-full',
      'max-w-screen-md',
      'max-h-full',
      'max-h-screen',
      'size-full',
      'size-4',
      'size-5',
      'size-6',
      'size-8',
      'size-10',
    ],
  },
  {
    id: 'position',
    label: 'Позиционирование',
    classes: [
      'relative',
      'absolute',
      'fixed',
      'sticky',
      'static',
      'inset-0',
      'inset-x-0',
      'inset-y-0',
      'top-0',
      'right-0',
      'bottom-0',
      'left-0',
      'z-0',
      'z-10',
      'z-20',
      'z-30',
      'z-40',
      'z-50',
    ],
  },
  {
    id: 'typography',
    label: 'Типографика',
    classes: [
      'text-xs',
      'text-sm',
      'text-base',
      'text-lg',
      'text-xl',
      'text-2xl',
      'text-3xl',
      'text-4xl',
      'font-normal',
      'font-medium',
      'font-semibold',
      'font-bold',
      'font-light',
      'font-mono',
      'italic',
      'uppercase',
      'lowercase',
      'capitalize',
      'normal-case',
      'truncate',
      'text-balance',
      'text-pretty',
      'text-left',
      'text-center',
      'text-right',
      'text-justify',
      'leading-none',
      'leading-tight',
      'leading-snug',
      'leading-normal',
      'leading-relaxed',
      'leading-loose',
      'tracking-tight',
      'tracking-normal',
      'tracking-wide',
      'tracking-wider',
      'underline',
      'line-through',
      'no-underline',
      'whitespace-normal',
      'whitespace-nowrap',
      'whitespace-pre',
      'tabular-nums',
      'antialiased',
    ],
  },
  {
    // Толщина рамки и скругления — здесь; ЦВЕТ рамки — в `color`. Разрешение «можно менять
    // толщину, но не палитру» осмысленно, обратное — нет.
    id: 'borders',
    label: 'Границы и скругления',
    classes: [
      'border',
      'border-0',
      'border-2',
      'border-4',
      'border-t',
      'border-r',
      'border-b',
      'border-l',
      ...RADII.map((r) => (r ? `rounded-${r}` : 'rounded')),
      'rounded-t-md',
      'rounded-b-md',
      'rounded-l-md',
      'rounded-r-md',
    ],
  },
  {
    id: 'effects',
    label: 'Эффекты',
    classes: [
      'shadow-none',
      'shadow-sm',
      'shadow',
      'shadow-md',
      'shadow-lg',
      'shadow-xl',
      'shadow-2xl',
      'shadow-inner',
      'opacity-0',
      'opacity-50',
      'opacity-70',
      'opacity-90',
      'opacity-100',
      'ring',
      'ring-1',
      'ring-2',
      'backdrop-blur',
    ],
  },
  {
    id: 'color',
    label: 'Цвета и токены темы',
    classes: [
      ...COLOR_TOKENS.map((t) => `bg-${t}`),
      ...COLOR_TOKENS.map((t) => `text-${t}`),
      ...STROKE_TOKENS.map((t) => `border-${t}`),
      ...RING_TOKENS.map((t) => `ring-${t}`),
      'text-white',
      'text-black',
      'border-transparent',
      ...PALETTE.flatMap((c) => SHADES.map((s) => `bg-${c}-${s}`)),
      ...PALETTE.flatMap((c) => SHADES.map((s) => `text-${c}-${s}`)),
    ],
  },
  {
    id: 'interactivity',
    label: 'Интерактивность',
    classes: [
      'cursor-pointer',
      'cursor-default',
      'cursor-not-allowed',
      'select-none',
      'select-text',
      'pointer-events-none',
      'pointer-events-auto',
      'transition',
      'transition-all',
      'transition-colors',
      'duration-150',
      'duration-200',
      'duration-300',
      'ease-in-out',
    ],
  },
];

/**
 * Чем разрешено стилизовать form-control: класс правит РАСПОЛОЖЕНИЕ поля в форме, но не его вид —
 * вид задаёт дизайн-система, иначе билдером можно собрать форму, не похожую на кит. Генератор
 * каталога подставляет это в `kit.styles.classGroupsByRole.field`; контейнеры ограничений не
 * получают.
 */
export const FIELD_CLASS_GROUPS = ['spacing'];
