import { describe, expect, it } from 'vitest';
import type { CatalogJson, CatalogRecord } from './catalog.js';
import {
  CONVENTIONAL_KIT_INFRA,
  exportNameFor,
  toDescriptor,
  UNKNOWN_KIT_VERSION,
} from './descriptor.js';

/** Минимальная запись — детали `propsSchema` здесь не важны. */
function record(name: string, extra: Partial<CatalogRecord> = {}): CatalogRecord {
  return { name, role: 'container', propsSchema: { type: 'object' }, ...extra };
}

function catalog(extra: Partial<CatalogJson> = {}): CatalogJson {
  return { version: '2.1', components: [record('Box')], ...extra };
}

describe('каталог без блока kit: умолчания общие, а не таблицы какого-то кита', () => {
  const d = toDescriptor({ version: '1.0', components: [record('Dialog'), record('Icon')] });

  it('кит себя не назвал — идентификатора нет, и притворяться встроенным он не может', () => {
    // Раньше такой каталог достраивался до `@reformer/ui-kit`: чужой кит без блока `kit`
    // получал его категории, оверлеи и прослойки визарда.
    expect(d.id).toBe('');
    expect(d.label).toBe('');
    expect(d.package).toBe('');
    expect(d.codegen.importSpecifier).toBe('');
  });

  it('версия помечена недостоверной, а не выдумана', () => {
    expect(d.version).toBe(UNKNOWN_KIT_VERSION);
  });

  it('инфраструктура — имена по соглашению', () => {
    expect(d.infra).toEqual(CONVENTIONAL_KIT_INFRA);
    expect(d.infra.fieldFrame).toBe('FieldFrame');
  });

  it('ни категорий, ни запретов превью, ни листьев, ни прослоек — их объявляет кит', () => {
    expect(d.palette.categoryByName).toEqual({});
    expect(d.previewPolicy.size).toBe(0);
    expect(d.unresolvedReason.size).toBe(0);
    expect(d.leafComponents.size).toBe(0);
    expect(d.codegen.needsShim.size).toBe(0);
    expect(d.adapters).toEqual({});
    expect(d.renderers).toEqual({});
  });

  it('стили — на токенах, словаря классов нет', () => {
    expect(d.styles.mode).toBe('tokens');
    expect(d.styles.classNames).toEqual([]);
    expect(d.classGroupPolicy.size).toBe(0);
  });
});

describe('блок kit', () => {
  it('идентификация и версия', () => {
    const d = toDescriptor(
      catalog({ kit: { id: 'acme', label: 'Acme DS', package: '@acme/ds', version: '2.1.0' } })
    );
    expect([d.id, d.label, d.package, d.version]).toEqual(['acme', 'Acme DS', '@acme/ds', '2.1.0']);
  });

  it('без подписи кит подписан своим идентификатором', () => {
    expect(toDescriptor(catalog({ kit: { id: 'acme' } })).label).toBe('acme');
  });

  it('спецификатор импорта по умолчанию — пакет кита, явный важнее', () => {
    expect(toDescriptor(catalog({ kit: { package: '@acme/ds' } })).codegen.importSpecifier).toBe(
      '@acme/ds'
    );
    const explicit = toDescriptor(
      catalog({ kit: { package: '@acme/ds', codegen: { importSpecifier: '@acme/ds/components' } } })
    );
    expect(explicit.codegen.importSpecifier).toBe('@acme/ds/components');
  });

  it('инфраструктура переопределяется по одному полю', () => {
    const d = toDescriptor(
      catalog({ kit: { infra: { fieldWrapper: 'Field', fieldFrame: 'Frame' } } })
    );
    expect(d.infra).toEqual({
      fieldWrapper: 'Field',
      asyncBoundary: 'AsyncBoundary',
      list: 'List',
      fieldFrame: 'Frame',
    });
  });

  it('категории и прослойки — те, что назвал кит', () => {
    const d = toDescriptor(
      catalog({
        kit: {
          palette: { categoryByName: { Btn: 'Действия' }, order: ['Действия'] },
          codegen: { needsShim: ['Wizard', 'Step'] },
        },
      })
    );
    expect(d.palette.categoryByName).toEqual({ Btn: 'Действия' });
    expect(d.palette.order).toEqual(['Действия']);
    expect([...d.codegen.needsShim]).toEqual(['Wizard', 'Step']);
  });

  it('кит без визарда сообщает об этом явным null', () => {
    const d = toDescriptor(catalog({ kit: { adapters: { wizard: null, step: null } } }));
    expect(d.adapters.wizard).toBeNull();
  });

  it('подсказки стекам (2.1) доходят как есть', () => {
    const rjsf = { widgets: { TextWidget: 'TextField' }, templates: { field: 'Field' } };
    expect(toDescriptor(catalog({ kit: { renderers: { rjsf } } })).renderers).toEqual({ rjsf });
  });

  it('peerRanges сохраняются как подсказка', () => {
    const d = toDescriptor(catalog({ kit: { peerRanges: { '@reformer/core': '^7' } } }));
    expect(d.peerRanges).toEqual({ '@reformer/core': '^7' });
  });
});

