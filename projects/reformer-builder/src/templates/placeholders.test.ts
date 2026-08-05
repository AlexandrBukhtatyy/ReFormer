import { describe, expect, it } from 'vitest';
import {
  TOKENS,
  hasTokens,
  materialize,
  nameVariants,
  splitWords,
  toCase,
  tokenize,
} from './placeholders';

describe('splitWords / toCase', () => {
  it('понимает kebab, snake, camel и Pascal', () => {
    expect(splitWords('user-profile')).toEqual(['user', 'profile']);
    expect(splitWords('user_profile')).toEqual(['user', 'profile']);
    expect(splitWords('userProfile')).toEqual(['user', 'profile']);
    expect(splitWords('UserProfile')).toEqual(['user', 'profile']);
    expect(splitWords('  ')).toEqual([]);
  });

  it('собирает имя в нужном написании', () => {
    expect(toCase('user-profile', 'pascal')).toBe('UserProfile');
    expect(toCase('user-profile', 'camel')).toBe('userProfile');
    expect(toCase('UserProfile', 'kebab')).toBe('user-profile');
    expect(toCase('UserProfile', 'snake')).toBe('user_profile');
    expect(toCase('', 'kebab')).toBe('');
  });

  it('nameVariants отдаёт все четыре написания', () => {
    expect(nameVariants('credit application')).toEqual({
      pascal: 'CreditApplication',
      camel: 'creditApplication',
      kebab: 'credit-application',
      snake: 'credit_application',
    });
  });
});

describe('tokenize', () => {
  it('заменяет все написания базового имени', () => {
    const src = [
      "import rawSchema from './credit-application/form.json';",
      'export default function CreditApplicationForm() {}',
      'const creditApplicationId = 1;',
      'const KEY = "credit_application";',
    ].join('\n');
    const out = tokenize(src, 'credit-application');
    expect(out).toContain(`'./${TOKENS.kebab}/form.json'`);
    expect(out).toContain(`function ${TOKENS.pascal}Form()`);
    expect(out).toContain(`const ${TOKENS.camel}Id`);
    expect(out).toContain(`"${TOKENS.snake}"`);
    expect(out).not.toContain('creditApplication');
  });

  it('идемпотентна', () => {
    const once = tokenize('CreditApplicationForm', 'credit-application');
    expect(tokenize(once, 'credit-application')).toBe(once);
  });

  it('односложное имя: kebab выигрывает у совпадающего camel', () => {
    expect(tokenize('profile/model.ts', 'profile')).toBe(`${TOKENS.kebab}/model.ts`);
    expect(tokenize('ProfileForm', 'profile')).toBe(`${TOKENS.pascal}Form`);
  });

  it('пустое, односимвольное и совпадающее с плейсхолдером имя ничего не меняют', () => {
    expect(tokenize('CreditApplication', '')).toBe('CreditApplication');
    expect(tokenize('a-a', 'a')).toBe('a-a');
    // «form name» — само имя плейсхолдера: замена съела бы собственные токены
    expect(tokenize('__FormName__Form', 'form-name')).toBe('__FormName__Form');
  });
});

describe('materialize', () => {
  it('подставляет новое имя в каждом написании', () => {
    const tpl = `${TOKENS.pascal}Form ${TOKENS.camel}Id ${TOKENS.kebab}/form.json ${TOKENS.snake}`;
    expect(materialize(tpl, 'user profile')).toBe(
      'UserProfileForm userProfileId user-profile/form.json user_profile'
    );
  });

  it('пустое имя оставляет шаблон нетронутым', () => {
    expect(materialize(`${TOKENS.pascal}Form`, '')).toBe(`${TOKENS.pascal}Form`);
  });

  it('обратна tokenize при совпадении имён', () => {
    const src = "export default function CreditApplicationForm() {} // './credit-application'";
    expect(materialize(tokenize(src, 'credit-application'), 'credit-application')).toBe(src);
  });
});

describe('hasTokens', () => {
  it('находит любой плейсхолдер', () => {
    expect(hasTokens(`x ${TOKENS.snake} y`)).toBe(true);
    expect(hasTokens('обычный текст')).toBe(false);
  });
});
