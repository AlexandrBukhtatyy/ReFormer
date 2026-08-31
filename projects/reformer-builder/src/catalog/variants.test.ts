import { describe, expect, it } from 'vitest';
import { getCatalog } from './index';
import { collapseToDefaults, isDefaultVariant, variantGroupOf } from './variants';

describe('variantGroupOf', () => {
  it('Input-семья: группа Input, дефолт Input, все члены', () => {
    const g = variantGroupOf('Input');
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
    expect(variantGroupOf('InputPassword')?.group).toBe('Input');
    expect(variantGroupOf('FileUploadAvatar')?.group).toBe('FileUpload');
    expect(variantGroupOf('FileUpload')?.default.name).toBe('FileUpload');
  });

  it('компонент вне группы (или одиночный) → null', () => {
    // Textarea, а не Select: с появлением мультивыбора Select стал членом группы из двух.
    expect(variantGroupOf('Textarea')).toBeNull();
    expect(variantGroupOf('НетТакого')).toBeNull();
  });

  it('семьи выбора: одиночный вариант — дефолт, остальные — члены той же группы', () => {
    // Combobox — семья из ЧЕТЫРЁХ: к одиночному и мульти добавились древовидные варианты
    // (выбор узла иерархии и набора узлов). Остальные семьи по-прежнему из двух.
    for (const [group, ...rest] of [
      ['Select', 'SelectMulti'],
      ['Combobox', 'ComboboxMulti', 'ComboboxTree', 'ComboboxTreeMulti'],
      ['NativeSelect', 'NativeSelectMulti'],
      ['ToggleGroup', 'ToggleGroupMulti'],
    ] as const) {
      const g = variantGroupOf(group);
      expect(g, group).not.toBeNull();
      expect(g!.default.name).toBe(group);
      expect(g!.members.map((m) => m.name).sort()).toEqual([group, ...rest].sort());
      // Любой не-дефолтный вариант резолвит ту же группу — иначе инспектор не покажет
      // переключатель варианта, стоя на нём.
      for (const member of rest) expect(variantGroupOf(member)?.group, member).toBe(group);
    }
  });
});

describe('isDefaultVariant', () => {
  it('дефолт — член с name===variantGroup; не-члены группы — тоже «дефолт»', () => {
    const cat = getCatalog();
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
    const cat = getCatalog();
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
    const cat = getCatalog();
    const subset = cat.filter((e) => e.name === 'InputPassword');
    expect(collapseToDefaults(subset).map((e) => e.name)).toEqual(['InputPassword']);
  });
});
