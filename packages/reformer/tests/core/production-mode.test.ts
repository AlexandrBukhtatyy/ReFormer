/**
 * Ядро в production: dev-ветки (`process.env.NODE_ENV !== 'production'`) молчат, поведение то же.
 *
 * Dev-ветки ядра (поиск `NODE_ENV` по `src`):
 * - `form/schema/compile.ts` — `warn()`: ребёнок не узел и не текст, `item` не на массиве, `part`
 *   не на группе, нераспознанная привязка, неизвестные ключи узла;
 * - `form/schema/compile.ts` — сбор неизвестных ключей узла (`unknownKeys`) только вне production;
 * - `form/form-bundle.ts` — `checkSelectors`: поведение обращается к узлу, которого нет в дереве;
 *   шаги потока без узла шага;
 * - `form/validation/strategy.ts` — исключение живого прогона схемы в `console.error`;
 * - `i18n/translator.ts` — `isDev()`: битое сообщение словаря (`console.error`) и ключ без
 *   перевода, показанный как есть (`console.warn`);
 * - `model/model-nodes.ts` — `set` группы с неполным объектом (`console.warn`);
 * - `model/safe-effect.ts` — сбой отложенной записи (`console.error`).
 *
 * Каждая сцена прогоняется дважды на свежезагруженных модулях (`vi.resetModules()` + динамический
 * импорт после `vi.stubEnv`): в development она обязана задеть свою dev-ветку (иначе тест ничего
 * не доказывает), в production — ни одного `console.warn` / `console.error`, а наблюдаемый итог
 * сцены совпадает с development. `vi.stubEnv` откатывается сам (`unstubEnvs: true` в конфиге).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { tick } from '../test-utils/async';
import { InputStub, SectionStub } from '../test-utils/stubs';
import type { FormModel } from '../../src/model/types';
import type { CompiledChild } from '../../src/form/schema/compiled';

/** Модули ядра, загруженные заново — под текущим значением `NODE_ENV`. */
async function loadCore() {
  vi.resetModules();
  const model = await import('../../src/model/index');
  const bundle = await import('../../src/form/form-bundle');
  const behaviors = await import('../../src/form/behaviors');
  const validation = await import('../../src/form/validation');
  const compile = await import('../../src/form/schema/compile');
  const translator = await import('../../src/i18n/translator');
  const safeEffect = await import('../../src/model/safe-effect');
  return { model, bundle, behaviors, validation, compile, translator, safeEffect };
}

type Core = Awaited<ReturnType<typeof loadCore>>;
type Mode = 'development' | 'production';

interface Observed<R> {
  readonly outcome: R;
  readonly warn: number;
  readonly error: number;
  readonly unhandled: number;
}

/** Прогнать сцену на свежих модулях в режиме `mode` и сосчитать диагностику. */
async function observe<R>(mode: Mode, scene: (core: Core) => R | Promise<R>): Promise<Observed<R>> {
  vi.stubEnv('NODE_ENV', mode);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const unhandled = vi.fn();
  process.on('unhandledRejection', unhandled);
  try {
    const outcome = await scene(await loadCore());
    await tick();
    return {
      outcome,
      warn: warn.mock.calls.length,
      error: error.mock.calls.length,
      unhandled: unhandled.mock.calls.length,
    };
  } finally {
    process.off('unhandledRejection', unhandled);
    warn.mockRestore();
    error.mockRestore();
  }
}

/** Сцена в обоих режимах: development задевает dev-ветку, production молчит, итог один. */
async function compareModes<R>(
  scene: (core: Core) => R | Promise<R>,
  devSignals: { warn?: number; error?: number }
): Promise<void> {
  const development = await observe('development', scene);
  const production = await observe('production', scene);

  expect({ warn: development.warn, error: development.error }).toEqual({
    warn: devSignals.warn ?? 0,
    error: devSignals.error ?? 0,
  });
  expect({ warn: production.warn, error: production.error }).toEqual({ warn: 0, error: 0 });
  expect(production.unhandled).toBe(0);
  expect(production.outcome).toEqual(development.outcome);
}

/** Вид узлов-детей корня — описание итога компиляции без ссылок на модули. */
const kindsOf = (children: readonly CompiledChild[]): string[] =>
  children.map((child) => child.kind);

afterEach(() => {
  vi.restoreAllMocks();
});

