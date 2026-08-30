/**
 * Порт живого рендера формы: шов между редактором схемы и поверхностями превью.
 *
 * Проверяется именно шов, а не поверхности. Ценных ответов здесь три: форма в редакторе и форма
 * в панели выбираются ОДНИМ правилом и одним состоянием документа; контекст, который получает
 * поверхность, собран из двух половин правильно (схема и выделение — от редактора, адрес,
 * значения и находки — от превью); и падение поверхности не выходит наружу.
 *
 * @module app/live-surface.test
 */

import { describe, expect, it, vi } from 'vitest';

import { createExtensionRegistry } from '../host/primitives/extension-point';
import { createI18nService } from '../host/services/i18n/i18n';
import type { Disposable, NodeId } from '../sdk';
import { sampleSchema } from '../lib/form-model/__fixtures__/sample-schema';
import type { LiveSurfaceContext } from '../plugins/editor-schema';
import {
  createPreviewSessions,
  PreviewSurfacePoint,
  PREVIEW_MESSAGES,
  PREVIEW_PLUGIN_ID,
  type PreviewCapabilities,
  type PreviewContext,
  type PreviewSurface,
} from '../plugins/preview';
import { createFakeHost } from '../plugins/preview/testing';
import { createLiveSurfacePort } from './live-surface';

const DOC = 'fake:form/form.json';
const NOOP: Disposable = Object.freeze({ dispose: () => undefined });

/**
 * Элемент, в который «монтируют».
 *
 * Пустышка, а не настоящий узел: порт элемент не трогает вовсе — он передаёт его поверхности,
 * и это ровно то свойство, которое здесь и проверяется. DOM ради него в node-прогоне не нужен.
 */
const ELEMENT = {} as HTMLElement;

const CAPS: PreviewCapabilities = Object.freeze({
  interactive: false,
  hitTest: false,
  dragSource: false,
  executesCode: false,
  sameRealm: true,
});

/** Поверхность-двойник: запоминает контекст, которым её смонтировали. */
function fakeSurface(
  id: string,
  capabilities: Partial<PreviewCapabilities> = {}
): PreviewSurface & { seen(): PreviewContext | null } {
  let seen: PreviewContext | null = null;
  return {
    id,
    titleKey: `surface.${id}`,
    applies: () => true,
    capabilities: { ...CAPS, ...capabilities },
    mount: (_element, ctx) => {
      seen = ctx;
      return NOOP;
    },
    seen: () => seen,
  };
}

function harness(surfaces: readonly PreviewSurface[] = []) {
  const extensions = createExtensionRegistry();
  const i18n = createI18nService();
  for (const [locale, messages] of Object.entries(PREVIEW_MESSAGES)) {
    i18n.forPlugin(PREVIEW_PLUGIN_ID).contribute(locale, messages);
  }
  const view = extensions.forPlugin(PREVIEW_PLUGIN_ID);
  for (const surface of surfaces) view.contribute(PreviewSurfacePoint, surface, { id: surface.id });

  const sessions = createPreviewSessions();
  const host = createFakeHost();
  const port = createLiveSurfacePort({ host, sessions, extensions, i18n });
  return { port, sessions, extensions, host };
}

/** Контекст живого вида — та половина, которую даёт редактор схемы. */
function liveContext(overrides: Partial<LiveSurfaceContext> = {}): LiveSurfaceContext {
  return {
    schema: () => sampleSchema(),
    onDidChangeSchema: () => NOOP,
    selection: () => [],
    onDidChangeSelection: () => NOOP,
    select: () => undefined,
    ...overrides,
  };
}

