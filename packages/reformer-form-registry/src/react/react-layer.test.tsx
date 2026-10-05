/**
 * React-слой: синхронные ветки.
 *
 * Через `renderToString` (node, без jsdom). Эффекты в SSR не выполняются, поэтому асинхронный
 * переход `FormOutlet` из pending в ready здесь не проверяется — он покрывается пилотом на
 * playground, где форма монтируется в реальном приложении. Тут проверяется то, что от эффектов
 * не зависит: разрешение записи, ветка «нет прав», ветка ожидания и синхронная сборка формы.
 */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { FC } from 'react';
import { createModel, useFormBundleContext } from '@reformer/core';
import { defineFormBehavior, hideWhen } from '@reformer/core/behaviors';
import {
  createJsonForm,
  defineRegistry,
  FIELD_WRAPPER,
  type ComponentRegistry,
} from '@reformer/renderer-json';
import { createFormRegistry } from '../registry';
import { createSchemaCache, type SchemaCache } from '../cache';
import type { FormEntry, ResolveContext } from '../types';
import {
  FormRegistryProvider,
  useFormRegistryContext,
  type FormRegistryProviderProps,
} from './context';
import { FormOutlet, FormSlot } from './form-outlet';
import { MountedForm } from './mounted-form';
import { loadForm, type LoadedForm } from '../loader';

interface Model {
  email: string;
}

// Поле ПЕЧАТАЕТ значение: без этого ассерт не отличит модель от initial и вообще
// одно значение от другого — тест бы «проходил» при любой подстановке.
const Field: FC<{ value?: unknown }> = ({ value }) => <i>поле:{String(value ?? '')}</i>;
const Box: FC<{ children?: React.ReactNode }> = ({ children }) => <div>{children}</div>;
// Обёртка полей ОТЛИЧИМА от её отсутствия. Неотличимый `div` здесь означал бы, что
// потеря обёртки (как это уже случилось с реестром-пропом) пройдёт мимо тестов.
const MarkedWrapper: FC<{ children?: React.ReactNode }> = ({ children }) => (
  <u data-wrapped="yes">{children}</u>
);

const baseRegistry: ComponentRegistry = defineRegistry((r) => {
  r.component('Box', Box as FC);
  r.component('Input', Field);
  r.component(FIELD_WRAPPER, MarkedWrapper as FC);
});

const schema = {
  root: {
    component: '$component(Box)',
    children: [{ value: '$model(email)', component: '$component(Input)' }],
  },
} as never;

const entry = (over: Partial<FormEntry> & Pick<FormEntry, 'id'>): FormEntry => ({
  version: '1.0.0',
  owner: 'mfe',
  schema: { kind: 'inline', value: schema },
  initial: { kind: 'inline', value: { email: '' } },
  ...over,
});

const ctx = (permissions: string[] = []): ResolveContext => ({
  permissions: new Set(permissions),
  flags: new Set(),
});

function withProvider(entries: FormEntry[], context: ResolveContext, children: React.ReactNode) {
  const registry = createFormRegistry();
  registry.registerAll(entries);
  return (
    <FormRegistryProvider registry={registry} context={context} baseRegistry={baseRegistry}>
      {children}
    </FormRegistryProvider>
  );
}

describe('FormOutlet — разрешение записи', () => {
  it('ничего не рендерит, если записи нет', () => {
    const html = renderToString(
      withProvider([], ctx(), <FormOutlet id="missing" fallback={<span>грузим</span>} />)
    );
    expect(html).toBe('');
  });

  it('ничего не рендерит, если нет прав — а не пустую рамку', () => {
    const guarded = entry({ id: 'a', access: { permissions: ['admin'] } });
    const html = renderToString(
      withProvider([guarded], ctx(), <FormOutlet id="a" fallback={<span>грузим</span>} />)
    );
    expect(html).toBe('');
  });

  it('показывает fallback, пока части формы не загружены', () => {
    const html = renderToString(
      withProvider(
        [entry({ id: 'a' })],
        ctx(),
        <FormOutlet id="a" fallback={<span>грузим</span>} />
      )
    );
    expect(html).toContain('грузим');
  });
});

