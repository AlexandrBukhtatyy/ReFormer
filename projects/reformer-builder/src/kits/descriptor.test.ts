import { describe, expect, it } from 'vitest';
import { toDescriptor, exportNameFor } from './descriptor';
import { CATEGORY_BY_NAME, LEAF_COMPONENT_NAMES, NEEDS_SHIM } from './legacy-reformer-ui-kit';
import type { CatalogJson, CatalogRecord } from '../catalog/types';

/** Минимальная валидная запись — детали propsSchema для этих тестов не важны. */
function record(name: string, extra: Partial<CatalogRecord> = {}): CatalogRecord {
  return { name, role: 'container', propsSchema: { type: 'object' }, ...extra };
}

function catalog(extra: Partial<CatalogJson> = {}): CatalogJson {
  return { version: '1.0', components: [record('Box')], ...extra };
}

describe('«неявный кит»: каталог 1.0 без блока kit', () => {
  const d = toDescriptor(catalog());

  it('идентифицируется как @reformer/ui-kit', () => {
    expect(d.id).toBe('reformer-ui-kit');
    expect(d.package).toBe('@reformer/ui-kit');
    expect(d.label).toBe('ReFormer UI Kit');
  });

  it('версия помечена как недостоверная, а не выдумана', () => {
    // package.json в этом репозитории версии не бампает (нет @semantic-release/git),
    // поэтому брать её оттуда нельзя — источник правды появится с реестром китов.
    expect(d.version).toBe('workspace');
  });

  it('правило резолва — сегодняшнее ${name}Field', () => {
    expect(d.resolve.fieldSuffix).toBe('Field');
  });

  it('infra — сегодняшние INFRA_NAMES', () => {
    expect(d.infra).toEqual({
      fieldWrapper: 'FormField',
      asyncBoundary: 'AsyncBoundary',
      list: 'List',
    });
  });

  it('категории палитры — сегодняшняя карта билдера', () => {
    expect(d.palette.categoryByName).toBe(CATEGORY_BY_NAME);
  });

  it('previewPolicy — ЖЁСТКИЕ запреты, то есть только оверлеи', () => {
    expect(d.previewPolicy.get('Dialog')).toEqual({
      mode: 'limited',
      reason: 'оверлей — нужен триггер/портал',
    });
    // Обычный компонент политикой не ограничен.
    expect(d.previewPolicy.has('Box')).toBe(false);
  });

  it('subpath-only — это ПРИЧИНА, а не запрет: они в unresolvedReason, не в previewPolicy', () => {
    // Разделение принципиально: оверлей нельзя рисовать даже при наличии в namespace, а
    // subpath-only компонент не запрещён — если кит его поставит, он отрисуется вживую.
    expect(d.previewPolicy.has('Carousel')).toBe(false);
    expect(d.unresolvedReason.get('Carousel')).toContain('embla');
    expect(d.unresolvedReason.get('Chart')).toContain('recharts');
    expect(d.unresolvedReason.has('Dialog')).toBe(false);
  });

  it('запись с subpath получает причину автоматически', () => {
    const withSubpath = toDescriptor(
      catalog({ components: [record('Fancy', { subpath: 'fancy' })] })
    );
    expect(withSubpath.unresolvedReason.get('Fancy')).toBe('subpath-only: fancy');
  });

  it('листья — сегодняшний LEAF_COMPONENT_NAMES', () => {
    expect([...d.leafComponents].sort()).toEqual([...LEAF_COMPONENT_NAMES].sort());
  });

  it('codegen — сегодняшний пакет и shim-список', () => {
    expect(d.codegen.importSpecifier).toBe('@reformer/ui-kit');
    expect(d.codegen.needsShim).toBe(NEEDS_SHIM);
  });

  it('стили — режим токенов (скоуп через переобъявление на контейнере)', () => {
    expect(d.styles.mode).toBe('tokens');
  });

  it('словаря классов нет: билдер СВОЕГО списка не держит', () => {
    // Не пустой fallback «на всякий случай», а осознанное отсутствие: для standalone-кита
    // Tailwind-подсказки неверны, а «подсказок нет» — честное поведение.
    expect(d.styles.classNames).toEqual([]);
    expect(d.classGroupPolicy.size).toBe(0);
  });

  it('compound-шаблоны не заданы → используются встроенные шаблоны билдера', () => {
    expect(d.compoundTemplates).toBeUndefined();
  });
});

