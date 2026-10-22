/**
 * Раскладка домена ReFormer: порог модулей на каталог и устройство пакетов плагинов.
 *
 * Правила — те же, что у исходников билдера (см. `.shared/domain-structure`). Исключения
 * домена переехали сюда вместе с ним.
 *
 * @module plugins/reformer/integration/structure.test
 */

import { fileURLToPath } from 'node:url';
import { describeDomainStructure } from '../../.shared/domain-structure';

describeDomainStructure({
  domainDir: fileURLToPath(new URL('..', import.meta.url)),
  exceptions: {
    'ai/src/tools': {
      // 21 модуль инструментов (`list_templates` и `create_form` — в одном) и 7 модулей обвязки:
      // реестр, общие параметры, особые ключи узла, замер поверхности, проекции команд и вкладов
      // плагинов, бочка.
      limit: 28,
      why:
        'по файлу на инструмент агента — сам НАБОР и есть поверхность, которую видит модель; ' +
        'группировка инструментов по темам спрятала бы её состав, а он под храповиком ' +
        'tool-surface.test.ts',
    },
    'core/form-model': {
      limit: 17,
      why:
        'бывший модуль пакета стека перенесён в ядро домена как есть — перенос без правок ' +
        'поведения; раскладка на подкаталоги за барелем — ReFormer-tbbt.10',
    },
  },
  minPlugins: 6,
  minModules: 200,
});