describe('FormSlot', () => {
  it('монтирует все доступные формы слота и отсеивает недоступные', () => {
    const open = entry({ id: 'open', placement: { slots: ['side'] } });
    const closed = entry({
      id: 'closed',
      placement: { slots: ['side'] },
      access: { permissions: ['admin'] },
    });
    const html = renderToString(
      withProvider([open, closed], ctx(), <FormSlot name="side" fallback={<b>x</b>} />)
    );
    // Один fallback — от единственной доступной формы.
    expect(html.match(/<b>x<\/b>/g)).toHaveLength(1);
  });

  it('пустой слот даёт пустую разметку', () => {
    const html = renderToString(
      withProvider([], ctx(), <FormSlot name="side" fallback={<b>x</b>} />)
    );
    expect(html).toBe('');
  });
});

describe('MountedForm — синхронная сборка', () => {
  it('строит форму из загруженного бандла и рендерит поля', () => {
    const loaded: LoadedForm<Model> = {
      schema,
      registry: baseRegistry,
      initial: { email: '' },
    };
    const html = renderToString(
      <MountedForm<Model> entry={entry({ id: 'a' }) as FormEntry<Model>} loaded={loaded} />
    );
    expect(html).toContain('поле');
  });

  it('проп model перекрывает initial записи', () => {
    // Ветка выбора модели (`model ?? makeModel() ?? initial`) раньше была не покрыта: тест
    // не передавал проп и утверждал лишь наличие слова «поле» — то есть проходил бы при ЛЮБОМ
    // поведении ветки. Теперь наблюдаем конкретное значение.
    const model = createJsonForm<Model>({
      schema,
      registry: baseRegistry,
      initial: { email: 'из-модели' },
    }).model;
    const loaded: LoadedForm<Model> = {
      schema,
      registry: baseRegistry,
      initial: { email: 'из-initial' },
    };
    const html = renderToString(
      <MountedForm<Model>
        entry={entry({ id: 'a' }) as FormEntry<Model>}
        loaded={loaded}
        model={model}
      />
    );
    expect(html).toContain('из-модели');
    expect(html).not.toContain('из-initial');
  });

  it('фабрика модели записи перекрывает initial записи', () => {
    // Средняя подветка: когда у записи заданы И makeModel, И initial (loader это допускает),
    // побеждать должна фабрика — иначе форма соберётся на данных, которых модель не ждёт.
    const loaded: LoadedForm<Model> = {
      schema,
      registry: baseRegistry,
      initial: { email: 'из-initial' },
      makeModel: () =>
        createJsonForm<Model>({ schema, registry: baseRegistry, initial: { email: 'из-фабрики' } })
          .model,
    };
    const html = renderToString(
      <MountedForm<Model> entry={entry({ id: 'a' }) as FormEntry<Model>} loaded={loaded} />
    );
    expect(html).toContain('из-фабрики');
    expect(html).not.toContain('из-initial');
  });

  it('проп initial перекрывает initial записи', () => {
    const loaded: LoadedForm<Model> = {
      schema,
      registry: baseRegistry,
      initial: { email: 'из-записи' },
    };
    const html = renderToString(
      <MountedForm<Model>
        entry={entry({ id: 'a' }) as FormEntry<Model>}
        loaded={loaded}
        initial={{ email: 'из-пропа' }}
      />
    );
    expect(html).toContain('из-пропа');
  });

  it('обёртка полей из СОСТАВНОГО реестра применяется', async () => {
    // Единственный путь, которым владеет этот пакет: loadForm компонует базовый реестр с
    // реестром записи (composeRegistries) и отдаёт составной результат ПРОПОМ. Обёртка лежит
    // только в базе, а её нужно достать через обход parent-цепочки. Если композиция потеряет
    // цепочку (как это уже было в withParent), поля отрисуются голыми — молча.
    const own = defineRegistry((r) => r.component('DomainField', Field));
    const loaded = await loadForm<Model>(
      {
        id: 'a',
        version: '1.0.0',
        owner: 'test',
        schema: { kind: 'inline', value: schema },
        registry: { kind: 'inline', value: own },
        initial: { kind: 'inline', value: { email: 'значение' } },
      } as FormEntry<Model>,
      baseRegistry
    );
    const html = renderToString(
      <MountedForm<Model> entry={entry({ id: 'a' }) as FormEntry<Model>} loaded={loaded} />
    );
    expect(html).toContain('data-wrapped="yes"');
  });
});

