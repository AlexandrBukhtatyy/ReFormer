/**
 * Плагин ReFormer Builder «кит HexaUI»: ставит кит в билдер вкладом в точку `reformer.kit.source`.
 *
 * Билдер о HexaUI не знает ничего — ни в зависимостях, ни в составе. Кит приходит обычным плагином
 * каталога проекта: реестр китов подхватывает вклад, кит появляется в выборе, выключение плагина
 * его снимает. Плагин зависит только от контракта (`@reformer/builder-plugin-api`); что ему нужно
 * от оболочки — служба китов — объявлено в `requires` манифеста.
 *
 * ## Что грузится когда
 *
 * - **Шапка кита** — значением ({@link HEXA_UI_KIT}): по ней кит представляется в выборе, пока
 *   каталога нет. Реестр после загрузки сверяет её с блоком `kit` каталога — идентификатор обязан
 *   совпасть, иначе ключ выбора менялся бы под ногами.
 * - **Каталог** — динамическим импортом. Полный каталог HexaUI — сотни записей, и разбирать его
 *   при каждом включении плагина незачем: реестр зовёт загрузчик, когда кит выбран. Сборка
 *   плагина кладёт JSON отдельным файлом (`chunks/catalog.js`).
 * - **Пространство имён** — динамическим импортом. HexaUI с antd и styled-components весит
 *   мегабайты, и исполняться он должен, когда кит выбран и форма рисуется, а не при включении
 *   плагина. Поэтому `./namespace` здесь статически не импортируется.
 * - **Стили** — полем `styles` манифеста (`src/builder-plugin.css`): оболочка ставит их
 *   с изоляцией `scoped`, и тема дизайн-системы действует только внутри рамки кита в превью.
 *
 * @module reformer/kit-hexa-ui/builder-plugin
 */

import {
  definePlugin,
  KitSourcePoint,
  type CatalogJson,
  type KitDescriptorJson,
} from '@reformer/builder-plugin-api';

/** Идентификатор плагина — он же в манифесте; расхождение оболочка отвергнет (`id-mismatch`). */
export const HEXA_UI_PLUGIN_ID = 'kit-hexa-ui';

/**
 * Шапка кита: чем он представляется до загрузки каталога. Поля — те же, что в блоке `kit`
 * каталога; `id` обязан совпадать с ним (это проверяют и реестр китов, и `reformer-plugin dry-run`).
 */
export const HEXA_UI_KIT: KitDescriptorJson = Object.freeze({
  id: 'hexa-ui',
  label: 'Kaspersky HexaUI',
  package: '@kaspersky/hexa-ui',
});

/** Загрузчик каталога. JSON — модулем: значение в `default`. */
function loadCatalog(): Promise<CatalogJson> {
  return import('../catalog.json').then((module) => module.default as unknown as CatalogJson);
}

export default definePlugin({
  id: HEXA_UI_PLUGIN_ID,
  activate(ctx) {
    ctx.subscriptions.push(
      ctx.extensions.contribute(
        KitSourcePoint,
        {
          kit: HEXA_UI_KIT,
          catalog: loadCatalog,
          namespace: () => import('./namespace').then((module) => module.HEXA_UI_NAMESPACE),
        },
        { id: 'hexa-ui' }
      )
    );
  },
});
