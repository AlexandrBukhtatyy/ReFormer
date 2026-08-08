import { describe, expect, it } from 'vitest';
import { DEFAULT_KIT_ID, getKit, getKitOrDefault, listKits } from './registry';
import { toDescriptor } from './descriptor';
import { validateCatalog } from '../catalog/contract';

describe('реестр китов', () => {
  const kits = listKits();

  it('содержит минимум два кита с разными id', () => {
    expect(kits.length).toBeGreaterThanOrEqual(2);
    expect(new Set(kits.map((k) => k.id)).size).toBe(kits.length);
  });

  it('кит по умолчанию присутствует', () => {
    expect(getKit(DEFAULT_KIT_ID)).toBeDefined();
  });

  it('неизвестный id и null откатываются на кит по умолчанию', () => {
    expect(getKitOrDefault('нет-такого').id).toBe(DEFAULT_KIT_ID);
    expect(getKitOrDefault(null).id).toBe(DEFAULT_KIT_ID);
  });

  it('каталог КАЖДОГО кита проходит контракт', () => {
    // Каталог v11 — сгенерированный артефакт (scripts/gen-kit-catalog.mjs), а не написанный
    // руками, поэтому его валидность надо стеречь тестом.
    for (const kit of kits) {
      const res = validateCatalog(kit.catalog);
      expect(res.errors, `${kit.id}: ${res.errors.join('; ')}`).toEqual([]);
      expect(res.valid).toBe(true);
    }
  });

  it('classGroups и classGroupsByRole ссылаются на существующие группы словаря', () => {
    // Кросс-ссылок AJV не проверяет: опечатка в id молча оставила бы компонент без подсказок.
    for (const kit of kits) {
      const groups = kit.catalog.kit?.styles?.classNames ?? [];
      const ids = new Set(groups.map((g) => g.id));
      for (const [role, rule] of Object.entries(kit.catalog.kit?.styles?.classGroupsByRole ?? {})) {
        if (rule === '*') continue;
        for (const id of rule ?? []) expect(ids, `${kit.id}/byRole.${role}`).toContain(id);
      }
      for (const r of kit.catalog.components) {
        for (const id of r.classGroups ?? []) expect(ids, `${kit.id}/${r.name}`).toContain(id);
      }
    }
  });

  it('кит по умолчанию поставляет непустой словарь классов', () => {
    // Если генератор перестанет писать секцию, автодополнение className исчезнет молча:
    // билдер своего списка не держит и просто покажет пустую выпадашку.
    const groups = getKit(DEFAULT_KIT_ID)!.catalog.kit?.styles?.classNames ?? [];
    expect(groups.length).toBeGreaterThan(5);
    expect(groups.flatMap((g) => g.classes).length).toBeGreaterThan(300);
  });

  it('загрузка namespace ленивая — функция, а не готовый объект', () => {
    // Иначе Vite сложит все киты в главный чанк и переключатель версий оплачивался бы весом всех.
    for (const kit of kits) expect(typeof kit.loadNamespace).toBe('function');
  });
});

describe('сгенерированный каталог ui-kit@11', () => {
  const kit = getKit('reformer-ui-kit-11')!;
  const d = toDescriptor(kit.catalog);

  it('несёт блок kit с настоящей версией пакета', () => {
    expect(d.package).toBe('@reformer/ui-kit');
    expect(d.version).toBe('11.0.0');
    expect(kit.catalog.version).toBe('2.0');
  });

  it('в infra НЕТ List — в 11.0.0 такого компонента ещё не было', () => {
    // Дефолт билдера подставит имя `List`, но namespace кита его не отдаст, и билдер покажет стаб.
    // Проверяем именно то, что дескриптор кита про List молчит.
    expect(kit.catalog.kit?.infra?.list).toBeUndefined();
    expect(kit.catalog.kit?.infra?.fieldWrapper).toBe('FormField');
  });

  it('адаптер визарда найден', () => {
    expect(d.adapters.wizard?.symbol).toBe('FormWizard');
  });

  it('есть и поля, и части compound, и записи за subpath', () => {
    const records = kit.catalog.components;
    expect(records.some((r) => r.role === 'field')).toBe(true);
    expect(records.some((r) => r.compoundParent)).toBe(true);
    expect(records.some((r) => r.subpath)).toBe(true);
    expect(records.find((r) => r.name === 'Input')?.role).toBe('field');
  });

  it('поля резолвятся по правилу кита', () => {
    const input = kit.catalog.components.find((r) => r.name === 'Input')!;
    expect(d.resolve.fieldSuffix).toBe('Field');
    expect(input.exportName ?? `${input.name}${d.resolve.fieldSuffix}`).toBe('InputField');
  });
});
