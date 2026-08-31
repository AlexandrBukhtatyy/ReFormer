/**
 * Дерево и выбор файла — `Tree` кита и два варианта комбобокса поверх него.
 *
 * Страница показывает две разные роли одного компонента, которые легко перепутать:
 *  - `Tree` — НЕ поле формы: у него нет `value`/`onChange` и нет `TreeField`. Это отрисовка
 *    иерархии, которой потребитель управляет по осям (раскрытие, выделение, набор) — так же,
 *    как этим управляет файловый навигатор редактора, а не форма;
 *  - `ComboboxTree`/`ComboboxTreeMulti` — уже поля: тот же `Tree` спрятан в поповер, и наружу
 *    выходит адрес узла (`string | null`) либо их набор (`string[] | null`).
 *
 * Три места, где выбор файла ломается молча, если делать «как обычно»:
 *  - у мультиварианта начальное значение `[]` вместо `null` — массив в `initial` даёт ArrayNode,
 *    `createForm` такой путь пропускает, и поля не появляется вовсе;
 *  - `model.$.assetFiles` вместо `model.signalAt('assetFiles')!` — у типа `T[]` `$` разворачивается
 *    в дерево сигналов, и запись в контейнер-прокси выглядит успешной, ничего не меняя;
 *  - `minLength(1)` как признак обязательности — он делает ранний return на `null`, а пустой
 *    выбор приходит именно как `null`. Обязательность — только `required()`.
 *
 * Ленивое дерево здесь детерминированное: уровень читается ~600 мс, а ветка `packages/private`
 * отказывает всегда — видно и спиннер, и тревожную подпись отказавшего уровня, и то, что
 * повторное раскрытие прочитанный уровень не перезапрашивает.
 */

import { useState } from 'react';
import { createCoreForm, useFormBundle, type FormModel } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { ValidationMessagesProvider, createMessageResolver } from '@reformer/cdk';
import { Tree, type TreeNode, FormField, ExampleCard, Button } from '@reformer/ui-kit';
// Combobox — тяжёлый компонент (Popover + Command у соседних вариантов), живёт только
// в сабпате, вне главного barrel. Tree, наоборот, экспортируется из корня.
import { ComboboxTreeField, ComboboxTreeMultiField } from '@reformer/ui-kit/combobox';

interface TreeDemoForm {
  /** Адрес одного узла. Пустой выбор — `null`. */
  configFile: string | null;
  /**
   * Адреса набора узлов. Тип обязан быть `string[] | null`, а начальное значение — `null`:
   * `[]` в `initial` превратилось бы в ArrayNode, и поле не построилось бы.
   */
  assetFiles: string[] | null;
}

/**
 * Объявленное дерево проекта: три уровня, адреса — настоящие пути. Адрес узла в дереве файлов
 * обязан быть полным путём, а не именем: `index.ts` лежит в каждом втором каталоге, и уникальным
 * в пределах дерева его делает только путь.
 */
const FILE_TREE: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    children: [
      {
        id: 'src/components',
        label: 'components',
        children: [
          { id: 'src/components/Button.tsx', label: 'Button.tsx' },
          { id: 'src/components/Input.tsx', label: 'Input.tsx' },
          {
            id: 'src/components/Tree.tsx',
            label: 'Tree.tsx',
            badge: 'new',
            badgeTone: 'secondary',
          },
        ],
      },
      {
        id: 'src/hooks',
        label: 'hooks',
        children: [
          { id: 'src/hooks/use-form.ts', label: 'use-form.ts' },
          { id: 'src/hooks/use-virtual-rows.ts', label: 'use-virtual-rows.ts' },
        ],
      },
      { id: 'src/main.tsx', label: 'main.tsx' },
    ],
  },
  {
    id: 'config',
    label: 'config',
    children: [
      { id: 'config/vite.config.ts', label: 'vite.config.ts' },
      { id: 'config/tsconfig.app.json', label: 'tsconfig.app.json' },
      // disabled запрещает ВЫБОР, но не осмотр: строка видна и подсказка объясняет запрет.
      {
        id: 'config/secrets.env',
        label: 'secrets.env',
        disabled: true,
        title: 'Файл с секретами: выбирать нельзя',
      },
    ],
  },
  {
    id: 'public',
    label: 'public',
    children: [
      { id: 'public/favicon.svg', label: 'favicon.svg' },
      { id: 'public/robots.txt', label: 'robots.txt' },
    ],
  },
  { id: 'package.json', label: 'package.json', badge: 'json', badgeTone: 'outline' },
];

