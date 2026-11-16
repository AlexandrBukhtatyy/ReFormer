/**
 * Ленивый лист группы: нода поля создаётся при первом обращении.
 *
 * Сборка формы строит ноды по всей модели, а в мастере при монтировании видны поля одного шага —
 * ноды остальных полей (состояние, замыкания) никто не читает. Лист хранит то, что нужно ноде:
 * сигнал модели, конфиг из схемы и значение на момент сборки (к нему возвращает
 * `resetToCreation`), — а ноду строит, когда её попросят: прокси группы, реестр ручка→нода,
 * сводные сигналы группы.
 *
 * Пока ноды нет, её состояние — исходное: не тронута, не изменена, без замечаний. Поэтому
 * операции, которые это состояние только возвращают к исходному (снять касание, очистить
 * замечания, включить), лист пропускают, а читатели значения берут его из сигнала модели.
 *
 * @internal
 * @module form/nodes/lazy-leaf
 */

import type { Signal } from '@preact/signals-core';
import type { CompiledFieldNode } from '../schema/compiled';
import type { NodeScope } from '../signal-node-registry';
import { FormControlNode } from './form-control-node';

export class LazyLeaf {
  private created: FormControlNode<unknown> | undefined;

  constructor(
    /** Сигнал листа модели — значение поля. */
    readonly signal: Signal<unknown>,
    /** Узел схемы поля; без него у ноды нет конфига из схемы. */
    private readonly field: CompiledFieldNode | undefined,
    /** Значение на момент сборки формы. */
    private readonly initial: unknown,
    /** Область сборки, которой принадлежит лист: лист — сам запись реестра в узле модели. */
    readonly scope: NodeScope
  ) {}

  /** Нода уже создана? */
  get materialized(): boolean {
    return this.created !== undefined;
  }

  /** Нода поля; создаётся при первом вызове. */
  get node(): FormControlNode<unknown> {
    if (this.created === undefined) {
      const field = this.field;
      this.created = new FormControlNode<unknown>(
        field
          ? {
              valueSignal: this.signal,
              component: field.component,
              componentProps: field.source.componentProps,
              disabled: field.disabled,
            }
          : { valueSignal: this.signal },
        this.initial
      );
    }
    return this.created;
  }

  /** Нода, если уже создана. */
  peek(): FormControlNode<unknown> | undefined {
    return this.created;
  }
}

/** Ребёнок группы: готовая нода либо ленивый лист. */
export function isLazyLeaf(value: unknown): value is LazyLeaf {
  return value instanceof LazyLeaf;
}