describe('сводки по записям', () => {
  it('запрет превью — тот, что объявила запись', () => {
    const d = toDescriptor(
      catalog({
        components: [
          record('Dialog', { preview: { mode: 'limited', reason: 'оверлей' } }),
          record('Popover'),
        ],
      })
    );
    expect(d.previewPolicy.get('Dialog')).toEqual({ mode: 'limited', reason: 'оверлей' });
    // Кит промолчал — запрета нет: знать чужие оверлеи платформе неоткуда.
    expect(d.previewPolicy.has('Popover')).toBe(false);
  });

  it('подпуть — ПРИЧИНА «нет в главном входе», а не запрет', () => {
    const d = toDescriptor(catalog({ components: [record('Chart', { subpath: 'chart' })] }));
    expect(d.unresolvedReason.get('Chart')).toBe('subpath-only: chart');
    expect(d.previewPolicy.has('Chart')).toBe(false);
  });

  it('лист — запись, объявившая себя листом', () => {
    const d = toDescriptor(
      catalog({ components: [record('Sparkline', { leaf: true }), record('Box', { leaf: false })] })
    );
    expect([...d.leafComponents]).toEqual(['Sparkline']);
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
    expect(d.styles.mode).toBe('tokens');
  });

  it('ПУСТОЙ classGroups заводит ключ с пустым множеством — это не отсутствие поля', () => {
    const d = toDescriptor(
      catalog({ components: [record('Locked', { classGroups: [] }), record('Free')] })
    );
    expect(d.classGroupPolicy.get('Locked')?.size).toBe(0);
    expect(d.classGroupPolicy.has('Free')).toBe(false);
  });

  it('правило роли размечает записи, о которых кит промолчал; запись важнее правила', () => {
    const d = toDescriptor(
      catalog({
        kit: { styles: { classGroupsByRole: { field: ['spacing'], container: '*' } } },
        components: [
          record('Input', { role: 'field' }),
          record('Slider', { role: 'field', classGroups: ['spacing', 'sizing'] }),
          record('Box'),
          record('FormArray', { role: 'array' }),
        ],
      })
    );
    expect(d.classGroupPolicy.get('Input')).toEqual(new Set(['spacing']));
    expect(d.classGroupPolicy.get('Slider')).toEqual(new Set(['spacing', 'sizing']));
    // '*' и роль без правила — «ограничений нет», ключ не заводится.
    expect(d.classGroupPolicy.has('Box')).toBe(false);
    expect(d.classGroupPolicy.has('FormArray')).toBe(false);
  });
});

describe('exportNameFor — символ называет сам каталог', () => {
  it('без exportName — имя записи, неявного суффикса нет', () => {
    expect(exportNameFor({ name: 'Input' })).toBe('Input');
  });

  it('exportName называет символ явно', () => {
    expect(exportNameFor({ name: 'Checkbox', exportName: 'CheckboxWithLabel' })).toBe(
      'CheckboxWithLabel'
    );
  });
});