/** Задержка чтения уровня в ленивом дереве, мс. Достаточно велика, чтобы спиннер был виден. */
const LAZY_DELAY_MS = 600;

/** Ветка, чтение которой отказывает всегда, — детерминированный сценарий «нет прав». */
const FAILING_LEVEL = 'packages/private';

/**
 * Уровни ленивого источника, ключ — адрес родителя (`''` — верхний уровень). Ветки объявляют
 * `kind: 'branch'` явно: детей у них ещё нет, и без `kind` пустой каталог был бы неотличим
 * от файла — треугольник бы не нарисовался, и раскрыть ветку стало бы нечем.
 */
const LAZY_LEVELS: Record<string, TreeNode[]> = {
  '': [
    { id: 'packages', label: 'packages', kind: 'branch' },
    { id: 'projects', label: 'projects', kind: 'branch' },
    { id: 'README.md', label: 'README.md' },
  ],
  packages: [
    { id: 'packages/core', label: 'core', kind: 'branch' },
    { id: 'packages/ui-kit', label: 'ui-kit', kind: 'branch' },
    { id: FAILING_LEVEL, label: 'private', kind: 'branch' },
  ],
  'packages/core': [
    { id: 'packages/core/package.json', label: 'package.json' },
    { id: 'packages/core/src', label: 'src', kind: 'branch' },
  ],
  'packages/core/src': [
    { id: 'packages/core/src/index.ts', label: 'index.ts' },
    { id: 'packages/core/src/model.ts', label: 'model.ts' },
  ],
  'packages/ui-kit': [
    { id: 'packages/ui-kit/package.json', label: 'package.json' },
    // Пустой уровень — не то же самое, что непрочитанный: ветка раскроется и останется пустой.
    { id: 'packages/ui-kit/generated', label: 'generated', kind: 'branch' },
  ],
  'packages/ui-kit/generated': [],
  projects: [
    { id: 'projects/playground', label: 'playground', kind: 'branch' },
    { id: 'projects/docs', label: 'docs', kind: 'branch' },
  ],
  'projects/playground': [{ id: 'projects/playground/index.html', label: 'index.html' }],
  'projects/docs': [{ id: 'projects/docs/intro.md', label: 'intro.md' }],
};

/**
 * Ленивое чтение уровня: `null` — верхний уровень. Детерминировано ради e2e — ни случайных
 * задержек, ни случайных отказов: падает ровно одна ветка, и всегда одна и та же.
 */
async function loadLazyChildren(node: TreeNode | null): Promise<readonly TreeNode[]> {
  const key = node?.id ?? '';
  await new Promise((resolve) => setTimeout(resolve, LAZY_DELAY_MS));
  if (key === FAILING_LEVEL) throw new Error(`Нет прав на чтение ${key}`);
  return LAZY_LEVELS[key] ?? [];
}

const messages = createMessageResolver({
  required: () => 'Выберите файл',
});

function buildSchema(model: FormModel<TreeDemoForm>) {
  return {
    fields: [
      {
        // Скалярное поле — `model.$.configFile` уже сигнал, `signalAt` тут не нужен.
        value: model.$.configFile,
        component: ComboboxTreeField,
        componentProps: {
          label: 'Файл конфигурации',
          // POM ждёт `data-testid="input-<testId>"`; тот же префикс уходит в дерево, и строки
          // поповера становятся `input-configFile-<адрес узла>`.
          testId: 'configFile',
          nodes: FILE_TREE,
          defaultExpandedIds: ['config'],
          placeholder: 'Выберите файл конфигурации...',
          searchPlaceholder: 'Поиск по имени файла...',
          clearable: true,
          maxRows: 10,
          required: true,
          description: 'selectable="leaf": щелчок по каталогу раскрывает его, а не выбирает',
        },
      },
      {
        // `model.signalAt(path)!`, а НЕ `model.$.assetFiles`: у поля типа `T[]` `$`-тип
        // разворачивается в ModelArraySignals, и `$.assetFiles` — контейнер-прокси, а не сигнал.
        value: model.signalAt('assetFiles')!,
        component: ComboboxTreeMultiField,
        componentProps: {
          label: 'Ресурсы сборки',
          testId: 'assetFiles',
          nodes: FILE_TREE,
          defaultExpandedIds: ['src', 'src/components'],
          placeholder: 'Выберите файлы ресурсов...',
          clearable: true,
          maxItems: 4,
          summaryThreshold: 3,
          maxRows: 12,
          required: true,
          description: 'Поповер не закрывается по выбору и не сбрасывает поиск: набор копится',
        },
      },
    ],
  };
}

