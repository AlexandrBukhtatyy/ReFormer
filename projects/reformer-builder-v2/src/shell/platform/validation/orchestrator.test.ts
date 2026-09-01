import { describe, expect, it, vi } from 'vitest';

import { createDiagnosticsService } from '@/shell/platform/diagnostics/service';
import type { Diagnostic } from '@/shell/platform/diagnostics/types';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { makeResourceId, type ResourceRef } from '@/shell/platform/primitives/resource';
import { createDocument, type Document } from '@/shell/platform/workspace/document';
import { createModelDocument } from '@/shell/platform/workspace/model/model-document';
import {
  createLinesProvider,
  printLines,
  type LinesModel,
} from '@/shell/platform/workspace/model/testing';
import { createValidationOrchestrator, type Schedule } from './orchestrator';
import {
  asyncSource,
  ValidatorPoint,
  type ValidateContext,
  type ValidatorContribution,
} from './types';

function refFor(path: string, mediaType = 'application/json'): ResourceRef {
  return {
    id: makeResourceId('fs', path),
    sourceId: 'fs',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'file',
    mediaType,
  };
}

const schemaRef = refFor('forms/credit.json');

function diagnostic(source: string, code: string): Diagnostic {
  return { source, severity: 'error', code, target: { kind: 'resource' } };
}

/** Валидатор с одним быстрым уровнем: коды задаются снаружи, вызовы считаются. */
function fastValidator(
  id: string,
  codes: () => readonly string[]
): ValidatorContribution & { calls: ValidateContext[] } {
  const calls: ValidateContext[] = [];
  return {
    id,
    calls,
    applies: () => true,
    validate(ctx) {
      calls.push(ctx);
      return codes().map((code) => diagnostic(id, code));
    },
  };
}

/** Ручной планировщик: дорогой уровень идёт тогда, когда его отпустит тест. */
function manualSchedule(): {
  schedule: Schedule;
  pending: () => number;
  flush: () => void;
} {
  const queue: (() => void)[] = [];
  return {
    schedule: (run) => {
      queue.push(run);
      return () => {
        const at = queue.indexOf(run);
        if (at !== -1) queue.splice(at, 1);
      };
    },
    pending: () => queue.length,
    flush: () => {
      const items = [...queue];
      queue.length = 0;
      for (const run of items) run();
    },
  };
}

function setup(validators: readonly ValidatorContribution[]) {
  const registry = createExtensionRegistry();
  const plugin = registry.forPlugin('test');
  for (const validator of validators) plugin.contribute(ValidatorPoint, validator);
  const diagnostics = createDiagnosticsService();
  const timers = manualSchedule();
  const orchestrator = createValidationOrchestrator({
    extensions: registry,
    diagnostics,
    schedule: timers.schedule,
  });
  const codes = (document: Document): string[] =>
    diagnostics.get(document.id).map((item) => item.code);
  return { diagnostics, orchestrator, timers, codes };
}

describe('быстрый уровень синхронен и публикует сразу', () => {
  it('находки есть сразу после watch — ни одного таймера не потребовалось', () => {
    const validator = fastValidator('schema', () => ['schema.unknown-component']);
    const { orchestrator, timers, codes } = setup([validator]);
    const document = createDocument(schemaRef, '{}', false).document;

    orchestrator.watch(document);

    expect(codes(document)).toEqual(['schema.unknown-component']);
    // Дорогих валидаторов нет — планировать нечего.
    expect(timers.pending()).toBe(0);
  });

  it('validate возвращает находки тем же вызовом: на этом стоит гейт ассистента', () => {
    const validator = fastValidator('schema', () => ['schema.invalid']);
    const { orchestrator } = setup([validator]);
    const document = createDocument(schemaRef, '{}', false).document;

    const found = orchestrator.validate(document);

    expect(found.map((item) => item.code)).toEqual(['schema.invalid']);
    expect(found[0].source).toBe('schema');
  });

  it('гейт работает и по документу, который никто не наблюдает', () => {
    const validator = fastValidator('schema', () => ['schema.invalid']);
    const { orchestrator, diagnostics } = setup([validator]);
    const document = createDocument(schemaRef, '{}', false).document;

    expect(orchestrator.validate(document)).toHaveLength(1);
    expect(diagnostics.get(document.id)).toHaveLength(1);
  });

  it('правка буфера перепроверяет, и исправленная ошибка уходит', () => {
    let codes: string[] = ['schema.unknown-component'];
    const { orchestrator, codes: published } = setup([fastValidator('schema', () => codes)]);
    const handle = createDocument(schemaRef, '{}', false);
    orchestrator.watch(handle.document);

    codes = [];
    handle.setText('{"root":{}}');

    expect(published(handle.document)).toEqual([]);
  });

  it('источник записи переставляется оркестратором: валидатору его не вести', () => {
    const liar: ValidatorContribution = {
      id: 'schema',
      applies: () => true,
      validate: () => [diagnostic('чужое-имя', 'schema.invalid')],
    };
    const { orchestrator, diagnostics } = setup([liar]);
    const document = createDocument(schemaRef, '{}', false).document;

    // Без перестановки `publish` отверг бы запись, опубликованную не от своего имени.
    expect(() => orchestrator.watch(document)).not.toThrow();
    expect(diagnostics.get(document.id)[0].source).toBe('schema');
  });

  it('валидатор, не взявшийся за документ, не спрашивается', () => {
    const skipped = fastValidator('other', () => ['other.code']);
    const validator: ValidatorContribution = { ...skipped, applies: () => false };
    const { orchestrator, codes } = setup([validator]);
    const document = createDocument(schemaRef, '{}', false).document;

    orchestrator.watch(document);

    expect(skipped.calls).toHaveLength(0);
    expect(codes(document)).toEqual([]);
  });

  it('падение валидатора не мешает остальным', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: ValidatorContribution = {
      id: 'broken',
      applies: () => true,
      validate: () => {
        throw new Error('внутри всё плохо');
      },
    };
    const { orchestrator, codes } = setup([broken, fastValidator('schema', () => ['ok'])]);
    const document = createDocument(schemaRef, '{}', false).document;

    orchestrator.watch(document);

    expect(codes(document)).toEqual(['ok']);
    spy.mockRestore();
  });
});