describe('MountedForm — единая сборка (документ формата 2)', () => {
  interface Shape {
    email: string;
    secret: string;
    address: { city: string };
  }

  /** Зонд контекста сборки: печатает, видна ли из дерева собранная валидация. */
  const BundleProbe: FC = () => {
    const bundle = useFormBundleContext<Shape>();
    return <b>{`валидация:${bundle?.validation ? 'есть' : 'нет'}`}</b>;
  };

  const registry: ComponentRegistry = defineRegistry((r) => {
    r.component('Box', Box as FC);
    r.component('Input', Field);
    r.component('BundleProbe', BundleProbe);
    r.component(FIELD_WRAPPER, MarkedWrapper as FC);
  });

  const v2 = {
    format: 2,
    parts: {
      address: { model: '$model(city)', component: '$component(Input)' },
    },
    root: {
      component: '$component(Box)',
      children: [
        { model: '$model(email)', component: '$component(Input)' },
        {
          selector: 'secret',
          component: '$component(Box)',
          children: [{ model: '$model(secret)', component: '$component(Input)' }],
        },
        { model: '$model(address)', part: '$part(address)' },
        { component: '$component(BundleProbe)' },
      ],
    },
  } as never;

  const initial: Shape = { email: 'почта', secret: 'тайна', address: { city: 'Казань' } };
  const v2Entry = entry({ id: 'v2' }) as unknown as FormEntry<Shape>;
  const loadedV2 = (over: Partial<LoadedForm<Shape>> = {}): LoadedForm<Shape> => ({
    schema: v2,
    registry,
    initial,
    ...over,
  });

  // Значение поля в SSR-разметке отделено от подписи разделителем `<!-- -->` (два текстовых
  // ребёнка) — утверждения ищут значение вместе с ним, чтобы не спутать его с другим текстом.
  it('строит форму из документа: поля, подформа и обёртка поля из реестра', () => {
    const html = renderToString(<MountedForm<Shape> entry={v2Entry} loaded={loadedV2()} />);
    expect(html).toContain('<!-- -->почта');
    expect(html).toContain('<!-- -->Казань');
    expect(html).toContain('data-wrapped="yes"');
  });

  it('проп model перекрывает фабрику модели и initial записи', () => {
    const html = renderToString(
      <MountedForm<Shape>
        entry={v2Entry}
        loaded={loadedV2({ makeModel: () => createModel<Shape>({ ...initial, email: 'фабрика' }) })}
        model={createModel<Shape>({ ...initial, email: 'из-модели' })}
      />
    );
    expect(html).toContain('<!-- -->из-модели');
    expect(html).not.toContain('фабрика');
    expect(html).not.toContain('<!-- -->почта');
  });

  it('фабрика модели записи перекрывает initial записи', () => {
    const html = renderToString(
      <MountedForm<Shape>
        entry={v2Entry}
        loaded={loadedV2({ makeModel: () => createModel<Shape>({ ...initial, email: 'фабрика' }) })}
      />
    );
    expect(html).toContain('<!-- -->фабрика');
  });

  it('правила узлов из поведения записи исполняются: скрытый узел не рисуется', () => {
    const behavior = defineFormBehavior<Shape>(({ model, schema }) => {
      hideWhen(schema.node('secret'), () => model.email !== '');
    });
    const html = renderToString(
      <MountedForm<Shape> entry={v2Entry} loaded={loadedV2({ behavior })} />
    );
    expect(html).toContain('<!-- -->почта');
    expect(html).not.toContain('тайна');
  });

  it('фабрика поведения получает настройки места монтирования', () => {
    const seen: Record<string, unknown>[] = [];
    const factory = (options: Record<string, unknown>) => {
      seen.push(options);
      return defineFormBehavior<Shape>(({ schema }) => {
        hideWhen(schema.node('secret'), () => options.hideSecret === true);
      });
    };
    const html = renderToString(
      <MountedForm<Shape>
        entry={v2Entry}
        loaded={loadedV2({ behavior: factory })}
        behaviorOptions={{ hideSecret: true }}
      />
    );
    expect(seen).toEqual([{ hideSecret: true }]);
    expect(html).not.toContain('тайна');
  });

  it('прежнее имя пропа — renderBehaviorOptions — работает; без настроек фабрика получает {}', () => {
    const seen: Record<string, unknown>[] = [];
    const factory = (options: Record<string, unknown>) => {
      seen.push(options);
      return defineFormBehavior<Shape>(() => undefined);
    };
    renderToString(
      <MountedForm<Shape>
        entry={v2Entry}
        loaded={loadedV2({ behavior: factory })}
        renderBehaviorOptions={{ legacy: 1 }}
      />
    );
    renderToString(<MountedForm<Shape> entry={v2Entry} loaded={loadedV2({ behavior: factory })} />);
    expect(seen).toEqual([{ legacy: 1 }, {}]);
  });

  it('собранная валидация доступна из дерева через контекст сборки', () => {
    const without = renderToString(<MountedForm<Shape> entry={v2Entry} loaded={loadedV2()} />);
    expect(without).toContain('валидация:нет');

    const withRules = renderToString(
      <MountedForm<Shape>
        entry={v2Entry}
        loaded={loadedV2({ validation: { steps: { secret: null } } })}
      />
    );
    expect(withRules).toContain('валидация:есть');
  });

  it('документ прежнего формата у записи единого контракта переводится и монтируется', async () => {
    const v1 = {
      root: {
        component: '$component(Box)',
        children: [{ value: '$model(email)', component: '$component(Input)' }],
      },
    } as never;
    const loaded = await loadForm<Shape>(
      {
        id: 'a',
        version: '1.0.0',
        owner: 'test',
        schema: { kind: 'inline', value: v1 },
        initial: { kind: 'inline', value: initial },
      } as FormEntry<Shape>,
      registry
    );
    const html = renderToString(<MountedForm<Shape> entry={v2Entry} loaded={loaded} />);
    expect(loaded.schema).toMatchObject({ format: 2 });
    expect(html).toContain('<!-- -->почта');
  });
});

