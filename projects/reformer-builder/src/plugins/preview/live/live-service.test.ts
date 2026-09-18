/**
 * Живой вид: шов между редактором документа и поверхностями превью.
 *
 * Проверяется именно шов, а не поверхности. Ценных ответов здесь четыре: форма выбирается ОДНИМ
 * правилом и одним состоянием документа; поверхность выбирается по провайдеру модели документа,
 * так что поверхность одного стека не берётся за документ другого; контекст, который получает
 * поверхность, собран из двух половин правильно (схема и выделение — от редактора, адрес,
 * значения и находки — от превью); и падение поверхности не выходит наружу.
 *
 * @module plugins/preview/live/live-service.test
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  Disposable,
  DocumentRef,
  LiveSurfaceContext,
  NodeId,
  PreviewCapabilities,
  PreviewContext,
  PreviewSurface,
} from '@reformer/builder-plugin-api';
import { PreviewSurfacePoint } from '../contract';
import { PREVIEW_MESSAGES } from '../messages';
import { createPreviewSessions } from '../state/sessions';
import { createFakeExtensions, createFakeHostPort, type FakeHostPortOptions } from '../testing';
import { createLiveService } from './live-service';

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

/** Словарь превью на русском: причины отказа переводит хост. */
const RU: Readonly<Record<string, string>> = PREVIEW_MESSAGES.ru ?? {};

/** Схема-образец: живому виду форма схемы безразлична, он её только передаёт. */
const SCHEMA = Object.freeze({ root: { $nodeId: 'root0001' } });

/** Поверхность-двойник: запоминает контекст, которым её смонтировали. */
function fakeSurface(
  id: string,
  capabilities: Partial<PreviewCapabilities> = {},
  applies: (doc: DocumentRef) => boolean = () => true
): PreviewSurface & { seen(): PreviewContext | null } {
  let seen: PreviewContext | null = null;
  return {
    id,
    title: () => `поверхность ${id}`,
    applies,
    capabilities: { ...CAPS, ...capabilities },
    mount: (_element, ctx) => {
      seen = ctx;
      return NOOP;
    },
    seen: () => seen,
  };
}

function harness(surfaces: readonly PreviewSurface[] = [], hostOptions: FakeHostPortOptions = {}) {
  const extensions = createFakeExtensions();
  for (const surface of surfaces) {
    extensions.contribute(PreviewSurfacePoint, surface, { id: surface.id });
  }
  const sessions = createPreviewSessions();
  const port = createLiveService({
    host: createFakeHostPort(hostOptions),
    sessions,
    extensions,
    t: (key) => RU[key] ?? key,
  });
  return { port, sessions, extensions };
}

/** Контекст живого вида — та половина, которую даёт редактор схемы. */
function liveContext(overrides: Partial<LiveSurfaceContext> = {}): LiveSurfaceContext {
  return {
    schema: () => SCHEMA,
    onDidChangeSchema: () => NOOP,
    selection: () => [],
    onDidChangeSelection: () => NOOP,
    select: () => undefined,
    ...overrides,
  };
}

describe('createLiveService', () => {
  it('без вкладов рисовать нечем, и это видно всеми тремя ответами', () => {
    const { port } = harness();
    expect(port.available()).toBe(false);
    expect(port.chosen(DOC)).toBeNull();
    expect(port.mount(DOC, ELEMENT, liveContext())).toBeNull();
  });

  it('выбирается самая способная поверхность, а имя переводит тот, кто её внёс', () => {
    const { port } = harness([fakeSurface('skeleton'), fakeSurface('runtime', { hitTest: true })]);
    const chosen = port.chosen(DOC);
    expect(chosen?.id).toBe('runtime');
    expect(chosen?.hitTest).toBe(true);
    expect(chosen?.title).toBe('поверхность runtime');
  });

  it('поверхность чужого стека за документ не берётся: выбор идёт по провайдеру модели', () => {
    // Ради этого провайдер и доходит до адреса документа: `.json` бывает схемой любого стека.
    const reformer = fakeSurface(
      'reformer',
      { hitTest: true },
      (doc) => doc.providerId === 'form.schema'
    );
    const plain = fakeSurface('plain', {}, (doc) => doc.providerId === 'plain.form');
    const { port } = harness([reformer, plain], { providerId: 'plain.form' });
    expect(port.chosen(DOC)?.id).toBe('plain');
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
    const contribution = extensions.contribute(PreviewSurfacePoint, surface, { id: surface.id });
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
    const schema = { root: { $nodeId: 'root0002' } };
    const selection: readonly NodeId[] = Object.freeze(['a1b2c3d4']);
    const surface = fakeSurface('runtime');
    const { port } = harness([surface]);
    port.mount(DOC, ELEMENT, liveContext({ schema: () => schema, selection: () => selection }));
    const seen = surface.seen();
    expect(seen?.schema()).toBe(schema);
    expect(seen?.selection()).toBe(selection);
  });

  it('адрес документа и мок-данные достраивает превью, провайдер модели — в адресе', () => {
    const surface = fakeSurface('runtime');
    const { port } = harness([surface]);
    port.mount(DOC, ELEMENT, liveContext());
    const seen = surface.seen();
    expect(seen?.doc.id).toBe(DOC);
    expect(seen?.doc.providerId).toBe('form.schema');
    // Хранилища мок-данных в v2 нет ни у кого: поверхность синтезирует значения из схемы.
    expect(seen?.mock()).toBeNull();
  });

  it('введённые значения идут в состояние ДОКУМЕНТА, общее для всех, кто его показывает', () => {
    const surface = fakeSurface('runtime');
    const { port, sessions } = harness([surface]);
    port.mount(DOC, ELEMENT, liveContext());
    surface.seen()?.keepValues({ loanType: 'ипотека' });
    expect(sessions.storeFor(DOC).values()).toEqual({ loanType: 'ипотека' });
    expect(surface.seen()?.values()).toEqual({ loanType: 'ипотека' });
  });

  it('находки уходят в общий свод и только туда', () => {
    const surface = fakeSurface('runtime');
    const { port, sessions } = harness([surface]);
    port.mount(DOC, ELEMENT, liveContext());
    surface.seen()?.report('runtime', [
      { file: '', phase: 'render', message: 'без файла' },
      { file: 'model.ts', phase: 'evaluate', message: 'с файлом', resource: 'fake:form/model.ts' },
    ]);
    // Состояние документа держит все находки — оттуда превью кладёт их в свод диагностик,
    // а свод целиком показывает панель проблем. Второго канала, к встраивающему, нет:
    // живой вид рисует находки контуром на узле, а списком их не повторяет.
    expect(sessions.storeFor(DOC).get().problems).toHaveLength(2);
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
    // Выделением в редакторе владеет его сеанс: живой вид лишь передаёт.
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

describe('опубликованная форма', () => {
  it('форму, отданную поверхностью, видит наблюдатель — и узнаёт о её смене', () => {
    const surface = fakeSurface('runtime');
    const { port } = harness([surface]);
    port.mount(DOC, ELEMENT, liveContext());
    let changes = 0;
    const subscription = port.onDidChangeForm(DOC, () => {
      changes += 1;
    });
    expect(port.formOf(DOC)).toBeNull();

    const form = { model: { marker: 'модель' } };
    surface.seen()?.publishForm?.(form);

    expect(port.formOf(DOC)).toBe(form);
    expect(changes).toBeGreaterThan(0);
    subscription.dispose();
  });
});
