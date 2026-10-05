import { expect, it } from 'vitest';

import plugin from './main';
import manifest from './manifest.json';

it('идентификатор кода совпадает с манифестом', () => {
  // Иначе оболочка откажет в загрузке (id-mismatch).
  expect(plugin.id).toBe(manifest.id);
});
