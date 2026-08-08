/**
 * Снапшот эквивалентности каталога — страховка перевода потребителей на дескриптор (этап 2).
 *
 * Этап 1 переносит захардкоженные таблицы билдера в `kits/legacy-reformer-ui-kit` ДАННЫМИ и вводит
 * дескриптор, но ни один потребитель ещё не переключён — поведение обязано остаться прежним.
 * Этап 2 переключает `known-components`, `render-policy`, `make-node`, `node-kind` и `codegen` на
 * чтение из дескриптора; вот тогда любое расхождение и должно всплыть здесь, а не в превью.
 *
 * Снимок берётся с ФАКТИЧЕСКИ поставляемого каталога (`@reformer/ui-kit/catalog` + синтетика
 * билдера), поэтому покрывает и категории, и восстановленный `makeNode`, и порядок записей.
 */
import { describe, expect, it } from 'vitest';
import { getCatalog } from '../catalog';
import { loadCatalogJson } from '../catalog/contract';
import { toDescriptor } from './descriptor';
import { CATEGORY_BY_NAME, LEAF_COMPONENT_NAMES, NEEDS_SHIM } from './legacy-reformer-ui-kit';

/** Стабильная сериализация JSON с сортировкой ключей — иначе снимок «дрожит» от порядка полей. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1))
      );
    }
    return v;
  });
}

/** FNV-1a: короткий отпечаток propsSchema — класть схемы целиком в снимок нечитаемо. */
function digest(value: unknown): string {
  const s = canonical(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Одна строка на запись: всё, от чего зависит палитра, инспектор и дроп. */
function fingerprint(): string[] {
  return getCatalog().map((e) =>
    [
      e.name,
      e.role,
      e.category ?? '',
      e.variantGroup ?? '',
      e.variant ?? '',
      e.compoundParent ?? '',
      e.exportName ?? '',
      e.subpath ?? '',
      digest(e.propsSchema),
      canonical(e.makeNode()),
    ].join('|')
  );
}

describe('каталог: отпечаток не меняется', () => {
  it('состав, категории и makeNode каждой записи', () => {
    expect(fingerprint()).toMatchSnapshot();
  });

  it('размер каталога зафиксирован (сдвиг = кит изменился, а не рефактор)', () => {
    expect(getCatalog().length).toMatchSnapshot();
  });
});

describe('«неявный кит» на реальном каталоге', () => {
  const d = toDescriptor(loadCatalogJson());

  it('из блока kit каталог несёт ТОЛЬКО стили — остальное по-прежнему дефолты билдера', () => {
    // Кит рассказывает о себе ровно одно: словарь классов и политику групп (их билдер вывести не
    // может). Идентификация, версия, резолв и infra по-прежнему достраиваются дефолтами — то есть
    // «неявный кит» никуда не делся, просто перестал быть буквально «каталогом без блока kit».
    const json = loadCatalogJson();
    expect(Object.keys(json.kit ?? {})).toEqual(['styles']);
    expect(Object.keys(json.kit!.styles!).sort()).toEqual(['classGroupsByRole', 'classNames']);
    expect(d.id).toBe('reformer-ui-kit');
    expect(d.package).toBe('@reformer/ui-kit');
    expect(d.version).toBe('workspace');
    expect(d.styles.mode).toBe('tokens');
  });

  it('полям кит разрешил только отступы, контейнерам — весь словарь', () => {
    expect(d.styles.classNames.map((g) => g.id)).toContain('spacing');
    // Поле: расположение в форме править можно, вид — нет.
    expect(d.classGroupPolicy.get('Input')).toEqual(new Set(['spacing']));
    // Контейнер и синтетика билдера ограничений не получают.
    expect(d.classGroupPolicy.has('Box')).toBe(false);
    expect(d.classGroupPolicy.has('$html(div)')).toBe(false);
  });

  it('дескриптор воспроизводит захардкоженные таблицы билдера один в один', () => {
    expect(d.palette.categoryByName).toBe(CATEGORY_BY_NAME);
    expect(d.codegen.needsShim).toBe(NEEDS_SHIM);
    expect([...d.leafComponents].sort()).toEqual([...LEAF_COMPONENT_NAMES].sort());
    expect(d.resolve.fieldSuffix).toBe('Field');
    expect(d.infra.fieldWrapper).toBe('FormField');
  });

  it('жёсткие запреты и причины «не нашлось» — два РАЗНЫХ множества', () => {
    // Ровно те два allowlist'а, что жили в render-policy, но с сохранённой разницей смысла:
    // previewPolicy короткое замыкание ДО резолва, unresolvedReason — только текст при промахе.
    const limited = [...d.previewPolicy.entries()]
      .filter(([, p]) => p.mode === 'limited')
      .map(([name]) => name)
      .sort();
    const unresolved = [...d.unresolvedReason.keys()].sort();
    expect({ limited, unresolved }).toMatchSnapshot();
    // Пересечения быть не должно: компонент либо запрещён, либо просто отсутствует.
    expect(limited.filter((n) => unresolved.includes(n))).toEqual([]);
  });
});
