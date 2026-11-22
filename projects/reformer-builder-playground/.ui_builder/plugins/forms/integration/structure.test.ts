/**
 * Раскладка каталогов домена forms — теми же правилами, что у билдера.
 *
 * Плагины домена уехали из билдера (`src/plugins/kits`, `src/plugins/base/preview`) вместе
 * со своими каталогами; правила раскладки поехали с ними, а не остались позади.
 *
 * @module plugins/forms/integration/structure.test
 */

import { fileURLToPath } from 'node:url';
import { describeDomainStructure } from '../../.shared/domain-structure';

describeDomainStructure({
  domainDir: fileURLToPath(new URL('..', import.meta.url)),
  minPlugins: 2,
  minModules: 20,
});