describe('FormRegistryProvider', () => {
  it('использование вне провайдера даёт внятную ошибку', () => {
    expect(() => renderToString(<FormOutlet id="a" />)).toThrow(/вне <FormRegistryProvider>/);
  });
});

describe('FormRegistryProvider — проброс кэша и опций загрузки', () => {
  // Что «повторный монтаж не идёт в сеть», здесь не проверить: это требует эффектов, а SSR их
  // не выполняет. Проверяем звено, которого раньше не было вовсе, — что кэш и настройки
  // загрузчика доезжают до контекста, откуда их берёт EntryMount. Сквозная проверка живёт
  // в e2e витрины, где считаются реальные вызовы fetch.
  /**
   * Зонд печатает СРАВНЕНИЕ, а не значение: `cache` и `fetchImpl` в строку не сериализуются,
   * а проверять надо именно идентичность. Копия кэша означала бы второй, независимый L1 —
   * то есть молчаливый промах вместо попадания, и утверждение «кэш подключён» стало бы ложью.
   */
  const same = (actual: unknown, expected: unknown): string =>
    actual === undefined ? 'нет' : actual === expected ? 'тот-же' : 'другой';

  const Probe: FC<{ cache?: SchemaCache; fetchImpl?: typeof fetch }> = (expected) => {
    const { cache, options } = useFormRegistryContext();
    // Одной строкой, а не соседними узлами: между двумя текстовыми детьми SSR вставляет
    // разделитель `<!-- -->`, и поиск подстроки по разметке перестал бы находить очевидное.
    const line =
      `кэш:${same(cache, expected.cache)} ` +
      `preflight:${options.preflight ?? 'нет'} ` +
      `fetch:${same(options.fetchImpl, expected.fetchImpl)}`;
    return <b>{line}</b>;
  };

  const render = (props: Partial<FormRegistryProviderProps>) =>
    renderToString(
      <FormRegistryProvider
        registry={createFormRegistry()}
        context={ctx()}
        baseRegistry={baseRegistry}
        {...props}
      >
        <Probe cache={props.cache} fetchImpl={props.options?.fetchImpl} />
      </FormRegistryProvider>
    );

  it('кэш доезжает до контекста ТЕМ ЖЕ экземпляром', () => {
    const cache = createSchemaCache();
    expect(render({ cache })).toContain('кэш:тот-же');
  });

  it('кэш необязателен — без него контекст остаётся рабочим', () => {
    const html = render({});
    expect(html).toContain('кэш:нет');
    expect(html).toContain('preflight:нет');
    expect(html).toContain('fetch:нет');
  });

  it('preflight и fetchImpl доезжают до контекста', () => {
    const fetchImpl = (() => Promise.reject(new Error('не должен вызываться'))) as typeof fetch;
    const html = render({ options: { preflight: 'warn', fetchImpl } });
    expect(html).toContain('preflight:warn');
    expect(html).toContain('fetch:тот-же');
  });
});
