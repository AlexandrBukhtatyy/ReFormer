import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схемы `Typography`. В исходнике typography — НАБОР отдельных компонентов
 * (`TypographyH1`…`TypographyMuted`, `React.ComponentProps<'tag'>`, без cva/`variant`), поэтому по
 * принципу «вариант = отдельный компонент» каждый вид текста — ОТДЕЛЬНАЯ запись каталога со своим
 * `x-registryName` (= имя экспортируемого компонента). Единственный сериализуемый проп у каждого —
 * `className` (остальное — `children`/нативные атрибуты). `children` в схеме не фигурирует.
 *
 * Все 12 схем формируются {@link textElementSchema}: генератор каталога читает `x-registryName` в
 * рантайме, а `defaultPropSchemas` собирается по всем экспортам с `x-registryName` (generate-meta).
 */

/** className-схема одного Typography-элемента (`registryName` — имя компонента, `tag` — рендер-элемент). */
function textElementSchema(registryName: string, tag: string, label: string): PropsSchema {
  return {
    type: 'object',
    additionalProperties: false,
    'x-registryName': registryName,
    properties: {
      className: {
        type: 'string',
        description: `Доп. CSS-класс для «${label}» (элемент <${tag}>, Tailwind).`,
        'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
      },
    },
  };
}

export const typographyH1PropsSchema = textElementSchema('TypographyH1', 'h1', 'Заголовок 1');
export const typographyH2PropsSchema = textElementSchema('TypographyH2', 'h2', 'Заголовок 2');
export const typographyH3PropsSchema = textElementSchema('TypographyH3', 'h3', 'Заголовок 3');
export const typographyH4PropsSchema = textElementSchema('TypographyH4', 'h4', 'Заголовок 4');
export const typographyPPropsSchema = textElementSchema('TypographyP', 'p', 'Абзац');
export const typographyBlockquotePropsSchema = textElementSchema(
  'TypographyBlockquote',
  'blockquote',
  'Цитата'
);
export const typographyListPropsSchema = textElementSchema('TypographyList', 'ul', 'Список');
export const typographyInlineCodePropsSchema = textElementSchema(
  'TypographyInlineCode',
  'code',
  'Инлайн-код'
);
export const typographyLeadPropsSchema = textElementSchema('TypographyLead', 'p', 'Лид-абзац');
export const typographyLargePropsSchema = textElementSchema('TypographyLarge', 'div', 'Крупный текст');
export const typographySmallPropsSchema = textElementSchema('TypographySmall', 'small', 'Мелкий текст');
export const typographyMutedPropsSchema = textElementSchema('TypographyMuted', 'p', 'Приглушённый текст');
