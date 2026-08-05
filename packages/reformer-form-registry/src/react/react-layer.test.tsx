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
import {
  createJsonForm,
  defineRegistry,
  FIELD_WRAPPER,
  type ComponentRegistry,
} from '@reformer/renderer-json';
import { createFormRegistry } from '../registry';
import type { FormEntry, ResolveContext } from '../types';
import { FormRegistryProvider } from './context';
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

describe('FormRegistryProvider', () => {
  it('использование вне провайдера даёт внятную ошибку', () => {
    expect(() => renderToString(<FormOutlet id="a" />)).toThrow(/вне <FormRegistryProvider>/);
  });
});