describe('блок kit переопределяет дефолты точечно', () => {
  it('идентификация и версия', () => {
    const d = toDescriptor(
      catalog({ kit: { id: 'acme', label: 'Acme DS', package: '@acme/ds', version: '2.1.0' } })
    );
    expect([d.id, d.label, d.package, d.version]).toEqual(['acme', 'Acme DS', '@acme/ds', '2.1.0']);
  });

  it('importSpecifier по умолчанию берётся из package кита', () => {
    const d = toDescriptor(catalog({ kit: { package: '@acme/ds' } }));
    expect(d.codegen.importSpecifier).toBe('@acme/ds');
  });

  it('явный importSpecifier важнее package', () => {
    const d = toDescriptor(
      catalog({ kit: { package: '@acme/ds', codegen: { importSpecifier: '@acme/ds/components' } } })
    );
    expect(d.codegen.importSpecifier).toBe('@acme/ds/components');
  });

  it('своё правило резолва полей', () => {
    const d = toDescriptor(catalog({ kit: { resolve: { fieldSuffix: 'Control' } } }));
    expect(d.resolve.fieldSuffix).toBe('Control');
  });

  it('infra переопределяется по одному полю, остальные — дефолты', () => {
    const d = toDescriptor(catalog({ kit: { infra: { fieldWrapper: 'Field' } } }));
    expect(d.infra).toEqual({
      fieldWrapper: 'Field',
      asyncBoundary: 'AsyncBoundary',
      list: 'List',
    });
  });

  it('categoryByName ЗАМЕЩАЕТ карту билдера целиком, а не сливается с ней', () => {
    const d = toDescriptor(catalog({ kit: { palette: { categoryByName: { Btn: 'Действия' } } } }));
    expect(d.palette.categoryByName).toEqual({ Btn: 'Действия' });
    expect(d.palette.categoryByName.Input).toBeUndefined();
  });

  it('кит без визарда сообщает об этом явным null', () => {
    const d = toDescriptor(catalog({ kit: { adapters: { wizard: null, step: null } } }));
    expect(d.adapters.wizard).toBeNull();
  });

  it('peerRanges сохраняются как подсказка (решает символьная проверка, не semver)', () => {
    const d = toDescriptor(catalog({ kit: { peerRanges: { '@reformer/core': '^7' } } }));
    expect(d.peerRanges).toEqual({ '@reformer/core': '^7' });
  });
});

describe('per-record поля контракта 2.0', () => {
  it('preview из записи побеждает дефолт билдера', () => {
    const d = toDescriptor(
      catalog({
        kit: { id: 'acme' },
        components: [record('Dialog', { preview: { mode: 'live' } })],
      })
    );
    // Кит явно сказал, что его Dialog рисуется вживую — allowlist билдера не должен мешать.
    expect(d.previewPolicy.get('Dialog')).toEqual({ mode: 'live' });
  });

  it('дефолты билдера остаются базой для записей, о которых кит промолчал', () => {
    const d = toDescriptor(
      catalog({
        kit: { id: 'acme' },
        components: [record('Dialog', { preview: { mode: 'live' } })],
      })
    );
    // Кит завёл блок kit, но про Popover ничего не сказал — оверлейный дефолт сохраняется,
    // иначе оверлеи внезапно стали бы невидимыми узлами на canvas.
    expect(d.previewPolicy.get('Popover')?.mode).toBe('limited');
  });

  it('запись может объявить себя листом', () => {
    const d = toDescriptor(catalog({ components: [record('Sparkline', { leaf: true })] }));
    expect(d.leafComponents.has('Sparkline')).toBe(true);
  });

  it('явный leaf: false убирает запись из дефолтного множества листьев', () => {
    const d = toDescriptor(catalog({ components: [record('Progress', { leaf: false })] }));
    expect(d.leafComponents.has('Progress')).toBe(false);
    // Остальные листья на месте.
    expect(d.leafComponents.has('Icon')).toBe(true);
  });
});