// Каждая сцена дважды поднимает свежие модули (dev и prod): под нагрузкой полного прогона с
// покрытием это дольше таймаута по умолчанию (5 с).
describe('production — dev-ветки молчат, поведение то же', { timeout: 30_000 }, () => {
  it('compile: предупреждения о детях, привязках и ключах узлов', async () => {
    await compareModes(
      ({ model: { createModel }, compile: { compileSchema } }) => {
        interface Shape {
          email: string;
          address: { city: string };
        }
        const model = createModel<Shape>({ email: '', address: { city: '' } });
        const compiled = compileSchema(
          {
            component: SectionStub,
            children: [
              { model: model.$.email, component: InputStub, value: 1 }, // неизвестный ключ
              model.$.address as never, // ребёнок — группа модели, не узел
              { model: model.$.email, item: () => ({}) }, // item не на массиве
              { model: model.$.email, part: () => ({}) }, // part не на группе
              { model: 'email' as never, component: InputStub }, // привязка не распознана
            ],
          } as never,
          model
        );
        const root = compiled.root as { children: readonly CompiledChild[] };
        return { kinds: kindsOf(root.children), fields: compiled.fields.size };
      },
      { warn: 5 }
    );
  });

  it('createForm: правило на узел вне дерева и шаг потока без узла', async () => {
    await compareModes(
      ({ bundle: { createForm }, behaviors: { defineFormBehavior, hideWhen } }) => {
        interface Shape {
          email: string;
          kind: string;
        }
        const form = createForm<Shape>({
          initial: { email: '', kind: '' },
          schema: (model: FormModel<Shape>) => ({
            component: SectionStub,
            children: [
              {
                selector: 'contacts',
                component: SectionStub,
                children: [{ model: model.$.email, component: InputStub }],
              },
              {
                selector: 'details',
                component: SectionStub,
                children: [{ model: model.$.kind, component: InputStub }],
              },
            ],
          }),
          behavior: defineFormBehavior<Shape>(({ schema }) => {
            hideWhen(schema.node('нет-такого-узла'), () => true);
          }),
          flow: { steps: [{ id: 'contacts' }, { id: 'detials' }] },
        });
        return { steps: form.flow?.steps, root: form.render.tree?.root.kind };
      },
      { warn: 2 }
    );
  });

  it('стратегия: исключение живого прогона проглатывается без отклонения', async () => {
    await compareModes(
      async ({
        model: { createModel },
        validation: { createFormValidation, defineValidation },
      }) => {
        const model = createModel({ name: '' });
        const broken = defineValidation<{ name: string }>(() => {
          throw new Error('схема упала');
        });
        const controller = createFormValidation(model, broken, { strategy: 'change' });
        controller.start();

        model.name = 'Иван';
        await tick();
        controller.dispose();
        return { validating: controller.isValidating };
      },
      { error: 1 }
    );
  });

  it('i18n: битое сообщение и ключ без перевода — тот же текст', async () => {
    await compareModes(
      ({ translator: { createI18n, formatMessage } }) => {
        const i18n = createI18n({ code: 'ru', messages: { 'app.broken': '{сломано' } });
        return [
          i18n.t('app.broken'),
          i18n.t('app.missing'),
          formatMessage({ 'app.title': '{не закрыто' }, 'ru', 'app.title'),
        ];
      },
      // Разбор битого сообщения локали и шаблона formatMessage; два ключа ушли на экран как есть.
      { error: 2, warn: 2 }
    );
  });

  it('модель: set с неполным объектом оставляет прежние поля', async () => {
    await compareModes(
      ({ model: { createModel } }) => {
        const model = createModel({ name: 'Анна', city: 'Москва' });
        model.set({ name: 'Борис' } as never);
        return model.get();
      },
      { warn: 1 }
    );
  });

  it('safe-effect: сбой отложенной записи — синхронный и async — проглатывается', async () => {
    await compareModes(
      async ({ safeEffect: { runOutsideEffect } }) => {
        const written: string[] = [];
        runOutsideEffect(() => {
          throw new Error('сбой записи');
        });
        runOutsideEffect(async () => {
          throw new Error('сбой async-записи');
        });
        runOutsideEffect(() => {
          written.push('после сбоев');
        });
        await tick();
        return written;
      },
      { error: 2 }
    );
  });
});
