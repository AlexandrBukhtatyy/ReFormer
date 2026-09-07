/**
 * Выгрузка встроенного шаблона в проект — «скопируй и правь».
 *
 * ## Почему это часть фичи, а не удобство
 *
 * Пользовательские цели можно объявить и без выгрузки: положить файл, написать заголовок,
 * написать шаблон. Но чтобы написать шаблон `registry.ts`, надо знать вид (`it.registry`),
 * знать, какие импорты условны, и знать, что заглушка объявляется только при наличии хотя бы
 * одной. Это не то знание, которое человек добывает из документации быстрее, чем из ГОТОВОГО
 * файла, где всё уже стоит на местах.
 *
 * Поэтому выгрузка отдаёт ровно тот текст, который печатает билдер, с уже заполненным
 * заголовком: `id` производный, `overrides` — на исходную цель, `path`/`cls`/`order`
 * скопированы. Дальше человек меняет строку и получает свой вывод.
 *
 * ## Имя цели не спрашивается
 *
 * Оно выводится из идентификатора исходной (`codegen.registry` → `registry.eta`), а занятое
 * имя не перезаписывается молча — подбирается свободное. Перезапись здесь означала бы потерю
 * чужой работы ради экономии одного вопроса.
 *
 * @module plugins/codegen/commands/eject
 */

import { formatTargetFile } from '@/lib/codegen';
import type { ResourceId } from '@/sdk';
import type { CodegenTarget } from '../contract';
import type { CodegenHost } from '../host';
import { USER_TARGETS_DIR } from '../pipeline/user-targets';

/** Чем кончилась выгрузка. Данные, а не тост: показывает их тот, кто звал. */
export type EjectOutcome =
  /** Проект не открыт либо порт не отдаёт корень. */
  | { readonly kind: 'no-project' }
  /** Цель печатает кодом — выгружать нечего. */
  | { readonly kind: 'not-a-template'; readonly targetId: string }
  | { readonly kind: 'read-only' }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'written'; readonly id: ResourceId; readonly name: string };

/** `codegen.registry` → `registry`; `user.my-thing` → `my-thing`. */
export function slugOf(targetId: string): string {
  const tail = targetId.slice(targetId.lastIndexOf('.') + 1);
  const cleaned = tail.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned === '' ? 'target' : cleaned;
}

/** Свободное имя файла: занятое не перезаписывается. */
async function freeName(host: CodegenHost, dir: ResourceId, slug: string): Promise<string> {
  let name = `${slug}.eta`;
  for (let index = 2; await host.exists(host.resolve(dir, name)); index += 1) {
    name = `${slug}-${index}.eta`;
  }
  return name;
}

export interface EjectDeps {
  readonly host: CodegenHost;
  readonly targets: () => readonly CodegenTarget[];
}

export async function ejectTemplate(deps: EjectDeps, targetId: string): Promise<EjectOutcome> {
  const { host } = deps;
  const target = deps.targets().find((t) => t.id === targetId);
  if (target === undefined || target.template === undefined) {
    return { kind: 'not-a-template', targetId };
  }

  const root = host.projectRoot?.() ?? null;
  if (root === null) return { kind: 'no-project' };

  const dir = host.resolve(root, ...USER_TARGETS_DIR);
  const capabilities = host.sourceOf(dir);
  if (capabilities === null || !capabilities.write) return { kind: 'read-only' };

  try {
    const name = await freeName(host, dir, slugOf(target.id));
    const id = host.resolve(dir, name);
    const order = (target as { readonly order?: number }).order;
    const text = formatTargetFile(
      {
        // Свой идентификатор, а не тот же: реестр вкладов не терпит повторов, и цель,
        // назвавшаяся именем встроенной, отказала бы на активации, а не заменила её.
        id: `user.${slugOf(target.id)}`,
        overrides: target.id,
        path: target.path,
        cls: target.cls,
        ...(order === undefined ? {} : { order }),
        ...(target.regenerable === undefined ? {} : { regenerable: target.regenerable }),
      },
      target.template
    );
    await host.writeText(id, text);
    await host.save?.([id]);
    return { kind: 'written', id, name };
  } catch (error) {
    return { kind: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}