describe('результаты источников', () => {
  it('разные валидаторы сосуществуют, один валидатор замещает сам себя', () => {
    let schemaCodes = ['schema.first', 'schema.second'];
    const { orchestrator, codes } = setup([
      fastValidator('schema', () => schemaCodes),
      fastValidator('rules', () => ['rules.orphan']),
    ]);
    const handle = createDocument(schemaRef, '{}', false);
    orchestrator.watch(handle.document);

    // Порядок — по имени источника: «rules» раньше «schema».
    expect(codes(handle.document)).toEqual(['rules.orphan', 'schema.first', 'schema.second']);

    schemaCodes = ['schema.first'];
    handle.setText('{"root":{}}');

    expect(codes(handle.document)).toEqual(['rules.orphan', 'schema.first']);
  });

  it('снятие наблюдения убирает опубликованное: обновлять его больше некому', () => {
    const { orchestrator, codes } = setup([fastValidator('schema', () => ['schema.invalid'])]);
    const document = createDocument(schemaRef, '{}', false).document;

    const watch = orchestrator.watch(document);
    expect(codes(document)).toHaveLength(1);

    watch.dispose();

    expect(codes(document)).toEqual([]);
  });

  it('dispose снимает все наблюдения разом', () => {
    const { orchestrator, codes } = setup([fastValidator('schema', () => ['schema.invalid'])]);
    const first = createDocument(schemaRef, '{}', false).document;
    const second = createDocument(refFor('forms/other.json'), '{}', false).document;
    orchestrator.watch(first);
    orchestrator.watch(second);

    orchestrator.dispose();

    expect(codes(first)).toEqual([]);
    expect(codes(second)).toEqual([]);
  });

  it('revalidate перепроверяет по изменившемуся МИРУ, а не документу', () => {
    // Сменился кит — сменился каталог компонентов; событием документа это не приходит.
    let codes = ['schema.unknown-component'];
    const validator = fastValidator('schema', () => codes);
    const { orchestrator, codes: published } = setup([validator]);
    const document = createDocument(schemaRef, '{}', false).document;
    orchestrator.watch(document);

    codes = [];
    orchestrator.revalidate();

    expect(published(document)).toEqual([]);
    expect(validator.calls).toHaveLength(2);
  });

  it('повторный проход по неизменившемуся документу не публикует заново', () => {
    const validator = fastValidator('schema', () => ['schema.invalid']);
    const { orchestrator } = setup([validator]);
    const document = createDocument(schemaRef, '{}', false).document;
    orchestrator.watch(document);

    // Гейт по тому же состоянию отвечает тем же — и второй раз валидатор не зовёт.
    expect(orchestrator.validate(document).map((item) => item.code)).toEqual(['schema.invalid']);
    expect(validator.calls).toHaveLength(1);
  });

  it('повторный watch не удваивает проходы', () => {
    const validator = fastValidator('schema', () => ['schema.invalid']);
    const { orchestrator } = setup([validator]);
    const handle = createDocument(schemaRef, '{}', false);

    orchestrator.watch(handle.document);
    orchestrator.watch(handle.document);
    const before = validator.calls.length;
    handle.setText('{"root":{}}');

    expect(validator.calls.length - before).toBe(1);
  });
});