// Слой валидации — отдельная схема над моделью. `minLength(1)` для набора БЕСПОЛЕЗЕН: пустой
// выбор приходит как `null`, а на `null` он делает ранний return. Обязательность — `required()`.
const treeValidation = defineValidationSchema<TreeDemoForm>(({ model }) => {
  validate(model.signalAt('configFile')!, [required()]);
  validate(model.signalAt('assetFiles')!, [required()]);
});

const INITIAL: TreeDemoForm = {
  configFile: null,
  // ВАЖНО: null, а не [] — массив в initial модель превратила бы в ArrayNode.
  assetFiles: null,
};

export default function TreeDemo() {
  const { form, model } = useFormBundle(() =>
    createCoreForm<TreeDemoForm>({ initial: { ...INITIAL }, schema: buildSchema })
  );

  const [snapshot, setSnapshot] = useState<string | null>(null);
  /** Последняя запущенная строка витрины: `preview` различает одиночный щелчок и двойной. */
  const [activated, setActivated] = useState<string | null>(null);
  /** Текст отказа чтения уровня — дерево показывает его на строке, страница дублирует словами. */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Отмеченный набор дерева — управляемая ось: хранилище остаётся у страницы. */
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  const handleValidate = async () => {
    form.markAsTouched();
    await validateModel(model, treeValidation);
  };

  const handleSnapshot = () => setSnapshot(JSON.stringify(model.get(), null, 2));

  const handleReset = () => {
    form.reset();
    setCheckedIds([]);
    setActivated(null);
    setSnapshot(null);
  };

  return (
    <ValidationMessagesProvider resolver={messages}>
      <div className="mx-auto p-6">
        <h2 className="mb-2 text-2xl font-bold">Дерево и выбор файла</h2>
        <p className="mb-6 text-gray-600">
          <code>Tree</code> — отрисовка иерархии с управляемыми осями (раскрытие, выделение, набор),
          не поле формы. Полями его делают <code>ComboboxTree</code> и{' '}
          <code>ComboboxTreeMulti</code>: значение — адрес узла <code>string | null</code> либо их
          набор <code>string[] | null</code>.
        </p>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ExampleCard
            title="Tree — витрина"
            description="Объявленное дерево, выделение курсором, запуск строки: одиночный щелчок — предпросмотр, двойной — закрепление"
            bgColor="bg-white"
            code={`<Tree
  nodes={FILE_TREE}
  defaultExpandedIds={['src', 'src/components']}
  maxRows={12}                       // высота по содержимому, дальше прокрутка
  onActivate={(node, { preview }) => open(node.id, { preview })}
/>
// Tree — не поле: value/onChange у него нет, и TreeField не существует.
// Клавиатура: стрелки (влево — свернуть/к родителю), Home/End, Enter, пробел, Escape.`}
          >
            <div data-testid="tree-showcase" className="flex flex-col gap-2">
              <Tree
                data-testid="showcase"
                aria-label="Файлы проекта"
                nodes={FILE_TREE}
                defaultExpandedIds={['src', 'src/components']}
                maxRows={12}
                className="rounded-md border"
                onActivate={(node, { preview }) =>
                  setActivated(`${node.id} (${preview ? 'предпросмотр' : 'закреплено'})`)
                }
              />
              <p className="text-xs text-gray-500" data-testid="tree-activated">
                {activated ? `Запущено: ${activated}` : 'Ничего не запущено'}
              </p>
            </div>
          </ExampleCard>

          <ExampleCard
            title="Ленивое чтение уровней"
            description="Уровень читается при первом раскрытии (~600 мс), запоминается навсегда; ветка private отказывает всегда"
            bgColor="bg-white"
            code={`<Tree
  loadChildren={(node) => api.readLevel(node?.id ?? null)} // null — верхний уровень
  onLoadError={(error, node) => setLoadError(describe(error, node))}
/>
// Свернуть и раскрыть обратно повторного запроса НЕ стоит: прочитанный уровень
// не забывается. Поиск при этом видит только прочитанное — за уровнями он не ходит.`}
          >
            <div data-testid="tree-lazy" className="flex flex-col gap-2">
              <Tree
                data-testid="lazy"
                aria-label="Ленивое дерево репозитория"
                loadChildren={loadLazyChildren}
                maxRows={10}
                className="rounded-md border"
                onLoadError={(error) =>
                  setLoadError(error instanceof Error ? error.message : String(error))
                }
              />
              <p className="text-xs text-gray-500" data-testid="tree-lazy-error">
                {loadError ? `Отказ: ${loadError}` : 'Отказов чтения не было'}
              </p>
            </div>
          </ExampleCard>

          <ExampleCard
            title="ComboboxTree в форме"
            description="Один узел; триггер показывает подпись выбранного, а у лениво прочитанного — сам адрес"
            bgColor="bg-white"
            code={`{
  value: model.$.configFile,          // скаляр — сигнал напрямую
  component: ComboboxTreeField,
  componentProps: { nodes: FILE_TREE, clearable: true, maxRows: 10 },
}
validate(model.signalAt('configFile')!, [required()]);
// Поиск в поповере — свой, не cmdk: тот при фильтрации размонтирует каталог
// вместе с детьми и переставляет узлы мимо React — иерархия этого не переживает.`}
          >
            <FormField control={form.configFile} />
          </ExampleCard>

          <ExampleCard
            title="ComboboxTreeMulti в форме"
            description="Набор узлов: чипы до трёх, дальше сводка; потолок maxItems гасит невыбранные строки"
            bgColor="bg-white"
            code={`{
  value: model.signalAt('assetFiles')!, // МАССИВ — только signalAt, не model.$
  component: ComboboxTreeMultiField,
  componentProps: { nodes: FILE_TREE, maxItems: 4, summaryThreshold: 3 },
}
validate(model.signalAt('assetFiles')!, [required()]); // не minLength(1)!
// Значение в модели: string[] | null. Пустой выбор — null, НИКОГДА [].`}
          >
            <FormField control={form.assetFiles} />
          </ExampleCard>

          <ExampleCard
            title="Набор прямо в дереве"
            description="selectionMode=multiple + checkOn=click: щелчок переключает членство, хранилище набора — снаружи"
            bgColor="bg-white"
            code={`<Tree
  selectionMode="multiple"
  checkOn="click"        // идиом списка; по умолчанию 'modifier' (Ctrl/Shift, как в навигаторе)
  selectable="leaf"
  checkedIds={checkedIds}
  onCheckedChange={setCheckedIds}
/>
// Набор («что я выбрал») и выделение («где я сейчас») — разные оси и не сводятся
// в одну: иначе клавиатура теряет точку отсчёта для диапазона.`}
          >
            <div data-testid="tree-multi" className="flex flex-col gap-2">
              <Tree
                data-testid="multi"
                aria-label="Выбор нескольких файлов"
                nodes={FILE_TREE}
                defaultExpandedIds={['src', 'src/hooks']}
                selectionMode="multiple"
                checkOn="click"
                selectable="leaf"
                checkedIds={checkedIds}
                onCheckedChange={setCheckedIds}
                maxRows={12}
                className="rounded-md border"
              />
              <p className="text-xs text-gray-500" data-testid="tree-checked">
                Отмечено: {checkedIds.length === 0 ? '—' : checkedIds.join(', ')}
              </p>
            </div>
          </ExampleCard>
        </div>

        <div className="mt-6 flex gap-2">
          <Button onClick={handleValidate} data-testid="btn-validate">
            Проверить
          </Button>
          <Button variant="outline" onClick={handleSnapshot} data-testid="btn-snapshot">
            Снимок модели
          </Button>
          <Button variant="outline" onClick={handleReset} data-testid="btn-reset">
            Сбросить
          </Button>
        </div>

        {snapshot && (
          <pre
            className="mt-4 overflow-auto rounded bg-gray-50 p-4 text-xs"
            data-testid="model-snapshot"
          >
            {snapshot}
          </pre>
        )}
      </div>
    </ValidationMessagesProvider>
  );
}
