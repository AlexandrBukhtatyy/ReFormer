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
 * - **Каталог** — значением: это данные (~15 кБ), и по нему кит представляется в выборе.
 * - **Пространство имён** — динамическим импортом. HexaUI с antd и styled-components весит
 *   мегабайты, и исполняться он должен, когда кит выбран и форма рисуется, а не при включении
 *   плагина. Поэтому `./namespace` здесь статически не импортируется.
 * - **Стили** — полем `styles` манифеста (`src/builder-plugin.css`): оболочка ставит их
 *   с изоляцией `scoped`, и тема дизайн-системы действует только внутри рамки кита в превью.
 *
 * @module reformer/kit-hexa-ui/builder-plugin
 */

import { definePlugin, KitSourcePoint, type CatalogJson } from '@reformer/builder-plugin-api';
import catalog from '../catalog.json';

/** Идентификатор плагина — он же в манифесте; расхождение оболочка отвергнет (`id-mismatch`). */
export const HEXA_UI_PLUGIN_ID = 'kit-hexa-ui';

export default definePlugin({
  id: HEXA_UI_PLUGIN_ID,
  activate(ctx) {
    ctx.subscriptions.push(
      ctx.extensions.contribute(
        KitSourcePoint,
        {
          catalog: catalog as unknown as CatalogJson,
          namespace: () => import('./namespace').then((module) => module.HEXA_UI_NAMESPACE),
        },
        { id: 'hexa-ui' }
      )
    );
  },
});
