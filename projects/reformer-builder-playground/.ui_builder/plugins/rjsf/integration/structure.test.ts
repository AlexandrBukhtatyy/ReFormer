/**
 * Раскладка домена RJSF: порог модулей на каталог и устройство пакетов плагинов.
 *
 * Правила — те же, что у исходников билдера (см. `.shared/domain-structure`). Исключений
 * у домена нет.
 *
 * @module plugins/rjsf/integration/structure.test
 */

import { fileURLToPath } from 'node:url';
import { describeDomainStructure } from '../../.shared/domain-structure';

describeDomainStructure({
  domainDir: fileURLToPath(new URL('..', import.meta.url)),
  minPlugins: 2,
  minModules: 30,
});
