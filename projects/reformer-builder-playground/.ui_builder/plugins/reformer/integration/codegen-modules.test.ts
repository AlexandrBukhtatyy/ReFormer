/**
 * Кодоген домена встречается с реестром модулей оболочки.
 *
 * Сгенерированная форма импортирует кит по спецификатору, который печатает кодоген, а исполняет
 * её превью оболочки — и находит модуль в своём реестре. Спецификатор и реестр живут в разных
 * местах, и совпасть они обязаны здесь.
 *
 * @module plugins/reformer/integration/codegen-modules.test
 */

import { describe, expect, it } from 'vitest';
import { RUNTIME_MODULES } from '@/application/composer/runtime-modules';
import { createPluginModules } from '@/shell/boot/plugin-modules';
import { prepare, wizardShimOf } from '../core/codegen';
import { builtinKit, wizardSchema } from '../core/testing';

describe('модули, которые просит сгенерированная форма', () => {
  it('спецификатор, который кодоген печатает для встроенного кита, реестр отдаёт', () => {
    // Отказ, который это удерживает, уже случался: адаптер визарда объявлял подпуть, шим
    // печатал `import … from '@reformer/ui-kit/form-wizard'`, и выгруженная форма не
    // поднималась в превью — подпути кита реестр не отдаёт намеренно (см. шапку
    // `shell/boot/plugin-modules`). Снимок текста файла такое не ловит: он сверяет строку
    // с собой же.
    const shim = wizardShimOf(
      prepare({ schema: wizardSchema(), formName: 'Заявка', kit: builtinKit() })
    );

    const modules = createPluginModules({ modules: RUNTIME_MODULES });

    expect(shim).not.toBeNull();
    expect(modules.specifiers).toContain(shim?.importFrom);
    modules.dispose();
  });
});
