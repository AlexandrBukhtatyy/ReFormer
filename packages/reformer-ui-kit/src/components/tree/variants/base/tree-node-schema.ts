import type { PropsSchema } from '@/fields/props-schema';

/**
 * JSON-описание узла дерева — общий фрагмент props-схем `Tree`, `ComboboxTree` и
 * `ComboboxTreeMulti`. Вынесен отдельным модулем, а не третьей копией: три расходящихся
 * описания одной структуры — это три разных валидатора у одного и того же значения.
 *
 * Имя файла намеренно НЕ оканчивается на `.props.ts`: `scripts/generate-meta.mjs` собирает
 * `src/meta.ts` глобом по этому суффиксу, и общий фрагмент уехал бы в публичный экспорт
 * пакета записью каталога, которой он не является.
 *
 * `children` описан массивом без `items`: узел рекурсивен, а draft-07 выразил бы это только
 * через `$ref` на собственный `definitions` — ключ, который ни валидатор DSL, ни генератор
 * каталога сегодня не разбирают. Ограничение честное и названо в описании пропа: проверяется
 * верхний уровень, вложенные узлы — нет.
 */
export const treeNodeSchema: PropsSchema = {
  type: 'object',
  required: ['id', 'label'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', description: 'Адрес узла, уникальный в пределах дерева.' },
    label: { type: 'string', description: 'Видимая подпись строки; по ней идёт поиск.' },
    kind: {
      type: 'string',
      enum: ['branch', 'leaf'],
      description: 'Ветка или лист. По умолчанию выводится из наличия children.',
    },
    children: {
      type: 'array',
      description:
        'Дети — такие же узлы (вложенность схемой не проверяется). У ветки отсутствие поля означает «уровень не прочитан».',
    },
    badge: { type: 'string', description: 'Метка справа от подписи.' },
    badgeTone: {
      type: 'string',
      enum: ['default', 'secondary', 'destructive', 'outline'],
      description: 'Тон метки.',
    },
    title: { type: 'string', description: 'Подсказка при наведении; по умолчанию label.' },
    disabled: { type: 'boolean', description: 'Строку нельзя выбрать.' },
    loading: {
      type: 'boolean',
      description: 'Уровень читается прямо сейчас — вместо треугольника спиннер.',
    },
    failed: {
      type: 'boolean',
      description: 'Уровень не прочитался — подпись становится тревожной.',
    },
  },
};

/** Отображаемый TS-тип узла для `x-doc` — один на все три схемы. */
export const TREE_NODE_DOC_TYPE = 'Array<{ id; label; kind?; children?; badge?; … }>';
