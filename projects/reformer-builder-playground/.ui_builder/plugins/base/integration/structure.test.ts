/**
 * Раскладка каталогов домена base — теми же правилами, что у билдера.
 *
 * Плагины домена уехали из билдера (`src/plugins/base`) вместе со своими каталогами; правила
 * раскладки поехали с ними, а не остались позади.
 *
 * @module plugins/base/integration/structure.test
 */

import { fileURLToPath } from 'node:url';
import { describeDomainStructure } from '../../.shared/domain-structure';

describeDomainStructure({
  domainDir: fileURLToPath(new URL('..', import.meta.url)),
  minPlugins: 3,
  minModules: 20,
});