describe('словарь классов и политика групп', () => {
  const GROUPS = [
    { id: 'spacing', label: 'Отступы', classes: ['gap-2', 'p-4'] },
    { id: 'color', label: 'Цвета', classes: ['bg-muted'] },
  ];

  it('словарь кита попадает в дескриптор как есть', () => {
    const d = toDescriptor(catalog({ kit: { styles: { classNames: GROUPS } } }));
    expect(d.styles.classNames).toEqual(GROUPS);
    // Режим стилей при этом остаётся дефолтным — поля блока styles независимы.
    expect(d.styles.mode).toBe('tokens');
  });

  it('classGroups записи попадает в политику множеством', () => {
    const d = toDescriptor(
      catalog({ components: [record('Input', { role: 'field', classGroups: ['spacing'] })] })
    );
    expect(d.classGroupPolicy.get('Input')).toEqual(new Set(['spacing']));
  });

  it('ПУСТОЙ classGroups заводит ключ с пустым множеством — это не то же, что отсутствие поля', () => {
    // Ключевое различие всей фичи: «кит промолчал» (ограничений нет) против «кит сказал: нечем»
    // (разрешённых групп нет). Свести их к одному значению нельзя.
    const d = toDescriptor(
      catalog({
        components: [record('Locked', { classGroups: [] }), record('Free')],
      })
    );
    expect(d.classGroupPolicy.has('Locked')).toBe(true);
    expect(d.classGroupPolicy.get('Locked')?.size).toBe(0);
    expect(d.classGroupPolicy.has('Free')).toBe(false);
  });

  it('правило роли размечает записи, о которых кит промолчал', () => {
    const d = toDescriptor(
      catalog({
        kit: { styles: { classGroupsByRole: { field: ['spacing'], container: '*' } } },
        components: [record('Input', { role: 'field' }), record('Box')],
      })
    );
    expect(d.classGroupPolicy.get('Input')).toEqual(new Set(['spacing']));
    // '*' — это «ограничений нет», ключ заводить не за чем.
    expect(d.classGroupPolicy.has('Box')).toBe(false);
  });

  it('classGroups записи важнее правила роли', () => {
    const d = toDescriptor(
      catalog({
        kit: { styles: { classGroupsByRole: { field: ['spacing'] } } },
        components: [record('Slider', { role: 'field', classGroups: ['spacing', 'sizing'] })],
      })
    );
    expect(d.classGroupPolicy.get('Slider')).toEqual(new Set(['spacing', 'sizing']));
  });

  it('роль без правила ограничений не получает', () => {
    // Синтетика билдера ($html/FormArray/Wizard/Step) приходит сюда наравне с записями кита:
    // роли array/container без правила остаются свободными, никаких исключений в коде не нужно.
    const d = toDescriptor(
      catalog({
        kit: { styles: { classGroupsByRole: { field: ['spacing'] } } },
        components: [record('$html(div)'), record('FormArray', { role: 'array' })],
      })
    );
    expect(d.classGroupPolicy.has('$html(div)')).toBe(false);
    expect(d.classGroupPolicy.has('FormArray')).toBe(false);
  });
});

describe('exportNameFor — единое правило резолва символа', () => {
  const d = toDescriptor(catalog());

  it('поле получает суффикс кита', () => {
    expect(exportNameFor({ name: 'Input', role: 'field' }, d)).toBe('InputField');
  });

  it('контейнер резолвится по имени как есть', () => {
    expect(exportNameFor({ name: 'Box', role: 'container' }, d)).toBe('Box');
  });

  it('exportName записи важнее правила', () => {
    expect(
      exportNameFor({ name: 'Chart', role: 'container', exportName: 'ChartContainer' }, d)
    ).toBe('ChartContainer');
    expect(exportNameFor({ name: 'Input', role: 'field', exportName: 'TextBox' }, d)).toBe(
      'TextBox'
    );
  });

  it('чужой суффикс применяется к полям', () => {
    const acme = toDescriptor(catalog({ kit: { resolve: { fieldSuffix: 'Control' } } }));
    expect(exportNameFor({ name: 'Input', role: 'field' }, acme)).toBe('InputControl');
  });
});
