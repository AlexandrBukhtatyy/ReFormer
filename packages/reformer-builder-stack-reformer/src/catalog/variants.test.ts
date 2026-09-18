import { describe, expect, it } from 'vitest';
import { builtinEntries } from './__fixtures__/builtin-catalog';
import { collapseToDefaults, isDefaultVariant, variantGroupOf } from './variants';

const cat = builtinEntries();

describe('variantGroupOf', () => {
  it('Input-семья: группа Input, дефолт Input, все члены', () => {
    const g = variantGroupOf(cat, 'Input');
    expect(g).not.toBeNull();
    expect(g!.group).toBe('Input');
    expect(g!.default.name).toBe('Input');
    expect(g!.members.map((m) => m.name).sort()).toEqual([
      'Input',
      'InputMask',
      'InputOTP',
      'InputPassword',
    ]);
  });

  it('любой член резолвит ту же группу', () => {
    expect(variantGroupOf(cat, 'InputPassword')?.group).toBe('Input');
    expect(variantGroupOf(cat, 'FileUploadAvatar')?.group).toBe('FileUpload');
    expect(variantGroupOf(cat, 'FileUpload')?.default.name).toBe('FileUpload');
  });

  it('компонент вне группы (или одиночный) → null', () => {
    // Textarea, а не Select: с появлением мультивыбора Select стал членом группы из двух.
    expect(variantGroupOf(cat, 'Textarea')).toBeNull();
    expect(variantGroupOf(cat, 'НетТакого')).toBeNull();
  });

  it('семьи мультивыбора: одиночный вариант — дефолт, мульти — второй член', () => {
    for (const [group, multi] of [
      ['Select', 'SelectMulti'],
      ['Combobox', 'ComboboxMulti'],
      ['NativeSelect', 'NativeSelectMulti'],
      ['ToggleGroup', 'ToggleGroupMulti'],
    ] as const) {
      const g = variantGroupOf(cat, group);
      expect(g, group).not.toBeNull();
      expect(g!.default.name).toBe(group);
      // Вхождение, а не равенство состава: у группы бывает больше двух членов (Combobox),
      // и жёсткий список ломался бы от каждого нового варианта, ничего при этом не проверяя.
      expect(g!.members.map((m) => m.name)).toContain(group);
      expect(g!.members.map((m) => m.name)).toContain(multi);
      // Мульти резолвит ту же группу — иначе инспектор не покажет переключатель варианта.
      expect(variantGroupOf(cat, multi)?.group).toBe(group);
    }
  });

  it('семья Combobox — четыре варианта: плоский список и дерево, каждый в двух видах', () => {
    const g = variantGroupOf(cat, 'Combobox');
    expect(g).not.toBeNull();
    expect(g!.default.name).toBe('Combobox');
    expect(g!.members.map((m) => m.name).sort()).toEqual(
      ['Combobox', 'ComboboxMulti', 'ComboboxTree', 'ComboboxTreeMulti'].sort()
    );
    // Метки вариантов различны — иначе переключатель показал бы два одинаковых пункта.
    const labels = g!.members.map((m) => m.variant);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('isDefaultVariant', () => {
  it('дефолт — член с name===variantGroup; не-члены группы — тоже «дефолт»', () => {
    const by = (n: string) => cat.find((e) => e.name === n)!;
    expect(isDefaultVariant(by('Input'))).toBe(true);
    expect(isDefaultVariant(by('InputPassword'))).toBe(false);
    expect(isDefaultVariant(by('FileUpload'))).toBe(true);
    expect(isDefaultVariant(by('FileUploadAvatar'))).toBe(false);
    expect(isDefaultVariant(by('Select'))).toBe(true);
  });
});

describe('collapseToDefaults', () => {
  it('оставляет один дефолт на группу, не-групповые не трогает', () => {
    const subset = cat.filter((e) =>
      ['Input', 'InputPassword', 'InputMask', 'InputOTP', 'Select'].includes(e.name)
    );
    const names = collapseToDefaults(subset).map((e) => e.name);
    expect(names).toContain('Input');
    expect(names).not.toContain('InputPassword');
    expect(names).not.toContain('InputMask');
    expect(names).not.toContain('InputOTP');
    expect(names).toContain('Select');
  });

  it('если дефолт группы не в списке — берёт найденного члена', () => {
    const subset = cat.filter((e) => e.name === 'InputPassword');
    expect(collapseToDefaults(subset).map((e) => e.name)).toEqual(['InputPassword']);
  });
});