describe('дорогой уровень: задержка и отмена', () => {
  /** Валидатор с одним дорогим уровнем и внешним управлением моментом ответа. */
  function slowValidator(id: string) {
    const runs: { signal: AbortSignal; resolve: (codes: readonly string[]) => void }[] = [];
    const validator: ValidatorContribution = {
      id,
      applies: () => true,
      validateAsync: (_ctx, signal) =>
        new Promise((resolve) => {
          runs.push({
            signal,
            resolve: (codes) => resolve(codes.map((code) => diagnostic(id, code))),
          });
        }),
    };
    return { validator, runs };
  }

  it('не запускается синхронно: он идёт с задержкой', () => {
    const { validator, runs } = slowValidator('types');
    const { orchestrator, timers } = setup([validator]);
    const document = createDocument(schemaRef, '{}', false).document;

    orchestrator.watch(document);

    expect(runs).toHaveLength(0);
    expect(timers.pending()).toBe(1);
  });

  it('результат вливается отдельным источником, а не поверх быстрого', async () => {
    const { validator, runs } = slowValidator('types');
    const { orchestrator, timers, diagnostics } = setup([
      validator,
      fastValidator('types', () => ['types.fast']),
    ]);
    const document = createDocument(schemaRef, '{}', false).document;

    orchestrator.watch(document);
    timers.flush();
    runs[0].resolve(['types.slow']);
    await Promise.resolve();

    // Порядок — по имени источника: «types» раньше «types#async».
    const published = diagnostics.get(document.id);
    expect(published.map((item) => item.code)).toEqual(['types.fast', 'types.slow']);
    expect(published.map((item) => item.source)).toEqual(['types', asyncSource('types')]);
  });

  it('новая правка отменяет предыдущий проход, и его результат не публикуется', async () => {
    const { validator, runs } = slowValidator('types');
    const { orchestrator, timers, diagnostics } = setup([validator]);
    const handle = createDocument(schemaRef, '{}', false);

    orchestrator.watch(handle.document);
    timers.flush();
    expect(runs).toHaveLength(1);

    handle.setText('{"root":{}}');
    expect(runs[0].signal.aborted).toBe(true);

    // Отменённый проход всё-таки досчитал — его находки относятся к тексту, которого уже нет.
    runs[0].resolve(['types.stale']);
    await Promise.resolve();
    expect(diagnostics.get(handle.document.id)).toEqual([]);

    timers.flush();
    runs[1].resolve(['types.fresh']);
    await Promise.resolve();
    expect(diagnostics.get(handle.document.id).map((item) => item.code)).toEqual(['types.fresh']);
  });

  it('правка до срабатывания задержки переносит проход, а не добавляет второй', () => {
    const { validator, runs } = slowValidator('types');
    const { orchestrator, timers } = setup([validator]);
    const handle = createDocument(schemaRef, '{}', false);

    orchestrator.watch(handle.document);
    handle.setText('{"a":1}');
    handle.setText('{"a":2}');
    timers.flush();

    expect(runs).toHaveLength(1);
  });

  it('снятие наблюдения отменяет идущий проход', () => {
    const { validator, runs } = slowValidator('types');
    const { orchestrator, timers } = setup([validator]);
    const document = createDocument(schemaRef, '{}', false).document;

    const watch = orchestrator.watch(document);
    timers.flush();
    watch.dispose();

    expect(runs[0].signal.aborted).toBe(true);
  });
});

describe('модельный документ', () => {
  const linesRef = refFor('forms/credit.lines', 'text/plain');

  function modelSetup(text: string, focused = false) {
    const buffer = createDocument(linesRef, text, false);
    const model = createModelDocument<LinesModel>({
      document: buffer.document,
      provider: createLinesProvider(),
      writeText: (next) => buffer.setText(next),
      isTextEditorFocused: () => focused,
    });
    return { buffer, model };
  }

  it('модель отдаётся валидатору, когда буфер с ней согласован', () => {
    const seen: unknown[] = [];
    const validator: ValidatorContribution = {
      id: 'lines',
      applies: () => true,
      validate: (ctx) => {
        seen.push(ctx.model());
        return [];
      },
    };
    const { orchestrator } = setup([validator]);
    const { model } = modelSetup('n1 привет');

    orchestrator.watch(model.document);

    expect(seen).toEqual([{ lines: [{ id: 'n1', text: 'привет' }] }]);
  });

  it('в расхождении модель не отдаётся: она описывает текст, которого уже нет', () => {
    const seen: unknown[] = [];
    const validator: ValidatorContribution = {
      id: 'lines',
      applies: () => true,
      validate: (ctx) => {
        seen.push(ctx.model());
        return [];
      },
    };
    const { orchestrator } = setup([validator]);
    const { buffer, model } = modelSetup('n1 привет');
    orchestrator.watch(model.document);

    buffer.setText('строка без идентификатора');

    expect(model.document.getSyncState()).toBe('diverged');
    expect(seen.at(-1)).toBeUndefined();
  });

  it('структурная правка проверяется, даже когда перерисовка буфера отложена', () => {
    const seen: unknown[] = [];
    const validator: ValidatorContribution = {
      id: 'lines',
      applies: () => true,
      validate: (ctx) => {
        seen.push(ctx.model());
        return [];
      },
    };
    const { orchestrator } = setup([validator]);
    // Текстовый редактор в фокусе — буфер за моделью не перерисовывается.
    const { buffer, model } = modelSetup('n1 привет', true);
    orchestrator.watch(model.document);

    model.apply({ type: 'insert', params: { text: 'ещё' } });

    expect(buffer.document.getText()).toBe('n1 привет');
    expect(printLines(seen.at(-1) as LinesModel)).toBe('n1 привет\nn2 ещё');
  });
});