describe('createLiveSurfacePort', () => {
  it('без вкладов рисовать нечем, и это видно всеми тремя ответами', () => {
    const { port } = harness();
    expect(port.available()).toBe(false);
    expect(port.chosen(DOC)).toBeNull();
    expect(port.mount(DOC, ELEMENT, liveContext())).toBeNull();
  });

  it('выбирается самая способная поверхность, а имя приходит переведённым', () => {
    const { port } = harness([fakeSurface('skeleton'), fakeSurface('runtime', { hitTest: true })]);
    const chosen = port.chosen(DOC);
    expect(chosen?.id).toBe('runtime');
    expect(chosen?.hitTest).toBe(true);
    // Словарь превью, а не редактора схемы: заголовок завёл тот, кто внёс поверхность.
    expect(chosen?.title).not.toBe('runtime');
    expect(chosen?.title).not.toBe('');
  });

  it('поверхность без заголовка называется своим идентификатором, а не пустотой', () => {
    const bare: PreviewSurface = {
      id: 'чужая',
      applies: () => true,
      capabilities: CAPS,
      mount: () => NOOP,
    };
    const { port } = harness([bare]);
    expect(port.chosen(DOC)?.title).toBe('чужая');
  });

  it('отказ источника не прячется, хотя никто ничего не выбирал', () => {
    const { port } = harness([
      fakeSurface('runtime', { hitTest: true }),
      fakeSurface('compiling', { executesCode: true }),
    ]);
    // Двойник источника исполнять код не разрешает. Переключателя нет, просить некому —
    // и именно поэтому причина обязана прийти сама: иначе валидация молчит без объяснения.
    const chosen = port.chosen(DOC);
    expect(chosen?.id).toBe('runtime');
    expect(chosen?.notice).not.toBeNull();
    expect(chosen?.notice).not.toBe('');
  });

  it('без отказа причины нет: объяснять нечего', () => {
    const { port } = harness([fakeSurface('runtime', { hitTest: true })]);
    expect(port.chosen(DOC)?.notice).toBeNull();
  });

  it('снятие поверхности с точки расширения тоже уведомляет', () => {
    const surface = fakeSurface('runtime');
    const { port, extensions } = harness();
    const contribution = extensions
      .forPlugin(PREVIEW_PLUGIN_ID)
      .contribute(PreviewSurfacePoint, surface, { id: surface.id });
    let calls = 0;
    const subscription = port.onDidChange(DOC, () => {
      calls += 1;
    });
    contribution.dispose();
    expect(calls).toBeGreaterThan(0);
    subscription.dispose();
  });
});

describe('контекст, который получает поверхность', () => {
  it('схема и выделение приходят от редактора, а не из буфера документа', () => {
    const schema = sampleSchema();
    const selection: readonly NodeId[] = Object.freeze(['a1b2c3d4']);
    const surface = fakeSurface('runtime');
    const { port } = harness([surface]);
    port.mount(DOC, ELEMENT, liveContext({ schema: () => schema, selection: () => selection }));
    const seen = surface.seen();
    expect(seen?.schema()).toBe(schema);
    expect(seen?.selection()).toBe(selection);
  });

  it('адрес документа и мок-данные достраивает композиция', () => {
    const surface = fakeSurface('runtime');
    const { port } = harness([surface]);
    port.mount(DOC, ELEMENT, liveContext());
    const seen = surface.seen();
    expect(seen?.doc.id).toBe(DOC);
    // Хранилища мок-данных в v2 нет ни у кого: поверхность синтезирует значения из схемы.
    expect(seen?.mock()).toBeNull();
  });

  it('введённые значения идут в состояние ДОКУМЕНТА, общее с панелью превью', () => {
    const surface = fakeSurface('runtime');
    const { port, sessions } = harness([surface]);
    port.mount(DOC, ELEMENT, liveContext());
    surface.seen()?.keepValues({ loanType: 'ипотека' });
    expect(sessions.storeFor(DOC).values()).toEqual({ loanType: 'ипотека' });
    expect(surface.seen()?.values()).toEqual({ loanType: 'ипотека' });
  });

  it('находки уходят и в общий свод, и во встраивающего', () => {
    const surface = fakeSurface('runtime');
    const { port, sessions } = harness([surface]);
    const messages: string[] = [];
    port.mount(
      DOC,
      ELEMENT,
      liveContext({
        report: (next) => {
          messages.push(...next);
        },
      })
    );
    surface.seen()?.report('runtime', [
      { file: '', phase: 'render', message: 'без файла' },
      { file: 'model.ts', phase: 'evaluate', message: 'с файлом' },
    ]);
    // Панель показывает те же находки — свод один.
    expect(sessions.storeFor(DOC).get().problems).toHaveLength(2);
    // Встраивающему они приходят строками: словарь превью ему не принадлежит.
    expect(messages).toEqual(['без файла', 'model.ts: с файлом']);
  });

  it('клик по форме доходит до редактора схемы, а не в состояние превью', () => {
    const surface = fakeSurface('runtime');
    const { port } = harness([surface]);
    const chosen: (readonly NodeId[])[] = [];
    port.mount(
      DOC,
      ELEMENT,
      liveContext({
        select: (ids) => {
          chosen.push(ids);
        },
      })
    );
    surface.seen()?.select(['a1b2c3d4']);
    // Выделением в редакторе владеет его сеанс: порт лишь передаёт.
    expect(chosen).toEqual([['a1b2c3d4']]);
  });

  it('упавшая поверхность не роняет того, кто её показывает', () => {
    const broken: PreviewSurface = {
      id: 'broken',
      applies: () => true,
      capabilities: CAPS,
      mount: () => {
        throw new Error('поверхность сломалась');
      },
    };
    const { port } = harness([broken]);
    // Отказ виден в журнале, а не в выводе прогона: он здесь ожидаемый, а не неожиданный.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(port.mount(DOC, ELEMENT, liveContext())).toBeNull();
      expect(errors).toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });
});
